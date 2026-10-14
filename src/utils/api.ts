import { liveFetch } from './live-fetch';
export const API_ORIGIN = window.electronAPI?.config?.apiOrigin || 'https://nisaab360.app';
export const BASE_URL = window.electronAPI?.config?.apiBaseUrl || `${API_ORIGIN}/api`;

export const getAuthToken = () => localStorage.getItem('nisaab_token');
export const getRefreshToken = () => localStorage.getItem('nisaab_refresh_token');
export const setAuthToken = (token: string) => localStorage.setItem('nisaab_token', token);
export const setAuthTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem('nisaab_token', accessToken);
  localStorage.setItem('nisaab_refresh_token', refreshToken);
};
export const removeAuthToken = () => {
  localStorage.removeItem('nisaab_token');
  localStorage.removeItem('nisaab_refresh_token');
  localStorage.removeItem('password_change_required');
  sessionStorage.removeItem('campus_view');
  sessionStorage.removeItem('campus_name');
};

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('Session expired');
    const response = await liveFetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) throw new Error('Session expired');
    const data = await response.json();
    if (!data.accessToken || !data.refreshToken) throw new Error('Session expired');
    setAuthTokens(data.accessToken, data.refreshToken);
    await window.electronAPI?.auth?.setToken?.(data.accessToken);
    return data.accessToken as string;
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function expireSession() {
  removeAuthToken();
  window.electronAPI?.auth?.clearToken?.();
  window.dispatchEvent(new Event('auth-changed'));
  window.location.hash = '#/login';
}

type ResponseType = 'json' | 'blob' | 'text';

type RequestOptions = {
  headers?: Record<string, string>;
  responseType?: ResponseType;
  signal?: AbortSignal;
};

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function hasElectronBridge() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.data?.request);
}

// These modules depend on current server state and must never be satisfied by
// the offline SQLite cache or queued as optimistic generic writes.
function requiresLiveServer(endpoint: string) {
  return Boolean(sessionStorage.getItem('campus_view'))
    || endpoint.startsWith('/auth/')
    || endpoint.startsWith('/institution/workspace')
    || endpoint.startsWith('/institution/campuses')
    || endpoint.startsWith('/institution/campus-view')
    || endpoint.startsWith('/institution/public-events')
    || endpoint.startsWith('/institution/restore-requests')
    || endpoint.startsWith('/institution/students/auto-promote')
    || endpoint.startsWith('/institution/settings/payment-accounts')
    || endpoint.startsWith('/course-streaming')
    || endpoint.startsWith('/institution/courses')
    || /^\/institution\/(students|staff)\/\d+/.test(endpoint)
    || endpoint.startsWith('/institution/public-site')
    || endpoint.startsWith('/institution/admissions')
    || endpoint.startsWith('/institution/fees')
    || endpoint.startsWith('/institution/academics')
    || endpoint.startsWith('/institution/staff-profile-requests')
    || endpoint.startsWith('/institution/student-profile-requests')
    || endpoint.startsWith('/institution/logo')
    || endpoint.startsWith('/institution/signature')
    || endpoint.startsWith('/institution/settings/google-drive')
    || endpoint.startsWith('/institution/settings/payment-gateway')
    || endpoint.startsWith('/upload/');
}

async function parseResponse(response: Response, responseType: ResponseType) {
  if (responseType === 'blob') return response.blob();
  if (responseType === 'text') return response.text();

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

async function remoteRequest(method: string, endpoint: string, data?: unknown, options: RequestOptions = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  const responseType = options.responseType || 'json';

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const config: RequestInit = {
    method,
    headers,
    signal: options.signal,
  };

  if (data !== undefined) {
    if (isFormData(data)) {
      config.body = data;
    } else {
      headers.set('Content-Type', 'application/json');
      config.body = JSON.stringify(data);
    }
  }

  let response = await liveFetch(`${BASE_URL}${endpoint}`, config);

  if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
    try {
      const nextAccessToken = await refreshAccessToken();
      headers.set('Authorization', `Bearer ${nextAccessToken}`);
      response = await liveFetch(`${BASE_URL}${endpoint}`, config);
    } catch {
      expireSession();
      throw new Error('Session expired. Please sign in again.');
    }
  }

  if (response.status === 401) {
    expireSession();
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorData.message || errorMsg;
    } catch {
      try {
        errorMsg = await response.text();
      } catch {
        // ignore
      }
    }
    throw new Error(errorMsg);
  }

  return parseResponse(response, responseType);
}

export const api = {
  defaults: {
    baseURL: BASE_URL,
  },

  async request(method: string, endpoint: string, data?: unknown, options: RequestOptions = {}) {
    if (hasElectronBridge() && options.responseType !== 'blob' && !requiresLiveServer(endpoint)) {
      try {
        const result = await window.electronAPI!.data.request(method, endpoint, data, getAuthToken());
        if (method.toUpperCase() === 'POST' && endpoint === '/auth/login') {
          return result;
        }
        return result;
      } catch (error: any) {
        if (error?.message?.includes('Unauthorized')) {
          try {
            const nextAccessToken = await refreshAccessToken();
            return await window.electronAPI!.data.request(method, endpoint, data, nextAccessToken);
          } catch {
            expireSession();
          }
        }
        throw error;
      }
    }

    return remoteRequest(method, endpoint, data, options);
  },

  get(endpoint: string, options?: RequestOptions) {
    return this.request('GET', endpoint, undefined, options);
  },

  post(endpoint: string, data?: unknown, options?: RequestOptions) {
    return this.request('POST', endpoint, data, options);
  },

  put(endpoint: string, data?: unknown, options?: RequestOptions) {
    return this.request('PUT', endpoint, data, options);
  },

  patch(endpoint: string, data?: unknown, options?: RequestOptions) {
    return this.request('PATCH', endpoint, data, options);
  },

  delete(endpoint: string, data?: unknown, options?: RequestOptions) {
    return this.request('DELETE', endpoint, data, options);
  },
};

export async function runInitialSync(token: string) {
  if (window.electronAPI?.sync?.initial) {
    await window.electronAPI.auth.setToken(token);
    return window.electronAPI.sync.initial(token);
  }
  return { success: true, skipped: true };
}

export async function getSyncStatus() {
  if (window.electronAPI?.sync?.status) {
    return window.electronAPI.sync.status();
  }
  return null;
}
