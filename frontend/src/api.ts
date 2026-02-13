import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('auth_token');
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}/api${path}`;
  const headers = await authHeaders();
  const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function formRequest(path: string, body: FormData) {
  const url = `${API_BASE}/api${path}`;
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth
export const api = {
  register: (email: string, password: string, name: string) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => request('/auth/me'),

  // Expos
  getExpos: () => request('/expos'),
  createExpo: (data: any) => request('/expos', { method: 'POST', body: JSON.stringify(data) }),

  // Exhibitors
  getExhibitors: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/exhibitors${qs ? `?${qs}` : ''}`);
  },
  getExhibitor: (id: string) => request(`/exhibitors/${id}`),
  getFilterOptions: (expoId?: string) => request(`/exhibitors/filters/options${expoId ? `?expo_id=${expoId}` : ''}`),

  // Shortlists
  getShortlists: () => request('/shortlists'),
  createShortlist: (expo_id: string, name: string) =>
    request('/shortlists', { method: 'POST', body: JSON.stringify({ expo_id, name }) }),
  addToShortlist: (slId: string, exhibitorId: string) =>
    request(`/shortlists/${slId}/add`, { method: 'POST', body: JSON.stringify({ exhibitor_id: exhibitorId }) }),
  removeFromShortlist: (slId: string, exhibitorId: string) =>
    request(`/shortlists/${slId}/remove`, { method: 'POST', body: JSON.stringify({ exhibitor_id: exhibitorId }) }),
  reorderShortlist: (slId: string, ids: string[]) =>
    request(`/shortlists/${slId}/reorder`, { method: 'POST', body: JSON.stringify({ exhibitor_ids: ids }) }),
  deleteShortlist: (slId: string) => request(`/shortlists/${slId}`, { method: 'DELETE' }),
  exportShortlist: (slId: string) => request(`/shortlists/${slId}/export`),

  // Expo Days
  getExpoDays: (expoId?: string) => request(`/expodays${expoId ? `?expo_id=${expoId}` : ''}`),
  createExpoDay: (expo_id: string) =>
    request('/expodays', { method: 'POST', body: JSON.stringify({ expo_id }) }),
  addMeeting: (edId: string, data: any) =>
    request(`/expodays/${edId}/meetings`, { method: 'POST', body: JSON.stringify(data) }),
  updateMeeting: (edId: string, mId: string, data: any) =>
    request(`/expodays/${edId}/meetings/${mId}`, { method: 'PUT', body: JSON.stringify(data) }),
  checkinMeeting: (edId: string, mId: string) =>
    request(`/expodays/${edId}/meetings/${mId}/checkin`, { method: 'POST' }),
  deleteMeeting: (edId: string, mId: string) =>
    request(`/expodays/${edId}/meetings/${mId}`, { method: 'DELETE' }),
  exportExpoDay: (edId: string) => request(`/expodays/${edId}/export`),
  uploadVoiceNote: (edId: string, mId: string, base64Data: string) => {
    const fd = new FormData();
    fd.append('base64_data', base64Data);
    return formRequest(`/expodays/${edId}/meetings/${mId}/upload-voice`, fd);
  },
  uploadVisitingCard: (edId: string, mId: string, base64Data: string) => {
    const fd = new FormData();
    fd.append('base64_data', base64Data);
    return formRequest(`/expodays/${edId}/meetings/${mId}/upload-card`, fd);
  },

  // Admin
  uploadCSV: (content: string, fileType: string) => {
    const fd = new FormData();
    fd.append('file_content', content);
    fd.append('file_type', fileType);
    return formRequest('/admin/upload-csv', fd);
  },
  getUsers: () => request('/admin/users'),
  updateUserRole: (userId: string, role: string) => {
    const fd = new FormData();
    fd.append('role', role);
    return formRequest(`/admin/users/${userId}/role`, fd);
  },

  // Seed
  seed: () => request('/seed', { method: 'POST' }),
};
