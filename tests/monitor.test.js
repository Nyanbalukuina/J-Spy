import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { parseResponse, parseRequestPayload, createNetworkMonitor, createCookieLoader } from '../src/lib/monitor.js';

test('request JSON preserves nested data, primitives, and malformed text', () => {
  const parse = text => parseRequestPayload({ url: 'https://example.com/api', postData: { mimeType: 'application/problem+json; charset=utf-8', text } });
  for (const value of [{ name: '日本語', items: [1, 2] }, false, 0, null, 'text']) {
    assert.equal(parse(JSON.stringify(value)).kind, 'json');
    assert.deepEqual(parse(JSON.stringify(value)).body, value);
  }
  assert.equal(parse('{broken').kind, 'text');
  assert.equal(parse('{broken').body, '{broken');
});

test('query and form fields preserve duplicates, Unicode, empty values, and files', () => {
  const payload = parseRequestPayload({ url: 'https://example.com/api?tag=a&tag=b&empty=', postData: {
    mimeType: 'application/x-www-form-urlencoded', text: 'name=%E6%97%A5%E6%9C%AC%E8%AA%9E&tag=a&tag=b&empty='
  } });
  assert.deepEqual(payload.query, [{ name: 'tag', value: 'a' }, { name: 'tag', value: 'b' }, { name: 'empty', value: '' }]);
  assert.equal(payload.kind, 'form');
  assert.deepEqual(payload.params, [{ name: 'name', value: '日本語' }, { name: 'tag', value: 'a' }, { name: 'tag', value: 'b' }, { name: 'empty', value: '' }]);
  const multipart = parseRequestPayload({ url: 'https://example.com', postData: {
    mimeType: 'multipart/form-data; boundary=abc', params: [{ name: 'file', fileName: 'sample.txt' }, { name: 'title', value: 'demo' }]
  } });
  assert.equal(multipart.kind, 'form');
  assert.equal(multipart.params[0].fileName, 'sample.txt');
  assert.equal(multipart.params[1].value, 'demo');
});

test('missing, unavailable, empty, and plain text request bodies remain distinct', () => {
  const parse = postData => parseRequestPayload({ url: 'invalid URL', postData });
  assert.equal(parse(undefined).kind, 'empty');
  assert.equal(parse({ mimeType: 'multipart/form-data' }).kind, 'unavailable');
  assert.equal(parse({ mimeType: 'text/plain', text: '' }).kind, 'text');
  assert.equal(parse({ mimeType: 'text/plain', text: 'false' }).body, 'false');
});

test('JSON primitives, invalid JSON, and double-encoded JSON remain displayable', () => {
  for (const value of [false, 0, null, '', true, [], {}]) {
    assert.deepEqual(parseResponse(JSON.stringify(value)), { body: value, bodyState: 'ready' });
  }
  assert.deepEqual(parseResponse('{broken'), { body: '{broken', bodyState: 'ready' });
  assert.deepEqual(parseResponse(JSON.stringify('{broken')), { body: '{broken', bodyState: 'ready' });
  assert.deepEqual(parseResponse(JSON.stringify('{"ok":true}')), { body: { ok: true }, bodyState: 'ready' });
  assert.equal(parseResponse('').bodyState, 'empty');
  assert.equal(parseResponse(undefined).bodyState, 'empty');
});

test('base64 responses decode Unicode and report invalid encodings', () => {
  const text = '{"message":"日本語 🍪"}';
  assert.deepEqual(parseResponse(Buffer.from(text).toString('base64'), 'base64').body, JSON.parse(text));
  assert.equal(parseResponse('!!!', 'base64').bodyState, 'error');
  assert.equal(parseResponse('abc', 'unknown').bodyState, 'error');
});

