/**
 * StairsLife — core/router.js
 * SPA screen routing: goTo, _showScreen, screenHistory, _routeHooks.
 * Depends on: global `state`, `screenHistory` (app.js), and feature
 * enter hooks defined in feature modules.
 * Phase 3 — Modularisasi.
 */
'use strict';

/* ================================================================
   ROUTE GUARD
   Screen yang butuh login dan role tertentu.
   ================================================================ */
const PROTECTED_SCREENS = {
  // screen-id: role yang diizinkan ('any' = login saja sudah cukup)
  'screen-student':           'mahasiswa',
  'screen-business':          'bisnis',
  'screen-admin':             'admin',
  'screen-project-detail':    'any',
  'screen-chat-list':         'any',
  'screen-chat-room':         'any',
  'screen-contract-detail':   'any',
  'screen-deliverable-upload':'any',
  'screen-dispute-list':      'any',
  'screen-new-dispute':       'any',
  'screen-verification':      'mahasiswa',
  'screen-review-submit':     'any',
  'screen-notifications':     'any',
  'screen-payment-history':   'any',
  'screen-bank-account':      'any',
  'screen-wallet':            'mahasiswa',          // dompet mahasiswa
  'screen-admin-withdrawals': 'admin',              // admin withdrawal management
  'screen-edit-profile':      'any',
  'screen-public-profile':    'any',
  'screen-post-project':      'bisnis',
};

function _checkRouteAccess(id) {
  const required = PROTECTED_SCREENS[id];
  if (!required) return true; // public screen

  const user = (typeof AuthAPI !== 'undefined') ? AuthAPI.getCurrentUser() : null;
  if (!user) {
    showToast('Login dulu untuk mengakses halaman ini', 'error');
    _showScreen('screen-login');
    return false;
  }

  if (required === 'any') return true;

  const role = user.role?.toLowerCase();
  if (role !== required) {
    showToast('Kamu tidak punya akses ke halaman ini', 'error');
    // Redirect ke home sesuai role
    if (role === 'admin')  _showScreen('screen-admin');
    else if (role === 'bisnis') _showScreen('screen-business');
    else _showScreen('screen-student');
    return false;
  }

  return true;
}

/* ================================================================
   CORE ROUTING
   ================================================================ */
function _showScreen(id, { fromHistory = false } = {}) {
  if (!id || id === state.currentScreen) return;
  const cur  = document.getElementById(state.currentScreen);
  const next = document.getElementById(id);
  if (!next) { console.warn('Screen not found:', id); return; }

  if (cur) cur.classList.remove('active');
  next.classList.add('active');

  if (!fromHistory) {
    screenHistory.push(state.currentScreen);
    state.prevScreen = state.currentScreen;
  }

  state.currentScreen = id;

  // Scroll resets
  window.scrollTo(0, 0);
  ['student-main', 'biz-main', 'admin-main'].forEach(mid => {
    document.getElementById(mid)?.scrollTo(0, 0);
  });

  // Core hooks — typeof guard supaya tidak crash kalau script
  // belum di-load (mis. urutan script salah di index.html)
  if (id === 'screen-student')  { if (typeof onEnterStudent  === 'function') onEnterStudent(); }
  if (id === 'screen-business') { if (typeof onEnterBusiness === 'function') onEnterBusiness(); }
  if (id === 'screen-register') { if (typeof initRegister    === 'function') initRegister(); }
  if (id === 'screen-login')    { if (typeof initLogin       === 'function') initLogin(); }
  if (id === 'screen-wallet')   { if (typeof renderWalletPage === 'function') renderWalletPage(); }
  if (id === 'screen-admin-withdrawals') {
    if (typeof renderAdminWithdrawals === 'function') renderAdminWithdrawals();
  }
  if (id === 'screen-edit-profile') {
    if (typeof onEnterEditProfile === 'function') onEnterEditProfile();
  }
  if (id === 'screen-post-project') {
    // Set min = hari ini, max = 1 tahun ke depan supaya tidak bisa pilih
    // tanggal masa lalu atau jauh ke depan (mis. tahun 275760).
    const today = new Date().toISOString().split('T')[0];
    const max   = new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0];
    const dl    = document.getElementById('pp-deadline');
    if (dl) { dl.min = today; dl.max = max; }
  }

  // Extended route hooks (registered in app.js and below)
  if (window._routeHooks?.[id]) window._routeHooks[id]();
}

function goTo(id, opts = {}) {
  const { replace = false, pushHistory = true } = opts;
  if (!id || id === state.currentScreen) return;

  // Route guard — cek akses sebelum navigate
  if (!_checkRouteAccess(id)) return;

  // Clear chat override when navigating away from chat room
  if (state.currentScreen === 'screen-chat-room' && id !== 'screen-chat-room') {
    window._sendMessageOverride = null;
    window._activeChatContractId = null;
    stopChatPolling();
  }

  _showScreen(id, { fromHistory: false });

  if (!pushHistory) return;
  const url = `#${id}`;
  try {
    if (replace) history.replaceState({ screen: id }, '', url);
    else history.pushState({ screen: id }, '', url);
  } catch {
    location.hash = url;
  }
}

function _screenFromLocation() {
  const h = (location.hash || '').replace('#', '').trim();
  return h && document.getElementById(h) ? h : null;
}

function goBack() {
  if (screenHistory.length > 0) {
    screenHistory.pop();
    history.back();
    return;
  }
  goTo('screen-landing', { replace: true, pushHistory: true });
}

/* ================================================================
   BROWSER BACK/FORWARD
   ================================================================ */
window.addEventListener('popstate', (e) => {
  const id = e.state?.screen || _screenFromLocation();
  if (!id) return;
  _showScreen(id, { fromHistory: true });
});

/* ================================================================
   LANDING HELPERS
   ================================================================ */
function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Navbar shadow on scroll
window.addEventListener('scroll', () => {
  const nb = document.getElementById('l-navbar');
  if (nb) nb.style.boxShadow = window.scrollY > 8 ? '0 2px 20px rgba(0,0,0,0.09)' : '';
}, { passive: true });

/* ================================================================
   EXPORTS
   ================================================================ */
window._showScreen        = _showScreen;
window.goTo               = goTo;
window._screenFromLocation = _screenFromLocation;
window.goBack             = goBack;
window.scrollToId         = scrollToId;