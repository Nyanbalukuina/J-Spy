<script>
  import { onMount } from 'svelte';
  import JSONTree from '@sveltejs/svelte-json-tree';
  import { createNetworkMonitor, createCookieLoader } from './lib/monitor.js';

  let apis = $state([]);
  let selected = $state(null);
  let cookieResult = $state({ cookies: [], state: 'ready', error: '' });
  let monitor;
  const chromeApi = typeof chrome === 'undefined' ? undefined : chrome;
  const isPreview = import.meta.env.DEV && !chromeApi?.devtools?.network;
  let active = true;
  const cookieLoader = createCookieLoader(chromeApi, result => { cookieResult = result; });

  async function loadSamples() {
    if (!isPreview) return;
    const { createPreviewEntries } = await import('./lib/preview.js');
    if (!active) return;
    backToList();
    apis = createPreviewEntries();
  }

  onMount(() => {
    active = true;
    if (isPreview) {
      void loadSamples();
      return () => { active = false; cookieLoader.cancel(); };
    }
    monitor = createNetworkMonitor(chromeApi,
      entry => { apis = [entry, ...apis].slice(0, 100); },
      (id, result) => {
        apis = apis.map(api => api.id === id ? { ...api, ...result } : api);
        if (selected?.id === id) selected = { ...selected, ...result };
      });
    return () => { active = false; monitor.destroy(); cookieLoader.cancel(); };
  });

  function getApiName(url) {
    try {
      const parsed = new URL(url);
      return parsed.pathname.split('/').filter(Boolean).at(-1) || parsed.hostname;
    } catch { return url; }
  }

  function getStatusLabel(status) {
    if (status >= 200 && status < 300) return 'Success';
    if (status >= 300 && status < 400) return 'Redirect';
    if (status >= 400 && status < 500) return 'Client error';
    if (status >= 500 && status < 600) return 'Server error';
    if (status >= 100 && status < 200) return 'Informational';
    return 'Unknown';
  }

  function showDetail(api) {
    selected = api;
    if (isPreview) {
      cookieResult = { cookies: api.previewCookies || [], state: 'ready', error: '' };
    } else {
      cookieLoader.load(api.url);
    }
  }

  function backToList() {
    cookieLoader.cancel();
    cookieResult = { cookies: [], state: 'ready', error: '' };
    selected = null;
  }

  function clearAll() {
    monitor?.clear();
    apis = [];
    backToList();
  }
</script>

