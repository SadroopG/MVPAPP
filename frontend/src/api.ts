import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('auth_token');
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request(path: string, opts: RequestInit = {}) {
  const url = `${API_BASE}/api${path}`;
  const headers = await authHeaders();
  const res = await fetch(url, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function formRequest(path: string, body: FormData) {
  const url = `${API_BASE}/api${path}`;
  const token = await getToken();
  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers: h, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function formPut(path: string, body: FormData) {
  const url = `${API_BASE}/api${path}`;
  const token = await getToken();
  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'PUT', headers: h, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  register: (email: string, password: string, name: string) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => request('/auth/me'),

  // Expos
  getExpos: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/expos${qs ? `?${qs}` : ''}`);
  },
  getExpo: (id: string) => request(`/expos/${id}`),
  getExpoFilters: () => request('/expos/meta/filters'),

  // Companies
  getCompanies: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/companies${qs ? `?${qs}` : ''}`);
  },
  getCompany: (id: string) => request(`/companies/${id}`),
  updateStage: (cid: string, stage: string) => {
    const fd = new FormData(); fd.append('stage', stage);
    return formPut(`/companies/${cid}/stage`, fd);
  },
  getCompanyFilters: (expoId?: string) => request(`/companies/filters/options${expoId ? `?expo_id=${expoId}` : ''}`),

  // Shortlists
  getShortlists: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/shortlists${qs ? `?${qs}` : ''}`);
  },
  addToShortlist: (company_id: string, expo_id: string, notes?: string) =>
    request('/shortlists', { method: 'POST', body: JSON.stringify({ company_id, expo_id, notes: notes || '' }) }),
  updateShortlist: (sid: string, notes: string) => {
    const fd = new FormData(); fd.append('notes', notes);
    return formPut(`/shortlists/${sid}`, fd);
  },
  deleteShortlist: (sid: string) => request(`/shortlists/${sid}`, { method: 'DELETE' }),

  // Networks
  getNetworks: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/networks${qs ? `?${qs}` : ''}`);
  },
  createNetwork: (data: any) => request('/networks', { method: 'POST', body: JSON.stringify(data) }),
  updateNetwork: (nid: string, data: Record<string, string>) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => fd.append(k, v));
    return formPut(`/networks/${nid}`, fd);
  },
  deleteNetwork: (nid: string) => request(`/networks/${nid}`, { method: 'DELETE' }),

  // Expo Days
  getExpoDays: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/expo-days${qs ? `?${qs}` : ''}`);
  },
  createExpoDay: (data: any) => request('/expo-days', { method: 'POST', body: JSON.stringify(data) }),
  updateExpoDay: (eid: string, data: Record<string, string>) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => fd.append(k, v));
    return formPut(`/expo-days/${eid}`, fd);
  },
  deleteExpoDay: (eid: string) => request(`/expo-days/${eid}`, { method: 'DELETE' }),

  // Admin
  uploadCSV: (content: string, expoId: string) => {
    const fd = new FormData(); fd.append('file_content', content); fd.append('expo_id', expoId);
    return formRequest('/admin/upload-csv', fd);
  },
  getUsers: () => request('/admin/users'),

  // Export
  exportCSV: (collection: string, expoId?: string) =>
    request(`/export/${collection}${expoId ? `?expo_id=${expoId}` : ''}`),

  // Seed
  seed: () => request('/seed', { method: 'POST' }),
};
