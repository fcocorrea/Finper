// auth.js — Email/password authentication with Supabase

const Auth = (() => {
  const SUPABASE_URL = 'https://cbecdmhrmbncyfkaztrb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_i0LokvuzJBb_gN6PJHc2KA_P4ZyuDEB';

  let _db = null;
  let _currentUser = null;

  function init() {
    _db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    _db.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        _currentUser = session.user;
        localStorage.setItem('finper_user_id', _currentUser.id);
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

  function getCurrentUser() { return _currentUser; }

  function getCurrentUserId() {
    return _currentUser?.id || localStorage.getItem('finper_user_id');
  }

  async function signInWithPassword(email, password) {
    if (!_db) return { error: { message: 'Auth no inicializado' } };
    return await _db.auth.signInWithPassword({ email, password });
  }

  async function signUp(email, password, name) {
    if (!_db) return { error: { message: 'Auth no inicializado' } };
    return await _db.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
  }

  async function resetPasswordForEmail(email) {
    if (!_db) return { error: { message: 'Auth no inicializado' } };
    return await _db.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}${location.pathname}`,
    });
  }

  async function signOut() {
    if (!_db) return { error: { message: 'Auth no inicializado' } };
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

  // ── Panel helpers ───────────────────────────────────────────────────────────

  function _showPanel(name) {
    ['signin', 'signup', 'reset'].forEach(p => {
      document.getElementById(`auth-panel-${p}`).classList.toggle('hidden', p !== name);
    });
    _clearErrors();
  }

  function _setError(panelName, message) {
    const el = document.getElementById(`auth-error-${panelName}`);
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function _clearErrors() {
    document.querySelectorAll('.auth-error').forEach(el => el.classList.add('hidden'));
  }

  function _setLoading(btn, loading) {
    btn.disabled = loading;
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
    btn.textContent = loading ? 'Cargando...' : btn.dataset.originalText;
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function _handleSignIn(e) {
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    const btn = e.target.querySelector('button[type="submit"]');

    _setLoading(btn, true);
    const { error } = await signInWithPassword(email, password);
    _setLoading(btn, false);

    if (error) {
      _setError('signin', _translateError(error.message));
    }
  }

  async function _handleSignUp(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const btn = e.target.querySelector('button[type="submit"]');

    if (password.length < 6) {
      _setError('signup', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    _setLoading(btn, true);
    const { error } = await signUp(email, password, name);
    _setLoading(btn, false);

    if (error) {
      _setError('signup', _translateError(error.message));
    } else {
      _showSuccessMessage('signup', '¡Cuenta creada! Revisa tu correo para confirmarla.');
    }
  }

  async function _handleReset(e) {
    e.preventDefault();
    const email = document.getElementById('reset-email').value.trim();
    const btn = e.target.querySelector('button[type="submit"]');

    _setLoading(btn, true);
    const { error } = await resetPasswordForEmail(email);
    _setLoading(btn, false);

    if (error) {
      _setError('reset', _translateError(error.message));
    } else {
      _showSuccessMessage('reset', 'Te enviamos las instrucciones. Revisa tu correo.');
    }
  }

  function _showSuccessMessage(panelName, message) {
    const form = document.getElementById(`${panelName}-form`);
    const success = document.getElementById(`auth-success-${panelName}`);
    if (form) form.classList.add('hidden');
    if (success) {
      success.querySelector('.auth-success-text').textContent = message;
      success.classList.remove('hidden');
    }
  }

  function _translateError(msg) {
    if (!msg) return 'Ocurrió un error. Intenta de nuevo.';
    const lower = msg.toLowerCase();
    if (lower.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (lower.includes('email already registered') || lower.includes('user already registered')) return 'Este correo ya está registrado.';
    if (lower.includes('password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (lower.includes('unable to validate email')) return 'Correo inválido.';
    if (lower.includes('email not confirmed')) return 'Debes confirmar tu correo antes de ingresar.';
    return msg;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  function renderLoginForm() {
    const content = document.getElementById('auth-content');
    content.innerHTML = `
      <div class="auth-layout">

        <!-- Left: Brand -->
        <div class="auth-brand">
          <div class="auth-orb auth-orb--1"></div>
          <div class="auth-orb auth-orb--2"></div>
          <div class="auth-orb auth-orb--3"></div>
          <div class="auth-brand-inner">
            <div class="auth-brand-logo">$</div>
            <h1 class="auth-brand-name">Finper</h1>
            <p class="auth-brand-tagline">Tus finanzas, bajo control.</p>
            <ul class="auth-brand-features">
              <li><span class="auth-feat-icon">📊</span> Gastos e Ingresos</li>
              <li><span class="auth-feat-icon">💳</span> Cuentas y Ahorros</li>
              <li><span class="auth-feat-icon">📈</span> Análisis en tiempo real</li>
            </ul>
          </div>
        </div>

        <!-- Right: Forms -->
        <div class="auth-forms">
          <div class="auth-forms-inner">

            <!-- Sign In -->
            <div id="auth-panel-signin" class="auth-panel">
              <h2 class="auth-panel-title">Iniciar Sesión</h2>
              <p class="auth-panel-sub">Bienvenido de nuevo</p>

              <form id="signin-form" class="auth-form" novalidate>
                <div class="form-group">
                  <label class="form-label">Correo electrónico</label>
                  <input id="signin-email" class="form-input" type="email" placeholder="tu@email.com" required autocomplete="email" />
                </div>
                <div class="form-group">
                  <label class="form-label">Contraseña</label>
                  <div class="auth-password-wrap">
                    <input id="signin-password" class="form-input" type="password" placeholder="••••••••" required autocomplete="current-password" />
                    <button type="button" class="auth-toggle-pass" data-target="signin-password" aria-label="Mostrar contraseña">Show</button>
                  </div>
                </div>
                <button type="submit" class="btn btn-primary auth-submit-btn">Entrar</button>
              </form>

              <div id="auth-error-signin" class="auth-error hidden"></div>

              <button class="auth-link-btn" id="show-reset">¿Olvidaste tu contraseña?</button>

              <div class="auth-divider"><span>o</span></div>

              <div class="auth-alt-section">
                <p class="auth-alt-text">¿No tienes cuenta?</p>
                <button class="btn btn-outline auth-submit-btn" id="show-signup">Crear cuenta</button>
              </div>
            </div>

            <!-- Sign Up -->
            <div id="auth-panel-signup" class="auth-panel hidden">
              <h2 class="auth-panel-title">Crear Cuenta</h2>
              <p class="auth-panel-sub">Empieza a controlar tus finanzas</p>

              <form id="signup-form" class="auth-form" novalidate>
                <div class="form-group">
                  <label class="form-label">Nombre</label>
                  <input id="signup-name" class="form-input" type="text" placeholder="Tu nombre" required autocomplete="name" />
                </div>
                <div class="form-group">
                  <label class="form-label">Correo electrónico</label>
                  <input id="signup-email" class="form-input" type="email" placeholder="tu@email.com" required autocomplete="email" />
                </div>
                <div class="form-group">
                  <label class="form-label">Contraseña</label>
                  <div class="auth-password-wrap">
                    <input id="signup-password" class="form-input" type="password" placeholder="Mín. 6 caracteres" required autocomplete="new-password" />
                    <button type="button" class="auth-toggle-pass" data-target="signup-password" aria-label="Mostrar contraseña">Show</button>
                  </div>
                </div>
                <button type="submit" class="btn btn-primary auth-submit-btn">Registrarse</button>
              </form>

              <div id="auth-error-signup" class="auth-error hidden"></div>
              <div id="auth-success-signup" class="auth-success-banner hidden">
                <p class="auth-success-text"></p>
              </div>

              <button class="auth-link-btn" id="show-signin-from-signup">¿Ya tienes cuenta? Inicia sesión</button>
            </div>

            <!-- Reset Password -->
            <div id="auth-panel-reset" class="auth-panel hidden">
              <h2 class="auth-panel-title">Recuperar Contraseña</h2>
              <p class="auth-panel-sub">Te enviaremos las instrucciones por correo</p>

              <form id="reset-form" class="auth-form" novalidate>
                <div class="form-group">
                  <label class="form-label">Correo electrónico</label>
                  <input id="reset-email" class="form-input" type="email" placeholder="tu@email.com" required autocomplete="email" />
                </div>
                <button type="submit" class="btn btn-primary auth-submit-btn">Enviar instrucciones</button>
              </form>

              <div id="auth-error-reset" class="auth-error hidden"></div>
              <div id="auth-success-reset" class="auth-success-banner hidden">
                <p class="auth-success-text"></p>
              </div>

              <button class="auth-link-btn" id="show-signin-from-reset">← Volver al inicio de sesión</button>
            </div>

          </div>
        </div>
      </div>
    `;

    // Forms
    document.getElementById('signin-form').addEventListener('submit', _handleSignIn);
    document.getElementById('signup-form').addEventListener('submit', _handleSignUp);
    document.getElementById('reset-form').addEventListener('submit', _handleReset);

    // Panel navigation
    document.getElementById('show-reset').addEventListener('click', () => _showPanel('reset'));
    document.getElementById('show-signup').addEventListener('click', () => _showPanel('signup'));
    document.getElementById('show-signin-from-signup').addEventListener('click', () => _showPanel('signin'));
    document.getElementById('show-signin-from-reset').addEventListener('click', () => _showPanel('signin'));

    // Password visibility toggles
    document.querySelectorAll('.auth-toggle-pass').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        input.type = input.type === 'password' ? 'text' : 'password';
        btn.textContent = input.type === 'password' ? 'Show' : 'Hide';
      });
    });
  }

  return {
    init,
    checkSession,
    getCurrentUser,
    getCurrentUserId,
    signOut,
    showAuthView,
    hideAuthView,
    renderLoginForm,
  };
})();
