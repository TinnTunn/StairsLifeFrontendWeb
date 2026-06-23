/**
 * StairsLife — utils/storage.js
 * Thin wrapper around localStorage.
 * Phase 3 — Modularisasi.
 */
'use strict';

const Storage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? v : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  },
  getJSON(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  setJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

window.Storage = Storage;
