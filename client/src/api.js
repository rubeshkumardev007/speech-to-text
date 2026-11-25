async function request(path, options) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  health: () => request('/api/health'),
  list: ({ search = '', limit = 10, offset = 0 } = {}) =>
    request(`/api/transcriptions?limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}`),
  create: (data) => request('/api/transcriptions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/transcriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/transcriptions/${id}`, { method: 'DELETE' }),
};
