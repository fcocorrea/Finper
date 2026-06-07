// auth.js — Magic link authentication with Supabase

const Auth = (() => {
  const SUPABASE_URL = 'https://cbecdmhrmbncyfkaztrb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_i0LokvuzJBb_gN6PJHc2KA_P4ZyuDEB';

  let _db = null;
  let _currentUser = null;

  function init() {
    _db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Listen for auth state changes (e.g., when user clicks magic link)
    _db.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        _currentUser = session.user;
        localStorage.setItem('finper_user_id', _currentUser.id);
        // If we're currently showing the login screen, boot the app
        if (document.getElementById('auth-view')?.classList.contains('active')) {
          hideAuthView();
          App.init();
        }
      } else {
        _currentUser = null;
        localStorage.removeItem('finper_user_id');
      }
    });
  }

  async function checkSession() {
    if (!_db) return null;
    const { data, error } = await _db.auth.getSession();
    if (error || !data.session) return null;
    _currentUser = data.session.user;
    localStorage.setItem('finper_user_id', _currentUser.id);
    return _currentUser;
  }

  function getCurrentUser() {
    return _currentUser;
  }

  function getCurrentUserId() {
    return _currentUser?.id || localStorage.getItem('finper_user_id');
  }

  async function signInWithMagicLink(email) {
    if (!_db) return { error: 'Auth not initialized' };
    const { error } = await _db.auth.signInWithOtp({ email });
    return { error };
  }

  async function signOut() {
    if (!_db) return { error: 'Auth not initialized' };
    _currentUser = null;
    localStorage.removeItem('finper_user_id');
    return await _db.auth.signOut();
  }

  function showAuthView() {
    document.getElementById('auth-view').classList.add('active');
    document.getElementById('app-container').classList.add('hidden');
  }

  function hideAuthView() {
    document.getElementById('auth-view').classList.remove('active');
    document.getElementById('app-container').classList.remove('hidden');
  }

  function renderLoginForm() {
    const content = document.getElementById('auth-content');
    content.innerHTML = `
      <div class="auth-card">
        <div class="auth-logo">💰</div>
        <h1 class="auth-title">Finper</h1>
        <p class="auth-subtitle">Finanzas Personales</p>

        <form id="login-form" class="auth-form">
          <div class="form-group">
            <label class="form-label">Correo Electrónico</label>
            <input
              class="form-input"
              id="login-email"
              type="email"
              placeholder="tu@email.com"
              required
            />
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%">
            Enviar Enlace de Acceso
          </button>
          <p class="auth-hint">Se te enviará un enlace de acceso por correo. No necesitas contraseña.</p>
        </form>

        <div id="login-success" class="hidden">
          <div class="auth-success">✓</div>
          <p class="auth-success-text">¡Revisa tu correo!</p>
          <p class="auth-hint">Hemos enviado un enlace de acceso a tu bandeja de entrada. Haz clic en él para acceder a tu cuenta.</p>
          <button class="btn btn-outline" id="back-to-login" style="width: 100%">← Volver</button>
        </div>

        <div id="login-error" class="auth-error hidden"></div>
      </div>
    `;

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('back-to-login')?.addEventListener('click', () => {
      document.getElementById('login-form').classList.remove('hidden');
      document.getElementById('login-success').classList.add('hidden');
      document.getElementById('login-error').classList.add('hidden');
    });
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const errorDiv = document.getElementById('login-error');
    const form = document.getElementById('login-form');
    const successDiv = document.getElementById('login-success');

    if (!email) {
      errorDiv.textContent = 'Por favor ingresa tu correo';
      errorDiv.classList.remove('hidden');
      return;
    }

    const { error } = await signInWithMagicLink(email);
    if (error) {
      errorDiv.textContent = error.message || 'Error al enviar enlace';
      errorDiv.classList.remove('hidden');
    } else {
      form.classList.add('hidden');
      successDiv.classList.remove('hidden');
    }
  }

  return {
    init,
    checkSession,
    getCurrentUser,
    getCurrentUserId,
    signInWithMagicLink,
    signOut,
    showAuthView,
    hideAuthView,
    renderLoginForm,
  };
})();
