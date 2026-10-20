const BASE_URL = '/api';

function getToken(): string | null {
  return localStorage.getItem('maestro_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: any; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (name: string, email: string, password: string) =>
      request<{ user: any; token: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  },
  users: {
    me: () => request<any>('/users/me'),
  },
  songs: {
    list: (params: Record<string, string> = {}) => request<any[]>(`/songs?${new URLSearchParams(params)}`),
    getById: (id: string) => request<any>(`/songs/${id}`),
    getMidi: (id: string, versionId?: string) => request<any>(`/songs/${id}/midi${versionId ? `?versionId=${versionId}` : ''}`),
    favorite: (id: string) => request<void>(`/songs/${id}/favorite`, { method: 'POST' }),
    unfavorite: (id: string) => request<void>(`/songs/${id}/favorite`, { method: 'DELETE' }),
    listFavorites: () => request<any[]>('/songs/favorites'),
  },
  performances: {
    submit: (body: any) => request<any>('/performances', { method: 'POST', body: JSON.stringify(body) }),
    list: (limit = 20) => request<any[]>(`/performances?limit=${limit}`),
    getById: (id: string) => request<any>(`/performances/${id}`),
  },
  progress: {
    list: () => request<any[]>('/progress'),
    getForSong: (songId: string) => request<any>(`/progress/${songId}`),
  },
  library: {
    summary: () => request<any>('/library'),
  },
  analysis: {
    dashboard: () => request<any>('/analysis/dashboard'),
  },
};

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem('maestro_token', token);
  else localStorage.removeItem('maestro_token');
}
