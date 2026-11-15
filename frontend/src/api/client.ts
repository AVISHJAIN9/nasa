/**
 * AstroCare Unified API Client
 * - Targets /api/v1 (or /v1) through single origin proxy / gateway
 * - Unwraps { status: 'success', data } and handles raw payloads
 * - Rich ApiError structure
 * - Injects JWT Authorization header
 * - Automatic single-retry on 401 using refresh token
 */

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  requestId?: string;

  constructor(status: number, message: string, code = 'API_ERROR', details: unknown = null, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
  retryOn401?: boolean;
}

const TOKEN_KEY = 'astrocare_token';
const REFRESH_TOKEN_KEY = 'astrocare_refresh_token';
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function apiUrl(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const path = endpoint.startsWith('/') ? endpoint : `/api/v1/${endpoint}`;
  return `${API_BASE_URL}${path}`;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredTokens(token: string, refreshToken?: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(apiUrl('/api/v1/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!res.ok) {
      clearStoredTokens();
      return null;
    }
    const data = await res.json();
    const newToken = data?.data?.token || data?.token || data?.access_token;
    const newRefresh = data?.data?.refresh_token || data?.refresh_token;
    if (newToken) {
      setStoredTokens(newToken, newRefresh);
      return newToken;
    }
    return null;
  } catch {
    clearStoredTokens();
    return null;
  }
}

export async function apiClient<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, skipAuth = false, retryOn401 = true, headers: customHeaders, ...fetchOptions } = options;

  let url = apiUrl(endpoint);

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.append(k, String(v));
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(customHeaders as Record<string, string> || {})
  };

  if (!(fetchOptions.body instanceof FormData) && !headers['Content-Type'] && fetchOptions.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  if (!skipAuth) {
    const token = getStoredToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers
    });
  } catch (err: unknown) {
    throw new ApiError(0, err instanceof Error ? err.message : 'Network error connection refused', 'NETWORK_ERROR');
  }

  // Handle 401 with silent token refresh retry
  if (response.status === 401 && retryOn401 && !skipAuth) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await tryRefreshToken();
      isRefreshing = false;
      if (newToken) {
        onRefreshed(newToken);
        return apiClient<T>(endpoint, { ...options, retryOn401: false });
      }
    } else {
      return new Promise((resolve, reject) => {
        refreshSubscribers.push((token: string) => {
          options.headers = { ...options.headers, Authorization: `Bearer ${token}` };
          apiClient<T>(endpoint, { ...options, retryOn401: false }).then(resolve).catch(reject);
        });
      });
    }
  }

  const requestId = response.headers.get('X-Request-ID') || undefined;
  let parsed: unknown = null;
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
  } else {
    parsed = await response.text();
  }

  if (!response.ok) {
    let code = 'HTTP_' + response.status;
    let message = `Request failed with status ${response.status}`;
    let details: unknown = null;

    if (parsed && typeof parsed === 'object') {
      const p = parsed as Record<string, unknown>;
      message = (p.message || p.error || p.detail || message) as string;
      code = (p.code || code) as string;
      details = p.details || p.error || null;
    }

    throw new ApiError(response.status, message, code, details, requestId);
  }

  // Unwrap standard { status: 'success', data } envelope
  if (parsed && typeof parsed === 'object' && 'status' in parsed && (parsed as Record<string, unknown>).status === 'success' && 'data' in parsed) {
    return (parsed as Record<string, unknown>).data as T;
  }

  return parsed as T;
}

export const api = {
  get: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined
    }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined
    }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined
    }),

  delete: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'DELETE' })
};
