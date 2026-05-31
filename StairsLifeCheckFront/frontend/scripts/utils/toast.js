/**
 * StairsLife — utils/toast.js
 * showToast() and animateProgressBar() extracted from app.js.
 * No dependencies on other modules.
 * Phase 3 — Modularisasi.
 */
'use strict';

/* ================================================================
   TOAST NOTIFICATIONS
   ================================================================ */
let toastTimer = null;

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  const icons = {
    success: '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;
  el.style.display = 'flex';
  el.classList.remove('toast-hide');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('toast-hide');
    setTimeout(() => { el.style.display = 'none'; }, 300);
  }, 3500);
}

/* ================================================================
   PROGRESS BAR ANIMATION
   ================================================================ */
function animateProgressBar(id, target, delay = 0) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.width = '0%';
  setTimeout(() => { el.style.width = `${target}%`; }, delay);
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.showToast          = showToast;
window.animateProgressBar = animateProgressBar;
