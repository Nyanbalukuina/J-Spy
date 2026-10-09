import { parseRequestPayload } from './monitor.js';

// Fictional fixtures, loaded only by the Vite development server.
export function createPreviewEntries() {
  const cookies = [
    { name: 'demo_session', value: 'sample-session-not-a-real-token' },
    { name: 'theme', value: 'dark' },
    { name: 'locale', value: 'ja-JP' }
  ];
  const scenarios = [
    ['GET', '/v1/users?page=1&limit=20', 200, 84, { data: [
      { id: 101, name: '山田 太郎', email: 'taro@example.test', active: true, roles: ['admin', 'editor'], profile: { avatar: null, language: 'ja', notifications: { email: true, push: false } } },
      { id: 102, name: '鈴木 花子', email: 'hanako@example.test', active: false, roles: ['viewer'], profile: null }
    ], pagination: { page: 1, total: 42, hasNext: true } }],
    ['POST', '/v1/orders', 201, 236, { id: 'ORD-2026-001', status: 'created', items: [{ sku: 'BOOK-01', name: 'サンプル商品', quantity: 2, price: 1800 }], total: 3600, currency: 'JPY' }],
    ['GET', '/v1/dashboard/metrics', 200, 42, { visitors: 12345, conversionRate: 0.032, revenue: 987600, series: [12, 18, 9, 25, 31], updatedAt: '2026-10-07T12:00:00Z' }],
    ['PATCH', '/v1/users/101/settings', 200, 119, { saved: true, changes: { theme: 'dark', notifications: false } }],
    ['DELETE', '/v1/orders/expired', 204, 63, null, 'empty'],
    ['GET', '/v1/products/search?q=monitor&category=development&sort=price&include=reviews,inventory,shipping', 200, 320, [{ id: 1, name: 'Developer Monitor', tags: ['display', '4K'], description: 'A long sample description to check text wrapping in a narrow DevTools panel. 日本語の長い文章も表示を確認できます。' }]],
    ['POST', '/v1/auth/login', 401, 92, { error: { code: 'UNAUTHORIZED', message: '認証に失敗しました。ログイン情報を確認してください。' }, requestId: 'demo-request-401' }],
    ['GET', '/v1/products/missing', 404, 55, { error: 'Not found', details: null }],
    ['GET', '/v1/reports/export', 500, 1842, { error: { code: 'INTERNAL_ERROR', message: 'レポートの生成に失敗しました。', retryable: true } }],
    ['GET', '/v1/features/enabled', 200, 18, false],
    ['GET', '/v1/cart/count', 200, 21, 0],
    ['GET', '/v1/profile/avatar', 200, 27, null],
    ['GET', '/v1/debug/malformed', 200, 34, '{"message": "Incomplete JSON",'],
    ['GET', '/v1/debug/pending', 200, 88, null, 'loading'],
    ['GET', '/v1/debug/unavailable', 200, 103, null, 'error']
  ];
  return scenarios.map(([method, endpoint, status, time, body, bodyState = 'ready'], index) => ({
    id: 'preview-' + index,
    url: 'https://api.example.test' + endpoint,
    method, status, time, body, bodyState,
    payload: parseRequestPayload({
      url: 'https://api.example.test' + endpoint,
      postData: index === 1 ? { mimeType: 'application/json', text: JSON.stringify({ items: [{ sku: 'BOOK-01', quantity: 2 }], currency: 'JPY' }) }
        : index === 3 ? { mimeType: 'application/json', text: JSON.stringify({ theme: 'dark', notifications: false }) }
        : index === 6 ? { mimeType: 'application/x-www-form-urlencoded', text: 'email=demo%40example.test&password=sample-only' }
        : undefined
    }),
    bodyError: bodyState === 'error' ? 'Sample response is unavailable.' : '',
    previewCookies: index === 7 ? [] : cookies.map(cookie => ({ ...cookie }))
  }));
}
