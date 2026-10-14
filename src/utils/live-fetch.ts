import { API_ORIGIN, getAuthToken, getRefreshToken, setAuthTokens, removeAuthToken } from './api';

let refresh: Promise<void> | null = null;
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
  async function send() {
    if (init.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    const headers = new Headers(init.headers);
    const token = getAuthToken();
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
  if (response.status === 401 && !endpoint.startsWith('/api/auth/')) {
    if (!refresh) refresh = (async () => {
      const result = await liveFetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: getRefreshToken() }) });
      if (!result.ok) { removeAuthToken(); sessionStorage.removeItem('campus_view'); window.dispatchEvent(new Event('auth-changed')); throw new Error('Session expired. Please sign in again.'); }
      const data = await result.json();
      setAuthTokens(data.accessToken, data.refreshToken);
      await window.electronAPI?.auth.setToken(data.accessToken);
    })().finally(() => { refresh = null; });
    await refresh;
    response = await send();
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
