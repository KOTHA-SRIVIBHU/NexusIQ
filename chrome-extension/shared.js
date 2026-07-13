const DEFAULTS = {
  gatewayUrl: 'http://localhost:4000',
};

async function getConfig() {
  const { gatewayUrl, token } = await chrome.storage.sync.get(DEFAULTS);
  return { gatewayUrl: gatewayUrl || DEFAULTS.gatewayUrl, token: token || '' };
}

async function api(method, path, body) {
  const { gatewayUrl, token } = await getConfig();
  const url = `${gatewayUrl}${path}`;
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) {
    if (body instanceof FormData) {
      // don't set Content-Type for FormData — browser sets it with boundary
      opts.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.detail || 'Request failed');
  return data;
}

async function login(email, password) {
  const data = await api('POST', '/api/auth/login', { email, password });
  await chrome.storage.sync.set({ token: data.token });
  return data;
}

async function logout() {
  await chrome.storage.sync.remove('token');
}

async function isLoggedIn() {
  const { token } = await chrome.storage.sync.get('token');
  return !!token;
}

async function getFolders() {
  const data = await api('GET', '/api/folders');
  return data.folders || [];
}

async function uploadDocument(file, folderId) {
  const fd = new FormData();
  fd.append('file', file);
  if (folderId) fd.append('folderId', folderId);
  return await api('POST', '/api/documents/upload', fd);
}

async function searchDocuments(query, topK) {
  return await api('POST', '/api/search', { query, topK: topK || 5 });
}
