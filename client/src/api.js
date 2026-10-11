async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'fetch', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const base = (name) => `/api/objects/${encodeURIComponent(name)}`;

export const api = {
  me: () => request('/api/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  describe: (name) => request(base(name)),
  list: (name, { cursor, q }) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (q) params.set('q', q);
    return request(`${base(name)}/records?${params}`);
  },
  get: (name, id) => request(`${base(name)}/records/${id}`),
  create: (name, values) => request(`${base(name)}/records`, { method: 'POST', body: values }),
  update: (name, id, values) => request(`${base(name)}/records/${id}`, { method: 'PATCH', body: values }),
  remove: (name, id) => request(`${base(name)}/records/${id}`, { method: 'DELETE' }),
};
