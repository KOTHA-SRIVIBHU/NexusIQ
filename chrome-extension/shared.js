const DEFAULTS = {
  gatewayUrl: 'http://localhost:4000',
};

async function getConfig() {
  const { gatewayUrl, token } = await chrome.storage.sync.get(DEFAULTS);
  return { gatewayUrl: gatewayUrl || DEFAULTS.gatewayUrl, token: token || '' };
}

async function api(method, path, body) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'api', method, path, body: body instanceof FormData ? null : body, isFormData: body instanceof FormData },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      }
    );
  });
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

async function searchDocuments(query, topK) {
  return await api('POST', '/api/search', { query, topK: topK || 5 });
}
