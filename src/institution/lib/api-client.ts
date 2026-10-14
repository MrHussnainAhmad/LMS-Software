import { desktopFetch } from './desktop-fetch';
import { apiErrorMessage } from './validation-errors';
export class ApiError extends Error {
  status: number;
  data: unknown;
  fieldErrors: Record<string, string[]>;
  constructor(status: number, data: any) {
    super(apiErrorMessage(data, status));
    this.status = status; this.data = data; this.fieldErrors = data?.fieldErrors || {};
  }
}
async function request<T>(url: string, options: RequestInit): Promise<T> {
  const response = await desktopFetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}
const write = <T>(method: string, url: string, body: unknown, options?: RequestInit) => request<T>(url, { ...options, method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const api = {
  get: <T>(url: string, options?: RequestInit) => request<T>(url, { ...options, method: 'GET' }),
  post: <T>(url: string, body: unknown, options?: RequestInit) => write<T>('POST', url, body, options),
  put: <T>(url: string, body: unknown, options?: RequestInit) => write<T>('PUT', url, body, options),
  patch: <T>(url: string, body: unknown, options?: RequestInit) => write<T>('PATCH', url, body, options),
  delete: <T>(url: string, options?: RequestInit) => request<T>(url, { ...options, method: 'DELETE' }),
};
