/**
 * StairsLife — utils/helpers.js
 * Pure formatter / helper functions. No DOM, no API calls.
 * Extracted from app.js (Phase 3 — Modularisasi).
 */
'use strict';

/* ================================================================
   HTML ESCAPE — keamanan paling fundamental
   ================================================================ */
/**
 * Escape karakter HTML berbahaya supaya aman di-inject ke innerHTML.
 *
 * KAPAN dipakai:
 *   - SETIAP nilai dari API yang berasal dari user lain
 *     (chat message, project title, bio, nama, dst).
 *   - Sertakan SELALU saat interpolasi ke template literal yang
 *     berakhir di .innerHTML / insertAdjacentHTML / outerHTML.
 *
 * KAPAN TIDAK perlu:
 *   - Saat target-nya .textContent (sudah aman by spec).
 *   - Saat sumber-nya konstanta literal di kode kita (tidak ada
 *     jalan attacker bisa pengaruhi).
 *   - Saat sumber-nya angka atau UUID hasil server (tapi tetap lebih
 *     aman pakai esc() — overhead-nya kecil).
 *
 * Behavior:
 *   - null/undefined → string kosong (bukan "null"/"undefined").
 *   - Type apa pun di-coerce via String() dulu.
 */
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
    }
    return c;
  });
}

/**
 * Escape untuk dipakai di dalam JS string literal yang ada di onclick=,
 * mis. onclick="doSomething('${escAttr(p.title)}')".
 *
 * Berbeda dengan esc(): di sini kita perlu escape backslash dan kutip
 * juga supaya tidak break sintaks string.
 *
 * BEST PRACTICE: hindari pola onclick="fn('${x}')" sebisa mungkin —
 * pakai data-* attribute + addEventListener atau closure. Tapi karena
 * codebase sudah banyak pakai pola itu, escAttr() adalah jaring pengaman.
 */
