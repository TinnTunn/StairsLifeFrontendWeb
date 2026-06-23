/* ============================================================
 * StairsLife — DEMO / PREVIEW MODE  (untuk presentasi/screenshot)
 * ------------------------------------------------------------
 * INERT secara default. Aktif HANYA jika:
 *   - URL punya ?demo=1   (mis. http://localhost:5173/?demo=1), atau
 *   - localStorage['sl-demo'] === '1'
 *
 * Saat aktif:
 *   - login di-bypass (set user palsu) → bisa buka semua halaman
 *   - panggilan backend di-stub jadi kosong → tidak ada error toast,
 *     tidak ada "Failed to fetch", tidak ke-logout paksa
 *   - muncul panel navigator melayang: klik untuk loncat ke page mana pun
 *   - tombol Mahasiswa/Bisnis/Admin untuk ganti peran
 *   - tekan tombol "H" untuk sembunyikan panel (biar screenshot bersih)
 *
 * Hapus file ini + 1 baris <script> di index.html kalau sudah tak perlu.
 * ============================================================ */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var on = params.get('demo') === '1';
  try {
    if (on) localStorage.setItem('sl-demo', '1');
    if (!on && localStorage.getItem('sl-demo') === '1') on = true;
  } catch (e) {}
  if (!on) return; // produksi normal: tidak melakukan apa pun

  /* ---- 1. User palsu per-peran (login bypass) ---------------- */
  var MOCK = {
    mahasiswa: { id: 'demo-mhs', full_name: 'Rian Pratama', email: 'rian@ui.ac.id', role: 'mahasiswa', tier: 'menengah', is_verified: true, is_suspended: false, email_verified: true, avatar_url: null, university: 'Universitas Indonesia' },
    bisnis:    { id: 'demo-biz', full_name: 'Toko Kue Artisan Nusantara', email: 'owner@tokokue.id', role: 'bisnis', tier: 'pemula', is_verified: true, is_suspended: false, email_verified: true, avatar_url: null, company_name: 'Toko Kue Artisan Nusantara' },
    admin:     { id: 'demo-adm', full_name: 'Admin StairsLife', email: 'admin@stairslife.id', role: 'admin', tier: 'pemula', is_verified: true, is_suspended: false, email_verified: true, avatar_url: null }
  };
  var currentRole = 'mahasiswa';

  function fakeJwt(u) {
    function b64(o) { return btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
    var head = b64({ alg: 'HS256', typ: 'JWT' });
    var body = b64({ sub: u.id, email: u.email, role: u.role, exp: Math.floor(Date.now() / 1000) + 86400 });
    return head + '.' + body + '.demo-signature';
  }
  function setRole(role) {
    currentRole = role;
    var u = MOCK[role];
    try {
      if (window.TokenManager) { window.TokenManager.set(fakeJwt(u)); window.TokenManager.setUser(u); }
    } catch (e) {}
    paintRolePills();
  }

  /* ---- 2. Netralkan backend (no error toast / no logout) ----- */
  // Nilai kosong yang aman diakses: array kosong + property apa pun balik kosong,
  // jadi kode render tidak pernah crash walau mengakses field yang tak ada.
  function emptyData() {
    return new Proxy([], {
      get: function (t, p) {
        if (p === 'then') return undefined;                 // bukan thenable
        if (p === Symbol.iterator) return t[Symbol.iterator].bind(t);
        if (p in t) return typeof t[p] === 'function' ? t[p].bind(t) : t[p];
        return emptyData();                                  // nested aman
      }
    });
  }
  function stubBackend() {
    if (typeof window.apiFetch === 'function') {
      window.apiFetch = function (endpoint) {
        var ep = String(endpoint || '');
        // Profil sendiri → kembalikan user palsu supaya nama & greeting tampil
        // (bukan "Memuat profil..."). Hanya '/users/me' persis, bukan sub-path.
        if (/^\/users\/me(\?|$)/.test(ep)) {
          return Promise.resolve({ success: true, data: MOCK[currentRole], message: '' });
        }
        return Promise.resolve({ success: true, data: emptyData(), message: '' });
      };
    }
    // jangan munculkan toast error saat demo
    if (typeof window.showToast === 'function') {
      var _t = window.showToast;
      window.showToast = function (msg, type) { if (type === 'error') return; try { return _t(msg, type); } catch (e) {} };
    }
    // matikan WebSocket (hindari spam koneksi)
    if (window.SocketManager) {
      window.SocketManager.connect = function () {};
      window.SocketManager.reconnect = function () {};
      try { window.SocketManager.disconnect(); } catch (e) {}
    }
  }

  /* ---- 3. Navigasi bebas (lewati route-guard) ---------------- */
  function roleForScreen(id) {
    if (id === 'screen-business' || id === 'screen-post-project') return 'bisnis';
    if (id === 'screen-admin' || id === 'screen-admin-withdrawals') return 'admin';
    if (id === 'screen-student' || id === 'screen-wallet' || id === 'screen-verification') return 'mahasiswa';
    return currentRole;
  }
  function go(id) {
    setRole(roleForScreen(id));
    try {
      if (typeof window._showScreen === 'function') window._showScreen(id); // bypass guard
      else { document.querySelectorAll('.screen.active').forEach(function (s) { s.classList.remove('active'); }); document.getElementById(id) && document.getElementById(id).classList.add('active'); }
      window.scrollTo(0, 0);
    } catch (e) { console.warn('[demo] gagal buka', id, e); }
    markActive(id);
  }

  /* ---- 4. Daftar semua halaman ------------------------------ */
  var GROUPS = [
    ['Auth & Onboarding', [
      ['Landing', 'screen-landing'], ['Onboarding', 'screen-onboarding'], ['Login', 'screen-login'],
      ['Register', 'screen-register'], ['Lupa Password', 'screen-forgot'], ['Cek Email', 'screen-check-email'],
      ['Verifying Email', 'screen-email-verifying'], ['Resend Verifikasi', 'screen-resend-verification'],
      ['Reset Password', 'screen-reset-password']
    ]],
    ['Mahasiswa', [
      ['Dashboard', 'screen-student'], ['Detail Project', 'screen-project-detail'],
      ['Portfolio', 'screen-portfolio'], ['Profil Publik', 'screen-public-profile']
    ]],
    ['Bisnis', [
      ['Dashboard', 'screen-business'], ['Pasang Project', 'screen-post-project']
    ]],
    ['Admin', [
      ['Dashboard', 'screen-admin'], ['Penarikan', 'screen-admin-withdrawals']
    ]],
    ['Pembayaran & Kontrak', [
      ['Wallet', 'screen-wallet'], ['Riwayat Pembayaran', 'screen-payment-history'],
      ['Rekening Bank', 'screen-bank-account'], ['Detail Kontrak', 'screen-contract-detail'],
      ['Upload Deliverable', 'screen-deliverable-upload'], ['Beri Ulasan', 'screen-review-submit']
    ]],
    ['Komunikasi & Lainnya', [
      ['Chat List', 'screen-chat-list'], ['Chat Room', 'screen-chat-room'],
      ['Notifikasi', 'screen-notifications'], ['Verifikasi KTM', 'screen-verification'],
      ['Edit Profil', 'screen-edit-profile'], ['Pengaturan', 'screen-settings'],
      ['Bantuan', 'screen-help'], ['Daftar Sengketa', 'screen-dispute-list'],
      ['Sengketa Baru', 'screen-new-dispute']
    ]]
  ];

  /* ---- 5. UI panel ------------------------------------------ */
  var panel, rolePills = {}, screenBtns = {};
  var CSS = ''
    + '#sl-demo{position:fixed;right:14px;bottom:14px;z-index:99999;width:268px;max-height:78vh;'
    + 'display:flex;flex-direction:column;font-family:Manrope,Segoe UI,system-ui,sans-serif;'
    + 'background:rgba(15,16,34,.92);color:#EEF1FB;border:1px solid rgba(150,170,255,.22);'
    + 'border-radius:14px;box-shadow:0 24px 60px -12px rgba(0,0,0,.6);backdrop-filter:blur(14px);'
    + '-webkit-backdrop-filter:blur(14px);overflow:hidden;font-size:13px}'
    + '#sl-demo.hidden{transform:translateX(calc(100% + 24px));transition:transform .3s cubic-bezier(.16,1,.3,1)}'
    + '#sl-demo{transition:transform .3s cubic-bezier(.16,1,.3,1)}'
    + '#sl-demo .hd{padding:11px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(150,170,255,.18);background:linear-gradient(135deg,#5B5BF5,#3535B8)}'
    + '#sl-demo .hd b{font-size:13px;font-weight:800;letter-spacing:-.01em;flex:1;color:#fff}'
    + '#sl-demo .hd .x{cursor:pointer;border:none;background:rgba(255,255,255,.18);color:#fff;width:24px;height:24px;border-radius:7px;font-weight:700;line-height:1}'
    + '#sl-demo .roles{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid rgba(150,170,255,.14)}'
    + '#sl-demo .roles button{flex:1;cursor:pointer;border:1px solid rgba(150,170,255,.28);background:rgba(150,170,255,.08);color:#AFB7D4;border-radius:8px;padding:7px 4px;font-size:11.5px;font-weight:700}'
    + '#sl-demo .roles button.on{background:#A5A4FF;color:#0E0D3D;border-color:#A5A4FF}'
    + '#sl-demo .body{overflow-y:auto;padding:6px 10px 10px}'
    + '#sl-demo .grp{margin-top:10px}'
    + '#sl-demo .grp h6{margin:0 0 5px;font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#7C85A8;font-weight:800}'
    + '#sl-demo .grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}'
    + '#sl-demo .grid button{cursor:pointer;text-align:left;border:1px solid rgba(150,170,255,.16);background:rgba(150,170,255,.06);color:#EEF1FB;border-radius:7px;padding:7px 8px;font-size:11.5px;font-weight:600;line-height:1.2;transition:background .12s,border-color .12s}'
    + '#sl-demo .grid button:hover{background:rgba(91,91,245,.35);border-color:#807EFA}'
    + '#sl-demo .grid button.on{background:#5B5BF5;border-color:#5B5BF5;color:#fff}'
    + '#sl-demo .ft{padding:8px 12px;border-top:1px solid rgba(150,170,255,.16);display:flex;gap:8px;align-items:center}'
    + '#sl-demo .ft small{color:#7C85A8;font-size:10.5px;flex:1;line-height:1.3}'
    + '#sl-demo .ft .out{cursor:pointer;border:none;background:rgba(237,46,78,.22);color:#FF93A6;border-radius:7px;padding:6px 9px;font-size:11px;font-weight:700}'
    + '#sl-demo-tab{position:fixed;right:14px;bottom:14px;z-index:99998;cursor:pointer;display:none;'
    + 'background:linear-gradient(135deg,#5B5BF5,#3535B8);color:#fff;border:none;border-radius:10px;padding:9px 13px;font-family:Manrope,sans-serif;font-weight:800;font-size:12px;box-shadow:0 10px 30px -8px rgba(91,91,245,.7)}';

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function paintRolePills() {
    Object.keys(rolePills).forEach(function (r) { rolePills[r].classList.toggle('on', r === currentRole); });
  }
  function markActive(id) {
    Object.keys(screenBtns).forEach(function (sid) { screenBtns[sid].classList.toggle('on', sid === id); });
  }

  function build() {
    var style = el('style'); style.textContent = CSS; document.head.appendChild(style);

    panel = el('div'); panel.id = 'sl-demo';

    var hd = el('div', 'hd');
    hd.appendChild(el('b', null, '🎬 Demo Mode'));
    var hide = el('button', 'x', 'H'); hide.title = 'Sembunyikan (H)'; hide.onclick = toggleHide; hd.appendChild(hide);
    panel.appendChild(hd);

    var roles = el('div', 'roles');
    [['mahasiswa', 'Mahasiswa', 'screen-student'], ['bisnis', 'Bisnis', 'screen-business'], ['admin', 'Admin', 'screen-admin']].forEach(function (r) {
      var b = el('button', null, r[1]); rolePills[r[0]] = b;
      b.onclick = function () { setRole(r[0]); go(r[2]); };
      roles.appendChild(b);
    });
    panel.appendChild(roles);

    var body = el('div', 'body');
    GROUPS.forEach(function (g) {
      var grp = el('div', 'grp'); grp.appendChild(el('h6', null, g[0]));
      var grid = el('div', 'grid');
      g[1].forEach(function (s) {
        var b = el('button', null, s[0]); screenBtns[s[1]] = b;
        b.onclick = function () { go(s[1]); };
        grid.appendChild(b);
      });
      grp.appendChild(grid); body.appendChild(grp);
    });
    panel.appendChild(body);

    var ft = el('div', 'ft');
    ft.appendChild(el('small', null, 'Tekan H untuk sembunyi • data kosong (belum konek backend)'));
    var out = el('button', 'out', 'Keluar'); out.title = 'Matikan demo mode';
    out.onclick = function () { try { localStorage.removeItem('sl-demo'); } catch (e) {} var u = location.pathname; location.href = u; };
    ft.appendChild(out);
    panel.appendChild(ft);

    document.body.appendChild(panel);

    var tab = el('button'); tab.id = 'sl-demo-tab'; tab.textContent = '🎬 Demo'; tab.onclick = toggleHide;
    document.body.appendChild(tab);
    window._slDemoTab = tab;

    paintRolePills();
  }

  function toggleHide() {
    var hidden = panel.classList.toggle('hidden');
    window._slDemoTab.style.display = hidden ? 'block' : 'none';
  }

  // hotkey H (kecuali sedang mengetik di input)
  window.addEventListener('keydown', function (e) {
    var t = e.target; var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (!typing && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); toggleHide(); }
  });

  /* ---- 6. Boot --------------------------------------------- */
  // Pasang stub backend + user palsu SEsegera mungkin (sinkron) supaya
  // bootstrap app tidak sempat memunculkan error koneksi / logout paksa.
  stubBackend();
  setRole('mahasiswa');
  function init() {
    build();
    console.log('%c[StairsLife] Demo mode AKTIF — login di-bypass, backend di-stub. Klik panel untuk lihat semua page. (Keluar: tombol "Keluar")', 'color:#5B5BF5;font-weight:bold');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
