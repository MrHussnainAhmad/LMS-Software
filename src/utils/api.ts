export const API_ORIGIN = window.electronAPI?.config?.apiOrigin || 'https://nisaab360.app';
export const BASE_URL = window.electronAPI?.config?.apiBaseUrl || `${API_ORIGIN}/api`;

export const getAuthToken = () => localStorage.getItem('nisaab_token');
export const setAuthToken = (token: string) => localStorage.setItem('nisaab_token', token);
export const removeAuthToken = () => localStorage.removeItem('nisaab_token');

type ResponseType = 'json' | 'blob' | 'text';

type RequestOptions = {
  headers?: Record<string, string>;
  responseType?: ResponseType;
};

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function hasElectronBridge() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.data?.request);
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
  };

  if (data !== undefined) {
    if (isFormData(data)) {
      config.body = data;
    } else {
      headers.set('Content-Type', 'application/json');
      config.body = JSON.stringify(data);
    }
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (response.status === 401) {
    removeAuthToken();
    window.electronAPI?.auth?.clearToken?.();
    window.location.hash = '#/login';
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
    if (hasElectronBridge() && options.responseType !== 'blob') {
      try {
        const result = await window.electronAPI!.data.request(method, endpoint, data, getAuthToken());
        if (method.toUpperCase() === 'POST' && endpoint === '/auth/login') {
          return result;
        }
        return result;
      } catch (error: any) {
        if (error?.message?.includes('Unauthorized')) {
          removeAuthToken();
          window.location.hash = '#/login';
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