function networkHarness() {
  let listener;
  const api = { runtime: {}, devtools: { network: { onRequestFinished: {
    addListener(fn) { listener = fn; },
    removeListener(fn) { assert.equal(fn, listener); listener = undefined; }
  } } } };
  const entries = [];
  const updates = [];
  const monitor = createNetworkMonitor(api, value => entries.push(value), (id, result) => {
    assert.ok(entries.some(entry => entry.id === id));
    updates.push(result);
  });
  const emit = (getContent, postData) => listener({
    request: { url: 'https://example.com/api', method: 'GET', postData },
    response: { status: 200, content: { mimeType: 'application/json' } }, time: 12,
    getContent
  });
  return { api, entries, updates, monitor, emit, get listener() { return listener; } };
}

test('synchronous body callbacks run after the entry exists', () => {
  const harness = networkHarness();
  harness.emit(callback => callback('false', ''));
  assert.deepEqual(harness.updates, [{ body: false, bodyState: 'ready' }]);
  harness.monitor.destroy();
  assert.equal(harness.listener, undefined);
});

test('request payload is captured independently of response retrieval failures', () => {
  const harness = networkHarness();
  harness.emit(() => { throw new Error('Body unavailable'); }, { mimeType: 'application/json', text: '{"sent":true}' });
  assert.deepEqual(harness.entries[0].payload.body, { sent: true });
  assert.equal(harness.updates[0].bodyState, 'error');
  harness.monitor.destroy();
});

test('Clear All and disposal invalidate pending body callbacks', () => {
  const harness = networkHarness();
  let callback;
  harness.emit(fn => { callback = fn; });
  harness.monitor.clear();
  callback('{}', '');
  assert.equal(harness.updates.length, 0);
  harness.emit(fn => { callback = fn; });
  harness.monitor.destroy();
  callback('{}', '');
  assert.equal(harness.updates.length, 0);
});

test('body retrieval errors become visible states', () => {
  const harness = networkHarness();
  harness.emit(() => { throw new Error('Body unavailable'); });
  assert.equal(harness.updates[0].bodyState, 'error');
  harness.api.runtime.lastError = { message: 'Request expired' };
  harness.emit(callback => callback('', ''));
  assert.equal(harness.updates[1].bodyError, 'Request expired');
});

test('out-of-order Cookie results and canceled selections cannot overwrite the current selection', () => {
  const callbacks = [];
  const results = [];
  const api = { runtime: {}, cookies: { getAll(options, callback) { callbacks.push(callback); } } };
  const loader = createCookieLoader(api, result => results.push(result));
  loader.load('https://a.example');
  loader.load('https://b.example');
  callbacks[1]([{ name: 'b', value: '2; 3' }]);
  callbacks[0]([{ name: 'a', value: '1' }]);
  assert.deepEqual(results.at(-1).cookies, [{ name: 'b', value: '2; 3' }]);
  assert.equal(results.length, 3);
  loader.load('https://a.example');
  loader.cancel();
  callbacks[2]([{ name: 'a', value: '1' }]);
  assert.equal(results.at(-1).state, 'loading');
  assert.equal(results.length, 4);
});

test('Cookie failures and a missing Chrome API are handled', () => {
  const results = [];
  createCookieLoader(undefined, value => results.push(value)).load('https://example.com');
  assert.equal(results.at(-1).state, 'error');
  const api = { runtime: { lastError: { message: 'Permission denied' } }, cookies: {
    getAll(options, callback) { callback(undefined); }
  } };
  createCookieLoader(api, value => results.push(value)).load('https://example.com');
  assert.equal(results.at(-1).error, 'Permission denied');
});

test('upgrade cleanup removes only obsolete request records and registers no traffic listeners', () => {
  let installed;
  let removed;
  const chrome = { runtime: { onInstalled: { addListener(fn) { installed = fn; } } }, storage: { local: {
    get(key, callback) { callback({ req_123: {}, api_123: {}, preferences: {} }); },
    remove(keys, callback) { removed = keys; callback(); }
  } } };
  vm.runInNewContext(fs.readFileSync(new URL('../src/background.js', import.meta.url), 'utf8'), { chrome });
  installed();
  assert.deepEqual(Array.from(removed), ['req_123', 'api_123']);
});
