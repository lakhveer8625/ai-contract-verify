import { Audit } from '@/types/audit';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type AuthResponse = {
  accessToken: string;
  user: { id: string; email: string; name?: string; company?: string; role: string };
};

export function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = Array.isArray(json.message) ? json.message.join(', ') : (json.message ?? text);
    } catch { /* not JSON — use raw text */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<AuthResponse['user']>('/auth/me'),
  login: (email: string, password: string) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload: { email: string; password: string; name?: string; company?: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  createAudit: (payload: { title: string; contracts: Array<{ fileName: string; source: string }> }) =>
    request<Audit>('/audit', { method: 'POST', body: JSON.stringify(payload) }),
  uploadAudit: (form: FormData) => request<Audit>('/audit/upload', { method: 'POST', body: form }),
  audit: (id: string) => request<Audit>(`/audit/${id}`),
  history: () => request<Audit[]>('/audit/history'),
  reportUrl: (id: string) => `${API_URL}/reports/${id}`
};
