/**
 * StairsLife — core/theme.js
 * Theme management: applyTheme, toggleTheme.
 * Depends on: global `state` object (defined in app.js).
 * Phase 3 — Modularisasi.
 */
'use strict';

function applyTheme(t) {
  state.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('sl-theme', t);
  // All sun/moon icon pairs
  ['', '‑2', '‑3'].forEach(s => {
    const sun  = document.getElementById(`icon-sun${s}`);
    const moon = document.getElementById(`icon-moon${s}`);
    if (sun)  sun.style.display  = t === 'light' ? '' : 'none';
    if (moon) moon.style.display = t === 'dark'  ? '' : 'none';
  });
}

function toggleTheme() {
  applyTheme(state.theme === 'light' ? 'dark' : 'light');
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.applyTheme  = applyTheme;
window.toggleTheme = toggleTheme;
