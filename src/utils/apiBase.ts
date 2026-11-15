const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').trim();

export function joinApiBase(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL.replace(/\/+$/, '');
}

export function apiUrl(path: string): string {
  return joinApiBase(getApiBaseUrl(), path);
}
