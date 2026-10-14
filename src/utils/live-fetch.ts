import { API_ORIGIN, getAuthToken, getRefreshToken, setAuthTokens, expireSession } from './api';

let refresh: Promise<void> | null = null;
export async function refreshSession(failedToken: string | null): Promise<string> {
  const current = getAuthToken();
  if (current && current !== failedToken) return current;
  if (!refresh) refresh = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new Error('Session expired');
      const result = await liveFetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
      if (!result.ok) throw new Error('Session expired');
      const data = await result.json();
      if (!data.accessToken || !data.refreshToken) throw new Error('Session expired');
      setAuthTokens(data.accessToken, data.refreshToken);
      await window.electronAPI?.auth.setToken(data.accessToken);
    } catch {
      expireSession();
      throw new Error('Session expired. Please sign in again.');
    }
  })().finally(() => { refresh = null; });
  await refresh;
  const token = getAuthToken();
  if (!token) throw new Error('Session expired. Please sign in again.');
  return token;
}
export async function liveFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  const original = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(original, API_ORIGIN);
  if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/api/')) return fetch(input, init);
  const endpoint = url.pathname + url.search;
  const method = (init.method || 'GET').toUpperCase();
  const campusView = sessionStorage.getItem('campus_view');
  if (campusView && !['GET', 'HEAD'].includes(method) && !['/api/institution/campus-view', '/api/auth/logout', '/api/auth/refresh'].includes(endpoint)) {
    return Response.json({ error: 'This campus is read-only. Return to your campus to make changes.' }, { status: 403 });
  }
  let sentToken: string | null = null;
  async function send() {
    if (init.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    const headers = new Headers(init.headers);
    const token = getAuthToken();
    sentToken = token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (campusView) headers.set('X-Campus-View', campusView);
    if (!window.electronAPI?.data.live) return fetch(url, { ...init, headers });
    const form: Array<{name: string; value?: string; bytes?: Uint8Array; filename?: string; type?: string}> = [];
    if (init.body instanceof FormData) {
      for (const [name, value] of init.body.entries()) {
        form.push(typeof value === 'string' ? { name, value } : { name, filename: value.name, type: value.type, bytes: new Uint8Array(await value.arrayBuffer()) });
      }
    }
    const result = await window.electronAPI.data.live({ endpoint, method, headers: Object.fromEntries(headers.entries()),
      ...(init.body instanceof FormData ? { form } : init.body ? { body: String(init.body) } : {}) });
    if (init.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    return new Response([204, 205, 304].includes(result.status) ? null : new Uint8Array(result.bytes), { status: result.status, headers: result.headers });
  }
  let response = await send();
  const canRefresh = !['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'].includes(url.pathname);
  if (response.status === 401 && canRefresh) {
    // Another request may already have refreshed while this response was in
    // flight. Reuse that token instead of rotating it a second time.
    await refreshSession(sentToken);
    response = await send();
    if (response.status === 401) expireSession();
  }
  if (response.status === 403) {
    const error = await response.clone().json().catch(() => ({}));
    if (error.error === 'PASSWORD_CHANGE_REQUIRED') {
      localStorage.setItem('password_change_required', '1');
      window.dispatchEvent(new Event('auth-changed'));
      window.location.hash = '#/change-password';
    }
  }
  return response;
}
