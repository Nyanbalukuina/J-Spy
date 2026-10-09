// Parse only here; the view must never parse untrusted response text.
export function parseResponse(content, encoding = '') {
  if (content == null || content === '') return { body: null, bodyState: 'empty' };
  try {
    if (encoding === 'base64') {
      const bytes = Uint8Array.from(atob(content), char => char.charCodeAt(0));
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } else if (encoding) {
      throw new Error('Unsupported response encoding: ' + encoding);
    }
  } catch (error) {
    return { body: null, bodyState: 'error', bodyError: error.message };
  }
  let body = content;
  try { body = JSON.parse(content); } catch { /* Show malformed JSON as text. */ }
  if (typeof body === 'string' && /^[\[{]/.test(body.trim())) {
    try { body = JSON.parse(body); } catch { /* Preserve the first parsed value. */ }
  }
  return { body, bodyState: 'ready' };
}

export function parseRequestPayload(request) {
  let query = [];
  try { query = [...new URL(request.url).searchParams].map(([name, value]) => ({ name, value })); } catch { /* A malformed URL must not interrupt capture. */ }
  const postData = request.postData;
  const payload = { query, mimeType: postData?.mimeType || '', kind: 'empty', body: null, params: [] };
  if (!postData) return payload;
  const mimeType = payload.mimeType.split(';')[0].trim().toLowerCase();
  if (mimeType === 'application/x-www-form-urlencoded' || mimeType === 'multipart/form-data') {
    payload.params = postData.params?.length
      ? postData.params.map(param => ({ name: param.name, value: param.value ?? '', fileName: param.fileName }))
      : mimeType === 'application/x-www-form-urlencoded' && typeof postData.text === 'string'
        ? [...new URLSearchParams(postData.text)].map(([name, value]) => ({ name, value })) : [];
    if (payload.params.length) { payload.kind = 'form'; return payload; }
  }
  if (typeof postData.text === 'string') {
    payload.body = postData.text;
    payload.kind = 'text';
    if (mimeType === 'application/json' || mimeType.endsWith('+json')) {
      try { payload.body = JSON.parse(postData.text); payload.kind = 'json'; } catch { /* Preserve raw text. */ }
    }
  } else {
    payload.kind = 'unavailable';
  }
  return payload;
}

export function createNetworkMonitor(chromeApi, onEntry, onBody) {
  let generation = 0;
  const event = chromeApi?.devtools?.network?.onRequestFinished;
  const listener = request => {
    if (!(request.response?.content?.mimeType || '').toLowerCase().includes('json')) return;
    const entry = {
      id: crypto.randomUUID(), url: request.request.url,
      method: request.request.method, status: request.response.status,
      time: Math.round(request.time), body: null, bodyState: 'loading',
      payload: parseRequestPayload(request.request)
    };
    const currentGeneration = generation;
    // Add first, even when getContent invokes its callback synchronously.
    onEntry(entry);
    const finish = result => {
      if (generation === currentGeneration) onBody(entry.id, result);
    };
    try {
      request.getContent((content, encoding) => {
        const error = chromeApi.runtime?.lastError;
        finish(error
          ? { body: null, bodyState: 'error', bodyError: error.message }
          : parseResponse(content, encoding));
      });
    } catch (error) {
      finish({ body: null, bodyState: 'error', bodyError: error.message });
    }
  };
  event?.addListener(listener);
  return {
    clear() { generation++; },
    destroy() { generation++; event?.removeListener(listener); }
  };
}

export function createCookieLoader(chromeApi, publish) {
  let generation = 0;
  return {
    cancel() { generation++; },
    load(url) {
      const currentGeneration = ++generation;
      publish({ cookies: [], state: 'loading', error: '' });
      const finish = result => {
        if (generation === currentGeneration) publish(result);
      };
      if (!chromeApi?.cookies?.getAll) {
        finish({ cookies: [], state: 'error', error: 'Cookie API is unavailable.' });
        return;
      }
      try {
        chromeApi.cookies.getAll({ url }, cookies => {
          // Read lastError even for stale callbacks to acknowledge Chrome errors.
          const error = chromeApi.runtime?.lastError;
          finish(error
            ? { cookies: [], state: 'error', error: error.message }
            : { cookies: cookies || [], state: 'ready', error: '' });
        });
      } catch (error) {
        finish({ cookies: [], state: 'error', error: error.message });
      }
    }
  };
}
