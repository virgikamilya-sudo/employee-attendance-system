const API = {
  token: () => localStorage.getItem('token'),
  user: () => JSON.parse(localStorage.getItem('user') || 'null'),
  async req(path, method = 'GET', body) {
    const res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + API.token() },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401 && path !== '/auth/login') { logout(); return; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Terjadi kesalahan');
    return data;
  },
  get: p => API.req(p),
  post: (p, b) => API.req(p, 'POST', b),
  put: (p, b) => API.req(p, 'PUT', b),
  patch: (p, b) => API.req(p, 'PATCH', b),
  del: p => API.req(p, 'DELETE')
};

function logout() {
  localStorage.clear();
  location.href = '/login.html';
}

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmtMin = m => `${Math.floor(m / 60)}h ${m % 60}m`;