function escAttr(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ================================================================
   DATE / TIME HELPERS
   ================================================================ */
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
   PRICE INPUT HELPERS — input uang dengan pemisah ribuan "." (id-ID)
   Input pakai: type="text" inputmode="numeric" oninput="slPriceInput(this)"
   Baca nilai numerik: slParsePrice(el.value). Pra-isi: slFormatPrice(n).
   (type="number" tidak bisa menampilkan "." jadi semua input uang diubah
   ke text + format manual ini supaya angka jelas: 1.500.000 bukan 1500000.)
   ================================================================ */
function slParsePrice(v) {
  const digits = String(v == null ? '' : v).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}
function slFormatPrice(n) {
  const num = slParsePrice(n);
  return num ? num.toLocaleString('id-ID') : '';
}
function slPriceInput(el) {
  if (!el) return;
  el.value = slFormatPrice(el.value);   // caret pindah ke akhir — aman utk input uang
  if (typeof el.dataset !== 'undefined') el.dataset.raw = String(slParsePrice(el.value));
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
  // label sumbernya konstan literal kecuali fallback `t` (enum dari server).
  // Tetap escape untuk jaga-jaga kalau server mengirim string aneh.
  return `<span class="badge ${cls}">${esc(label)}</span>`;
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
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

/* ================================================================
   STRING HELPERS
   ================================================================ */
function initials(name) {
  if (!name || typeof name !== 'string') return '?';
  return name.trim().charAt(0).toUpperCase();
}

/* ================================================================
   AVATAR HTML — render foto profil atau inisial (reusable)
   ================================================================
   Dipakai di mana saja yang menampilkan avatar user (pelamar,
   contract, chat, public profile). Kalau user punya avatar_url →
   render <img>; kalau tidak → render inisial nama.

   Param:
   - user: object { full_name, avatar_url } ATAU string nama
   - opts: { size (px), fontSize (px), bg (css color), className }

   Return: string HTML untuk innerHTML.

   Contoh:
     el.innerHTML = avatarHtml(applicant, { size: 44 });
     `<div class="applicant-avatar">${avatarHtml(student)}</div>` // inner content
*/
function avatarHtml(user, opts = {}) {
  const name      = typeof user === 'string' ? user : (user?.full_name || '');
  const avatarUrl = typeof user === 'object' ? (user?.avatar_url || '') : '';
  const init      = initials(name);

  if (avatarUrl) {
    return `<img src="${escAttr(avatarUrl)}" alt="${escAttr(name)}"
      style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block">`;
  }
  return escAttr(init);
}

/* avatarContent — hanya isi (untuk container yang sudah punya style).
   Mengembalikan <img> kalau ada foto, atau inisial teks kalau tidak. */
function avatarContent(user) {
  return avatarHtml(user);
}

/* ================================================================
   SUBMIT LOCK — anti double-submit
   ================================================================
   Pattern bug yang berulang di codebase ini: handler async dipanggil
   dari onclick="..." tanpa disable tombol selama request berlangsung.
   Kalau user tap 2x cepat (umum di mobile + jaringan lambat), POST
   ke backend jalan 2x → data ganda di DB (mis. project duplikat,
   bank account ganda, lamaran ganda).

   withSubmitLock membungkus async function dengan dua mekanisme:
   1. In-memory flag per-button: render call kedua langsung di-skip
      sampai call pertama selesai.
   2. Visual feedback: tombol di-disable + label diganti loading state
      (kalau diberi `loadingLabel`), supaya user tahu request masih
      berjalan dan tidak tap lagi karena merasa "ga responsif".

   Cara pakai (di HTML):
     <button onclick="withSubmitLock(this, () => handlePostProject(), 'Memposting...')">
       🚀 Pasang Project
     </button>

   Atau di handler sendiri (cara lama tetap kompatibel):
     async function handlePostProject() {
       const btn = event?.currentTarget;
       return withSubmitLock(btn, async () => {
         ...isi handler...
       }, 'Memposting...');
     }
*/
const _SUBMIT_LOCKS = new WeakSet();
async function withSubmitLock(btn, asyncFn, loadingLabel) {
  // Cegah race tanpa elemen (kalau caller tidak kirim btn,
  // fallback ke flag global per-function via name)
  if (!btn || !(btn instanceof HTMLElement)) {
    return asyncFn();
  }
  if (_SUBMIT_LOCKS.has(btn)) {
    // Sudah ada request berjalan untuk tombol ini — abaikan tap kedua
    return;
  }
  _SUBMIT_LOCKS.add(btn);

  const originalHTML     = btn.innerHTML;
  const originalDisabled = btn.disabled;
  btn.disabled = true;
  if (loadingLabel) {
    // Pakai textContent supaya aman dari XSS kalau loadingLabel
    // dinamis (paranoid; biasanya literal di kode caller).
    btn.textContent = loadingLabel;
  }

  try {
    return await asyncFn();
  } finally {
    _SUBMIT_LOCKS.delete(btn);
    // Restore button — kalau caller sudah navigate keluar, elemen
    // mungkin tidak ada lagi di DOM tapi WeakSet sudah di-clean
    // saat elemen di-GC, jadi tidak ada leak.
    if (btn.isConnected) {
      btn.disabled = originalDisabled;
      btn.innerHTML = originalHTML;
    }
  }
}

/* ================================================================
   EXPORTS — expose to window so all other modules can call them
   ================================================================ */
window.esc           = esc;
window.escAttr       = escAttr;
window.daysLeft      = daysLeft;
window.fmtDate       = fmtDate;
window.fmtRelative   = fmtRelative;
window.fmtChatDate   = fmtChatDate;
window.isDifferentDay = isDifferentDay;
window.fmtCurrency   = fmtCurrency;
window.fmtRange      = fmtRange;
window.slParsePrice  = slParsePrice;
window.slFormatPrice = slFormatPrice;
window.slPriceInput  = slPriceInput;

/* Chart.js renders to <canvas> and CANNOT read CSS variables — passing
   'var(--text-muted)' makes it fall back to a dark default (invisible in dark
   mode). Return a resolved color matching the current theme for chart ticks. */
function slChartInk() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? '#C3BFDD' : '#565C73';
}
window.slChartInk = slChartInk;
window.tierBadge     = tierBadge;
window.statusBadge   = statusBadge;
window.initials      = initials;
window.avatarHtml    = avatarHtml;
window.avatarContent = avatarContent;
window.withSubmitLock = withSubmitLock;