<div class="api-checker-root">
  <header class="header">
    <div class="header-left">
      <span class="title">J-Spy</span>
      <span class="count">{apis.length} items</span>
      {#if isPreview}<span class="preview-badge">SAMPLE DATA</span>{/if}
    </div>
    <div class="header-actions">
      {#if isPreview}<button class="clear-btn" onclick={loadSamples}>Reset Samples</button>{/if}
      <button class="clear-btn danger" onclick={clearAll}>Clear All</button>
    </div>
  </header>

  <main class="content">
    {#if !selected}
      <div class="list-container">
        <div class="list-head" aria-hidden="true">
          <span>Method</span><span>Endpoint</span><span>Status</span><span class="align-right">Time</span>
        </div>
        <div class="list-body">
          {#each apis as api (api.id)}
            <button class="row" onclick={() => showDetail(api)}>
              <div class="col-method">
                <span class="method-tag" data-method={api.method}>{api.method}</span>
              </div>
              <div class="col-main">
                <div class="primary-text" title={getApiName(api.url)}>{getApiName(api.url)}</div>
                <div class="secondary-text" title={api.url}>{api.url}</div>
              </div>
              <div class="col-status">
                <span class="status-num" data-status={api.status}>{api.status}</span>
                <span class="status-label">{getStatusLabel(api.status)}</span>
              </div>
              <span class="time-text">{api.time} ms</span>
            </button>
          {:else}
            <div class="empty-msg">
              <span class="empty-title">No JSON requests yet</span>
              <span>{isPreview ? 'Use Reset Samples to restore the preview.' : 'Reload the page or perform an action to capture JSON requests.'}</span>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="detail-view">
        <div class="detail-toolbar">
          <button class="back-btn" onclick={backToList}>← Back to requests</button>
        </div>

        <div class="detail-scroll">
          <section>
            <h2 class="label">Request</h2>
            <div class="endpoint-meta">
              <span class="method-tag" data-method={selected.method}>{selected.method}</span>
              <span class="col-status"><span class="status-num" data-status={selected.status}>{selected.status}</span><span class="status-label">{getStatusLabel(selected.status)}</span></span>
              <span class="time-text">{selected.time} ms</span>
            </div>
            <div class="url-display">{selected.url}</div>
          </section>

          <section>
            <h2 class="label">Response body <span class="section-meta">JSON</span></h2>
            <div class="code-container tree-mode">
              {#if selected.bodyState === 'loading'}
                <div class="no-data">Loading response...</div>
              {:else if selected.bodyState === 'error'}
                <div class="no-data">Could not load response: {selected.bodyError}</div>
              {:else if selected.bodyState === 'empty'}
                <div class="no-data">No response body.</div>
              {:else if typeof selected.body === 'object' && selected.body !== null}
                <JSONTree value={selected.body} defaultExpandedLevel={1} />
              {:else}
                <pre><code>{typeof selected.body === 'string' ? selected.body : JSON.stringify(selected.body)}</code></pre>
              {/if}
            </div>
          </section>

          <section>
            <h2 class="label">Cookies <span class="section-meta">{cookieResult.state === 'ready' ? cookieResult.cookies.length + ' for this URL' : 'For this URL'}</span></h2>
            <div class="cookie-list">
              {#if cookieResult.state === 'loading'}
                <div class="no-data">Loading cookies...</div>
              {:else if cookieResult.state === 'error'}
                <div class="no-data">Could not load cookies: {cookieResult.error}</div>
              {:else}
                {#each cookieResult.cookies as cookie}
                  <div class="cookie-item"><span class="cookie-name">{cookie.name}</span><span class="cookie-value">{cookie.value}</span></div>
                {:else}
                  <div class="no-data">No cookies found for this URL.</div>
                {/each}
              {/if}
            </div>
          </section>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
:global(html) { color-scheme: dark; }
:global(html, body) { margin: 0; padding: 0; background: #111820; color: #edf2f7; font-family: system-ui, -apple-system, 'Segoe UI', 'Meiryo', sans-serif; overflow: hidden; text-align: left; }
:global(body *) { box-sizing: border-box; }
.api-checker-root {
  --bg: #111820; --surface: #18222e; --hover: #223244;
  --text: #edf2f7; --muted: #aab8c8; --line: #334457;
  --accent: #96c8ff; --success: #86d9af; --warning: #ffd38a; --danger: #ffb0b6;
  --mono: 'Cascadia Code', Consolas, Monaco, monospace;
  display: flex; flex-direction: column; height: 100dvh; width: 100%; background: var(--bg); font-size: 14px; line-height: 1.5;
}
.header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 14px 20px; background: var(--surface); border-bottom: 1px solid var(--line); }
.header-left, .header-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.title { font-size: 18px; font-weight: 700; letter-spacing: -.02em; }
.count { color: var(--muted); font-size: 13px; border-left: 1px solid var(--line); padding-left: 12px; font-variant-numeric: tabular-nums; }
.preview-badge { color: var(--warning); background: #302b20; border: 1px solid #78613c; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 600; letter-spacing: .04em; }
.clear-btn, .back-btn { min-height: 36px; border: 1px solid #687d94; border-radius: 6px; background: transparent; color: var(--text); font: inherit; font-size: 13px; font-weight: 500; padding: 6px 12px; cursor: pointer; }
.clear-btn:hover, .back-btn:hover { background: var(--hover); border-color: var(--accent); }
.clear-btn.danger:hover { color: var(--danger); border-color: var(--danger); background: #34242e; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.content, .list-container, .detail-view { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.content { overflow: hidden; }
.list-head, .row { display: grid; grid-template-columns: 72px minmax(0, 1fr) 132px 84px; align-items: center; gap: 16px; padding: 12px 20px; }
.list-head { flex-shrink: 0; color: var(--muted); background: var(--surface); font-size: 12px; font-weight: 600; border-bottom: 1px solid var(--line); }
.list-head .align-right { text-align: right; }
.list-container { overflow-y: auto; scrollbar-gutter: stable; }
.list-head { position: sticky; top: 0; z-index: 1; }
.list-body { flex: 1; min-height: 0; }
.row { width: 100%; min-height: 72px; border: 0; border-bottom: 1px solid var(--line); border-left: 3px solid transparent; padding-left: 17px; background: var(--bg); color: var(--text); font: inherit; text-align: left; cursor: pointer; }
.row:nth-child(even) { background: #151e29; }
.row:hover { background: var(--hover); border-left-color: var(--accent); }
.row:focus-visible { outline-offset: -3px; background: var(--hover); }
.col-main { min-width: 0; }
.method-tag { display: inline-block; color: #d6c4ff; background: #2d263e; border: 1px solid #6e5b91; border-radius: 4px; padding: 3px 6px; font-family: var(--mono); font-size: 12px; font-weight: 700; }
.method-tag[data-method='GET'] { color: var(--accent); background: #203247; border-color: #577ba3; }
.method-tag[data-method='POST'] { color: var(--success); background: #1d352d; border-color: #507f68; }
.method-tag[data-method='PUT'], .method-tag[data-method='PATCH'] { color: var(--warning); background: #352d20; border-color: #8a724c; }
.method-tag[data-method='DELETE'] { color: var(--danger); background: #34242e; border-color: #93616e; }
.primary-text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; margin-bottom: 3px; }
.secondary-text { display: block; color: var(--muted); font-family: var(--mono); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-status { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.status-num { color: var(--muted); font-family: var(--mono); font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
.status-num[data-status^='2'] { color: var(--success); }
.status-num[data-status^='3'] { color: var(--accent); }
.status-num[data-status^='4'] { color: var(--warning); }
.status-num[data-status^='5'] { color: var(--danger); }
.status-label { color: var(--muted); font-size: 12px; }
.time-text { color: var(--muted); font-family: var(--mono); font-size: 13px; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.detail-toolbar { padding: 12px 20px; background: var(--surface); border-bottom: 1px solid var(--line); }
.detail-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 20px; }
section { margin-bottom: 24px; }
.label { display: flex; gap: 10px; align-items: center; margin: 0 0 10px; color: var(--text); font-size: 14px; font-weight: 600; }
.section-meta { color: var(--muted); font-size: 12px; font-weight: 400; }
.endpoint-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-bottom: 12px; }
.endpoint-meta .col-status { flex-direction: row; align-items: baseline; gap: 8px; }
.url-display { color: var(--accent); font-family: var(--mono); font-size: 13px; overflow-wrap: anywhere; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; }
.code-container { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; overflow-x: auto; }
.code-container pre { margin: 0; }
code { color: #d6c4ff; font-family: var(--mono); font-size: 14px; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.cookie-list { border: 1px solid var(--line); border-radius: 8px; background: var(--surface); overflow: hidden; }
.cookie-item { display: grid; grid-template-columns: minmax(100px, 180px) minmax(0, 1fr); gap: 16px; padding: 12px 16px; font-family: var(--mono); font-size: 13px; overflow-wrap: anywhere; }
.cookie-item + .cookie-item { border-top: 1px solid var(--line); }
.cookie-name { color: var(--text); font-weight: 600; }
.cookie-value { color: var(--muted); }
.no-data { color: var(--muted); padding: 16px; font-size: 14px; }
.empty-msg { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 64px 24px; text-align: center; color: var(--muted); }
.empty-title { color: var(--text); font-size: 16px; font-weight: 600; }
.code-container.tree-mode {
  --json-tree-font-family: var(--mono); --json-tree-font-size: 14px; --json-tree-li-line-height: 1.65; --json-tree-li-indentation: 1.35em;
  --json-tree-property-color: #edf2f7; --json-tree-label-color: #aab8c8;
  --json-tree-arrow-color: #aab8c8; --json-tree-operator-color: #aab8c8; --json-tree-internal-color: #aab8c8;
  --json-tree-string-color: #a7dfb5; --json-tree-number-color: #96c8ff; --json-tree-boolean-color: #d6c4ff;
  --json-tree-null-color: #ffd38a; --json-tree-undefined-color: #ffd38a;
}
@media (max-width: 600px) {
  .header { padding: 12px; gap: 10px; }
  .list-head, .row { grid-template-columns: 60px minmax(0, 1fr) 66px 64px; gap: 10px; padding-right: 12px; }
  .list-head { padding-left: 12px; }
  .row { padding-left: 9px; }
  .status-label { display: none; }
  .endpoint-meta .status-label { display: inline; }
  .detail-scroll { padding: 20px 12px; }
  .detail-toolbar { padding: 12px; }
  .cookie-item { grid-template-columns: 1fr; gap: 4px; }
}
@media (max-width: 380px) {
  .list-head, .row { grid-template-columns: 52px minmax(0, 1fr) 42px 58px; gap: 6px; }
  .method-tag { font-size: 11px; padding: 3px 4px; }
}
</style>
