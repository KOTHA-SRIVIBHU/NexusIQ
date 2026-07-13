const form = document.getElementById('settings-form');
const gatewayInput = document.getElementById('gateway-url');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const loggedInDiv = document.getElementById('logged-in');
const userInfo = document.getElementById('user-info');
const logoutBtn = document.getElementById('logout-btn');

async function init() {
  const cfg = await getConfig();
  gatewayInput.value = cfg.gatewayUrl;

  if (cfg.token) {
    try {
      const me = await api('GET', '/api/auth/me');
      showLoggedIn(me.user?.name || me.user?.email || 'Connected');
    } catch {
      await logout();
      showForm();
    }
  } else {
    showForm();
  }
}

function showForm() {
  form.classList.remove('hidden');
  loggedInDiv.classList.add('hidden');
}

function showLoggedIn(name) {
  form.classList.add('hidden');
  loggedInDiv.classList.remove('hidden');
  userInfo.textContent = `Logged in as ${name}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';

  await chrome.storage.sync.set({ gatewayUrl: gatewayInput.value.trim() || 'http://localhost:4000' });

  try {
    const data = await login(emailInput.value, passwordInput.value);
    showLoggedIn(data.user?.name || data.user?.email);
  } catch (err) {
    loginError.textContent = err.message || 'Login failed';
    loginError.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
});

logoutBtn.addEventListener('click', async () => {
  await logout();
  showForm();
  emailInput.value = '';
  passwordInput.value = '';
});

init();
