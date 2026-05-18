/* ============================================================
   MyBurger -- Admin Auth
   Hardcoded credentials + 8-hour session in localStorage.
   Every admin/*.html page runs guard() in its head so an
   expired/missing session bounces to /admin/index.html.

   Public API (window.MyBurger.admin.auth):
     login(email, password) -> { ok, message }
     logout()
     isSignedIn()
     guard()                 -> void (redirects if no valid session)
     bindLoginForm()         -> void (admin/index.html)
   ============================================================ */

(function () {
  'use strict';

  const MB    = window.MyBurger || {};
  const UI    = MB.ui;
  const STATE = MB.state;

  if (!STATE) {
    console.error('[auth] state module missing -- include state.js before auth.js');
    return;
  }

  const KEY_SESSION = STATE.KEYS.ADMIN_SESSION;
  const HARDCODED_EMAIL    = 'admin@gmail.com';
  const HARDCODED_PASSWORD = 'admin123';
  const SESSION_HOURS = 8;

  /* ---------- Session helpers ---------- */

  function nowMs() {
    return Date.now();
  }

  function readSession() {
    const session = STATE.getStore(KEY_SESSION, null);
    if (!session || typeof session !== 'object') return null;
    return session;
  }

  function isSignedIn() {
    const s = readSession();
    if (!s) return false;
    if (!s.expires) return false;
    return Number(s.expires) > nowMs();
  }

  /* ---------- Login / logout ---------- */

  function login(email, password) {
    const e = String(email || '').trim().toLowerCase();
    const p = String(password || '');

    if (e !== HARDCODED_EMAIL || p !== HARDCODED_PASSWORD) {
      return { ok: false, message: 'Invalid email or password.' };
    }

    const ts = nowMs();
    const expires = ts + (SESSION_HOURS * 60 * 60 * 1000);
    STATE.setStore(KEY_SESSION, {
      email:   HARDCODED_EMAIL,
      ts:      ts,
      expires: expires
    });
    return { ok: true, message: 'Signed in' };
  }

  function logout() {
    STATE.clearStore(KEY_SESSION);
  }

  /* ---------- Guard (every admin page) ---------- */

  function guard() {
    if (!isSignedIn()) {
      // Preserve original target for after-login bounce
      const target = window.location.pathname + window.location.search;
      const params = new URLSearchParams({ next: target });
      window.location.replace('/admin/index.html?' + params.toString());
    }
  }

  /* ---------- Login form binding (admin/index.html only) ---------- */

  function bindLoginForm() {
    const form     = document.getElementById('admin-login-form');
    if (!form) return;

    const emailEl  = document.getElementById('login-email');
    const passEl   = document.getElementById('login-password');
    const errorEl  = document.querySelector('[data-login-error]');
    const demoBtn  = document.querySelector('[data-demo-fill]');
    const submitEl = document.querySelector('[data-login-submit]');

    if (demoBtn && emailEl && passEl) {
      demoBtn.addEventListener('click', function () {
        emailEl.value = HARDCODED_EMAIL;
        passEl.value  = HARDCODED_PASSWORD;
        emailEl.focus();
      });
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (errorEl) errorEl.classList.remove('is-show');

      const result = login(emailEl ? emailEl.value : '', passEl ? passEl.value : '');

      if (!result.ok) {
        if (errorEl) {
          errorEl.textContent = result.message;
          errorEl.classList.add('is-show');
        }
        if (passEl) passEl.value = '';
        return;
      }

      if (submitEl) {
        submitEl.setAttribute('disabled', 'disabled');
        submitEl.textContent = 'Signing in...';
      }
      if (UI && UI.toast) UI.toast('Welcome back', { variant: 'success' });

      // After-login bounce target (?next=/admin/orders.html) or default dashboard
      const params = new URLSearchParams(window.location.search);
      const next   = params.get('next');
      const dest   = next && next.indexOf('/admin/') === 0 ? next : '/admin/dashboard.html';
      window.location.replace(dest);
    });
  }

  /* ---------- Expose ---------- */

  window.MyBurger = window.MyBurger || {};
  window.MyBurger.admin = window.MyBurger.admin || {};
  window.MyBurger.admin.auth = {
    login:         login,
    logout:        logout,
    isSignedIn:    isSignedIn,
    guard:         guard,
    bindLoginForm: bindLoginForm
  };
})();
