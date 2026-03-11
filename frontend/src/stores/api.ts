const API_BASE = '';

function getToken(): string | null {
  return localStorage.getItem('akdn_token');
}

export function setToken(token: string) {
  localStorage.setItem('akdn_token', token);
}

export function clearToken() {
  localStorage.removeItem('akdn_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export async function api(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: any = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
