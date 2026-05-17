/**
 * StairsLife — utils/helpers.js
 * Pure formatter / helper functions. No DOM, no API calls.
 * Extracted from app.js (Phase 3 — Modularisasi).
 */
'use strict';

/* ================================================================
   DATE / TIME HELPERS
   ================================================================ */
function daysFromNow(d) {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt;
}

function daysLeft(dt) {
  const diff = Math.ceil((dt - new Date()) / 86400000);
  if (diff < 0) return 'Lewat deadline';
  if (diff === 0) return 'Hari ini ⚠️';
  if (diff <= 3) return `${diff} hari lagi ⚠️`;
  return `${diff} hari lagi`;
}

function fmtDate(dt) {
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Format tanggal untuk chat divider, gaya WhatsApp:
 * - Hari ini       → "Hari ini"
 * - Kemarin        → "Kemarin"
 * - Minggu ini     → "Senin" / "Selasa" dst
 * - Tahun ini      → "Senin, 5 Jan"
 * - Tahun lalu     → "5 Jan 2024"
 */
function fmtChatDate(dt) {
  const d    = new Date(dt);
  const now  = new Date();

  const startOfToday     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday - 86400000);
  const startOfWeek      = new Date(startOfToday - (now.getDay() || 7) * 86400000);

  const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (dStart.getTime() === startOfToday.getTime())     return 'Hari ini';
  if (dStart.getTime() === startOfYesterday.getTime()) return 'Kemarin';

  const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

  if (dStart >= startOfWeek) return DAYS[d.getDay()];

  const day   = d.getDate();
  const month = MONTHS[d.getMonth()];
  if (d.getFullYear() === now.getFullYear()) return `${DAYS[d.getDay()]}, ${day} ${month}`;
  return `${day} ${month} ${d.getFullYear()}`;
}

/**
 * Kembalikan true jika dua timestamp berbeda HARI (untuk chat divider).
 */
function isDifferentDay(dt1, dt2) {
  const a = new Date(dt1);
  const b = new Date(dt2);
  return a.getFullYear() !== b.getFullYear() ||
         a.getMonth()    !== b.getMonth()    ||
         a.getDate()     !== b.getDate();
}
  // Accepts Date object OR ISO string dari API (e.g. "2026-05-09T10:30:00Z")
function fmtRelative(dt) {
  const diff = Math.floor((Date.now() - new Date(dt)) / 60000);
  if (isNaN(diff) || diff < 1) return 'Baru saja';
  if (diff < 60) return `${diff} menit lalu`;
  if (diff < 1440) return `${Math.floor(diff / 60)} jam lalu`;
  return `${Math.floor(diff / 1440)} hari lalu`;
}

function minsAgo(m) {
  const d = new Date();
  d.setMinutes(d.getMinutes() - m);
  return d;
}

/* ================================================================
   CURRENCY HELPERS
   fmtCurrency  — compact format (Rp 1.5 jt / Rp 500K)
   formatRupiah — canonical alias; full Intl format is in api.js,
                  but kept here as an alias for backwards compat.
   ================================================================ */
function fmtCurrency(n) {
  if (!n || n === 0) return 'Rp 0';
  if (n >= 1000000) return `Rp ${(n / 1000000).toFixed(1).replace('.0', '')}jt`;
  if (n >= 1000) return `Rp ${Math.round(n / 1000)}K`;
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function fmtRange(mn, mx) {
  if (!mn && !mx) return 'Budget negotiable';
  if (!mn) return `s/d ${fmtCurrency(mx)}`;
  if (!mx) return `ab ${fmtCurrency(mn)}`;
  return `${fmtCurrency(mn)} – ${fmtCurrency(mx)}`;
}

/* ================================================================
   BADGE HELPERS
   ================================================================ */
function tierBadge(t) {
  const m = {
    pemula:   ['badge-teal',   '🌱 Pemula'],
    menengah: ['badge-amber',  '⚡ Menengah'],
    mahir:    ['badge-accent', '🔥 Mahir'],
  };
  const [cls, label] = m[t] || ['badge-gray', t];
  return `<span class="badge ${cls}">${label}</span>`;
}

function statusBadge(s) {
  const m = {
    // Status Indonesia (UI labels)
    unsubmitted: ['badge-gray',   '⬆️ Belum Submit'],
    pending:     ['badge-amber',  '⏳ Menunggu'],
    shortlisted: ['badge-amber',  '⭐ Shortlisted'],
    approved:    ['badge-teal',   '✅ Diterima'],
    rejected:    ['badge-rose',   '❌ Ditolak'],
    aktif:       ['badge-accent', '🔵 Aktif'],
    open:        ['badge-teal',   '🟢 Open'],
    selesai:     ['badge-gray',   '✔ Selesai'],
    held:        ['badge-amber',  '🔒 Ditahan'],
    released:    ['badge-teal',   '✅ Dicairkan'],
    // Status backend (snake_case / camelCase dari API)
    in_progress: ['badge-accent', '🔵 Dalam Proses'],
    inProgress:  ['badge-accent', '🔵 Dalam Proses'],
    active:      ['badge-accent', '🔵 Aktif'],
    completed:   ['badge-gray',   '✔ Selesai'],
    disputed:    ['badge-rose',   '⚠️ Sengketa'],
    cancelled:   ['badge-gray',   '🚫 Dibatalkan'],
    resolved:    ['badge-teal',   '✅ Diselesaikan'],
    suspended:   ['badge-rose',   '🚫 Disuspend'],
    pending_review: ['badge-amber', '⏳ Review'],
  };
  const [cls, label] = m[s] || ['badge-gray', s ?? '-'];
  return `<span class="badge ${cls}">${label}</span>`;
}

/* ================================================================
   STRING HELPERS
   ================================================================ */
function initials(name) {
  return name.trim().charAt(0).toUpperCase();
}

/* ================================================================
   EXPORTS — expose to window so all other modules can call them
   ================================================================ */
window.daysFromNow   = daysFromNow;
window.daysLeft      = daysLeft;
window.fmtDate       = fmtDate;
window.fmtRelative   = fmtRelative;
window.fmtChatDate   = fmtChatDate;
window.isDifferentDay = isDifferentDay;
window.minsAgo       = minsAgo;
window.fmtCurrency   = fmtCurrency;
window.fmtRange      = fmtRange;
window.tierBadge     = tierBadge;
window.statusBadge   = statusBadge;
window.initials      = initials;
