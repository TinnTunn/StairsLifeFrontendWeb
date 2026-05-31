/**
 * StairsLife — core/auth.js
 * Login, register (multi-step), KTM upload, logout.
 * Depends on: AuthAPI, UploadAPI, showToast, goTo, state, animateProgressBar.
 * Phase 3 — Modularisasi.
 */
'use strict';

/* ================================================================
   REGISTER STATE
   ================================================================ */
const REG = {
  name: '', email: '', password: '', confirmPassword: '',
  uni: '', major: '', semester: '',
  bizName: '', phone: '',
  ktmUploaded: false, ktmName: '', ktmUrl: '', ktmFile: null,
  selfieUploaded: false, selfieName: '', selfieUrl: '', selfieFile: null,
};

/* ================================================================
   LOGIN
   ================================================================ */
function initLogin() {
  const emailEl = document.getElementById('login-email');
  const passEl  = document.getElementById('login-password');
  if (emailEl) emailEl.value = '';
  if (passEl)  passEl.value  = '';
  switchLoginRole(0);
}

function switchLoginRole(i) {
  state.loginRole = i;
  document.querySelectorAll('.login-role-tab').forEach((t, j) => t.classList.toggle('active', j === i));

  const hint     = document.getElementById('admin-hint');
  if (hint) hint.style.display = i === 2 ? 'flex' : 'none';

  const emailInput = document.getElementById('login-email');
  const passInput  = document.getElementById('login-password');
  const emailHint  = document.getElementById('login-email-hint');
  const ssoBtn     = document.getElementById('login-sso-btn');

  if (emailInput) emailInput.value = '';
  if (passInput)  passInput.value  = '';

  if (emailInput) {
    const hints = ['nama@kampus.ac.id', 'nama@bisnis.com', 'admin@stairslife.id'];
    emailInput.placeholder = hints[i];
  }
  if (emailHint) {
    const hintTxt = ['Disarankan menggunakan email kampus (.ac.id)', 'Gunakan email Gmail atau email bisnis', ''];
    emailHint.textContent = hintTxt[i];
  }
  if (ssoBtn) ssoBtn.style.display = i === 0 ? '' : 'none';
}

// Flag untuk cegah double-submit handleLogin tanpa mengubah signature
// (handleLogin dipanggil dari beberapa tempat termasuk Enter key handler).
let _loginInFlight = false;

async function handleLogin() {
  // Anti double-submit guard
  if (_loginInFlight) return;

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showToast('Email dan password wajib diisi', 'error');
    return;
  }

  const btn = document.getElementById('login-btn');
  btn.classList.add('loading');
  if (btn) btn.disabled = true;
  _loginInFlight = true;

  try {
    const res  = await AuthAPI.login({ email, password });
    const user = res.data.user;
    if (user) TokenManager.setUser(user);

    if (user.is_suspended) {
      showSuspendedModal(user.suspension_reason || 'Melanggar ketentuan penggunaan platform.');
      return;
    }

    showToast(`Selamat datang, ${user.full_name}! 👋`, 'success');

    // Connect WebSocket SATU KALI.
    // initNotifWebsocket() tidak perlu panggil connect() lagi karena kita
    // sudah panggil di sini. Ini menghindari race condition double-connect
    // yang muncul sebagai 2 log "Connected" di backend.
    // reconnect (bukan connect) — paksa socket pakai token akun yang BARU
    // login. connect() biasa di-skip kalau ada socket lama yg masih hidup,
    // bikin pesan tersimpan atas nama user sebelumnya.
    if (typeof SocketManager !== 'undefined') SocketManager.reconnect();
    if (typeof initNotifWebsocket === 'function') initNotifWebsocket();
    if (typeof refreshNotifBadge === 'function') refreshNotifBadge();
    if (user.role === 'admin')       goTo('screen-admin');
    else if (user.role === 'bisnis') goTo('screen-business');
    else                             goTo('screen-student');
  } catch (error) {
    // Cek suspended dari backend error
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.suspended) {
        showSuspendedModal(parsed.reason || 'Melanggar ketentuan penggunaan platform.');
        return;
      }
    } catch (_) {}

    // Petakan pesan error ke bahasa yang lebih ramah
    const raw = error.message || '';
    let msg = raw;

    if (raw.toLowerCase().includes('password') ||
        raw.toLowerCase().includes('invalid') ||
        raw.toLowerCase().includes('credentials') ||
        raw.toLowerCase().includes('unauthorized') ||
        raw === 'Email atau password salah') {
      msg = 'Email atau password salah. Coba lagi.';
    } else if (raw.toLowerCase().includes('not found') ||
               raw.toLowerCase().includes('user') ||
               raw.toLowerCase().includes('tidak ditemukan')) {
      msg = 'Akun tidak ditemukan. Cek kembali email kamu.';
    } else if (raw.toLowerCase().includes('suspended') ||
               raw.toLowerCase().includes('banned')) {
      msg = 'Akun kamu telah disuspend. Hubungi support.';
    } else if (raw.toLowerCase().includes('server') || raw.startsWith('HTTP 5')) {
      msg = 'Server sedang bermasalah. Coba lagi dalam beberapa saat.';
    }

    showToast(msg, 'error');

    const form = document.getElementById('login-form') ||
                 document.querySelector('#screen-login .login-card') ||
                 document.querySelector('#screen-login .card');
    if (form) {
      form.style.animation = 'none';
      void form.offsetWidth;
      form.style.animation = 'shake 0.4s ease';
    }
  } finally {
    _loginInFlight = false;
    btn.classList.remove('loading');
    if (btn) btn.disabled = false;
  }
}

function togglePassword(inputId, eyeId) {
  const inp = document.getElementById(inputId);
  const eye = document.getElementById(eyeId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  eye.innerHTML = inp.type === 'text'
    ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

let _forgotInFlight = false;
async function handleForgotPassword() {
  if (_forgotInFlight) return;
  const email = document.getElementById('forgot-email').value.trim();
  if (!email || !email.includes('@')) {
    showToast('Masukkan email yang valid', 'error');
    return;
  }

  const btn = document.getElementById('forgot-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  _forgotInFlight = true;

  try {
    await AuthAPI.forgotPassword(email);
    // Selalu tampilkan pesan sukses (backend tidak expose apakah email ada)
    showToast(
      'Jika email kamu terdaftar, instruksi reset password sudah dikirim. Cek inbox / spam ya.',
      'success',
    );
    setTimeout(() => goTo('screen-login'), 2500);
  } catch (error) {
    // Jika backend error (network/server), tetap tampilkan pesan ramah
    showToast(
      'Jika email kamu terdaftar, instruksi reset password sudah dikirim. Cek inbox / spam ya.',
      'success',
    );
    setTimeout(() => goTo('screen-login'), 2500);
  } finally {
    _forgotInFlight = false;
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

/* ================================================================
   REGISTER — MULTI-STEP
   ================================================================ */
function initRegister() {
  state.regStep    = 1;
  state.regRole    = null;
  state.regSkipKtm = false;
  Object.assign(REG, {
    name: '', email: '', password: '', confirmPassword: '',
    uni: '', major: '', semester: '',
    bizName: '', phone: '',
    ktmUploaded: false, ktmName: '', ktmUrl: '', ktmFile: null,
    selfieUploaded: false, selfieName: '', selfieUrl: '', selfieFile: null,
  });
  renderRegStep();
}

function regBack() {
  if (state.regStep > 1) { state.regStep--; renderRegStep(); }
  else goTo('screen-landing');
}

function renderRegStep() {
  renderStepIndicator();
  const contentEl = document.getElementById('reg-content');
  contentEl.className = 'anim-up';
  void contentEl.offsetWidth;
  contentEl.innerHTML = buildRegStepHTML();
  bindRegEvents();
}

function totalRegSteps() { return state.regRole === 'student' ? 4 : 3; }

function renderStepIndicator() {
  const total  = totalRegSteps();
  const labels = state.regRole === 'student'
    ? ['Peran', 'Data', 'KTM', 'Selesai']
    : ['Peran', 'Data', 'Selesai'];
  let html = '';
  for (let i = 1; i <= total; i++) {
    if (i > 1) html += `<div class="step-line${i - 1 < state.regStep ? ' done' : ''}"></div>`;
    const cls   = i < state.regStep ? 'done' : i === state.regStep ? 'active' : 'upcoming';
    const inner = i < state.regStep ? '✓' : i;
    html += `<div class="step-dot ${cls}" title="${labels[i - 1]}">${inner}</div>`;
  }
  document.getElementById('reg-steps').innerHTML = html;
}

function buildRegStepHTML() {
  switch (state.regStep) {
    case 1: return buildStep1();
    case 2: return buildStep2();
    case 3: return state.regRole === 'student' ? buildStepKTM() : buildStepSuccess();
    case 4: return buildStepSuccess();
    default: return '';
  }
}

function buildStep1() {
  const s = (r) => state.regRole === r;
  return `
    <div style="text-align:center; margin-bottom:28px">
      <h2 style="font-size:22px; font-weight:800; margin-bottom:6px">Kamu daftar sebagai apa?</h2>
      <p style="font-size:14px; color:var(--text-secondary)">Pilih satu untuk melanjutkan</p>
    </div>
    <div class="role-card${s('student') ? ' selected' : ''}" id="role-student" onclick="selectRole('student')" role="button" tabindex="0">
      <div class="role-card__icon">🎓</div>
      <div>
        <div class="role-card__title">Mahasiswa</div>
        <div class="role-card__sub">Saya mahasiswa aktif yang ingin mencari project freelance</div>
      </div>
      <div class="role-card__check"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" width="14"><polyline points="20 6 9 17 4 12"/></svg></div>
    </div>
    <div style="height:12px"></div>
    <div class="role-card${s('business') ? ' selected' : ''}" id="role-business" onclick="selectRole('business')" role="button" tabindex="0">
      <div class="role-card__icon">🏢</div>
      <div>
        <div class="role-card__title">Pemilik Bisnis / UMKM</div>
        <div class="role-card__sub">Saya butuh bantuan dari mahasiswa untuk project bisnis saya</div>
      </div>
      <div class="role-card__check"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" width="14"><polyline points="20 6 9 17 4 12"/></svg></div>
    </div>
    <div style="height:24px"></div>
    <button class="btn btn-primary btn-full" style="height:48px;font-size:15px${!state.regRole ? ';opacity:.5;cursor:not-allowed' : ''}" ${!state.regRole ? 'disabled' : ''} id="step1-next" onclick="regNext()">
      Lanjut →
    </button>
    <div style="text-align:center; margin-top:16px; font-size:14px; color:var(--text-secondary)">
      Sudah punya akun? <button class="btn" style="padding:0; color:var(--accent); font-weight:600; font-size:14px" onclick="goTo('screen-login')">Masuk</button>
    </div>`;
}

function buildStep2() {
  const isStudent = state.regRole === 'student';
  return `
    <div class="card card-p-lg">
      <h3 style="font-size:18px; font-weight:700; margin-bottom:20px">${isStudent ? 'Data Mahasiswa' : 'Data Bisnis'}</h3>
      <div style="display:grid; gap:14px">
        <div class="form-group">
          <label class="form-label">${isStudent ? 'Nama Lengkap' : 'Nama Perusahaan'} <span class="req">*</span></label>
          <input class="form-input" id="reg-name" type="text" placeholder="${isStudent ? 'Contoh: Rian Pratama' : 'Contoh: Toko Kue Artisan'}" value="${isStudent ? REG.name : REG.bizName}">
        </div>
        ${isStudent ? `
        <div class="form-group">
          <label class="form-label">Universitas <span class="req">*</span></label>
          <input class="form-input" id="reg-uni" type="text" placeholder="Contoh: Universitas Indonesia" value="${REG.uni}">
        </div>
        <div class="form-group">
          <label class="form-label">Jurusan / Program Studi <span class="req">*</span></label>
          <input class="form-input" id="reg-major" type="text" placeholder="Contoh: Ilmu Komputer" value="${REG.major}">
        </div>
        <div class="form-group">
          <label class="form-label">Semester <span class="req">*</span></label>
          <select class="form-select" id="reg-semester">
            <option value="">Pilih semester...</option>
            ${Array.from({ length: 14 }, (_, i) => `<option value="${i + 1}"${REG.semester == i + 1 ? ' selected' : ''}>Semester ${i + 1}</option>`).join('')}
          </select>
        </div>` : `
        <div class="form-group">
          <label class="form-label">Nomor WhatsApp <span class="req">*</span></label>
          <div class="input-wrap">
            <svg class="input-icon" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14h-0z"/></svg>
            <input class="form-input has-icon" id="reg-phone" type="tel" placeholder="+628xxxxxxxxxx" value="${REG.phone}">
          </div>
        </div>`}
        <div class="form-group">
          <label class="form-label">${isStudent ? 'Email Kampus' : 'Email Bisnis'} <span class="req">*</span></label>
          <div class="input-wrap">
            <svg class="input-icon" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <input class="form-input has-icon" id="reg-email" type="email" placeholder="${isStudent ? 'nama@kampus.ac.id' : 'nama@bisnis.com'}" value="${REG.email}">
          </div>
          ${isStudent ? '<div class="form-hint">Disarankan email .ac.id untuk verifikasi lebih cepat</div>' : ''}
        </div>
        <div class="form-group">
          <label class="form-label">Password <span class="req">*</span></label>
          <div class="input-wrap">
            <svg class="input-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            <input class="form-input has-icon has-eye" id="reg-password" type="password" placeholder="Min. 8 karakter, huruf + angka" value="${REG.password}">
            <svg class="input-eye" viewBox="0 0 24 24" onclick="togglePassword('reg-password','reg-pw-eye')" id="reg-pw-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Konfirmasi Password <span class="req">*</span></label>
          <div class="input-wrap">
            <svg class="input-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            <input class="form-input has-icon" id="reg-confirm" type="password" placeholder="Ulangi password" value="${REG.confirmPassword}">
          </div>
        </div>
        <div class="checkbox-row">
          <input type="checkbox" id="reg-terms">
          <label class="chk-label" for="reg-terms">Saya setuju dengan <a href="#">Syarat &amp; Ketentuan</a> dan <a href="#">Kebijakan Privasi</a></label>
        </div>
        <button class="btn btn-primary btn-full" style="height:48px;font-size:15px" onclick="regStep2Next()">Lanjut →</button>
      </div>
    </div>`;
}

function buildStepKTM() {
  const ktmUploaded    = REG.ktmUploaded;
  const selfieUploaded = REG.selfieUploaded;
  const bothUploaded   = ktmUploaded && selfieUploaded;

  return `
    <div class="card card-p-lg">
      <div style="text-align:center;margin-bottom:20px">
        <div style="width:72px;height:72px;border-radius:50%;background:var(--accent-light);
                    display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" width="36" height="36">
            <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
        </div>
        <h3 style="font-size:18px;font-weight:700;margin-bottom:8px">Verifikasi KTM</h3>
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.6">
          Upload 2 foto untuk membuktikan kamu mahasiswa aktif.<br>
          Diproses admin dalam <strong>1–2 hari kerja</strong>.
        </p>
      </div>

      <!-- FOTO 1: KTM -->
      <div style="margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px">
          <span style="background:var(--accent);color:white;width:20px;height:20px;border-radius:50%;
                        display:inline-flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0">1</span>
          Foto KTM <span style="color:var(--rose);font-size:11px">*wajib</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">
          📋 Foto KTM kamu — pastikan semua teks terbaca jelas (nama, NIM, universitas)
        </p>
        <input type="file" id="ktm-file-input" accept="image/*" style="display:none" onchange="handleKtmFileChange(event)">
        <div class="ktm-upload-area${ktmUploaded ? ' uploaded' : ''}" id="ktm-drop"
             onclick="pickKtmFile()" role="button" tabindex="0" aria-label="Upload foto KTM">
          ${ktmUploaded ? `
            <svg viewBox="0 0 24 24" style="stroke:var(--teal-dark)"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <p style="font-size:13px;font-weight:600;color:var(--teal-dark);margin:0">${REG.ktmName}</p>
            <p style="font-size:11px;color:var(--teal-dark);margin-top:3px">Tap untuk ganti</p>
          ` : `
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p style="font-size:13px;font-weight:600;color:var(--text-secondary);margin:0">Tap untuk upload foto KTM</p>
            <p style="font-size:11px;color:var(--text-muted);margin-top:3px">JPG, PNG (maks. 5MB)</p>
          `}
        </div>
      </div>

      <!-- FOTO 2: Selfie pegang KTM -->
      <div style="margin-bottom:20px">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px">
          <span style="background:var(--accent);color:white;width:20px;height:20px;border-radius:50%;
                        display:inline-flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0">2</span>
          Selfie memegang KTM <span style="color:var(--rose);font-size:11px">*wajib</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">
          🤳 Foto kamu sambil memegang KTM — wajah dan KTM harus terlihat jelas dalam 1 foto
        </p>
        <input type="file" id="selfie-file-input" accept="image/*" style="display:none" onchange="handleSelfieFileChange(event)">
        <div class="ktm-upload-area${selfieUploaded ? ' uploaded' : ''}" id="selfie-drop"
             onclick="pickSelfieFile()" role="button" tabindex="0" aria-label="Upload selfie memegang KTM">
          ${selfieUploaded ? `
            <svg viewBox="0 0 24 24" style="stroke:var(--teal-dark)"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <p style="font-size:13px;font-weight:600;color:var(--teal-dark);margin:0">${REG.selfieName}</p>
            <p style="font-size:11px;color:var(--teal-dark);margin-top:3px">Tap untuk ganti</p>
          ` : `
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 012-2h6a2 2 0 012 2v1.662"/></svg>
            <p style="font-size:13px;font-weight:600;color:var(--text-secondary);margin:0">Tap untuk upload selfie + KTM</p>
            <p style="font-size:11px;color:var(--text-muted);margin-top:3px">JPG, PNG (maks. 5MB)</p>
          `}
        </div>
      </div>

      <!-- Tips -->
      <div class="info-box" style="margin-bottom:20px;text-align:left">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.7">
          <strong>Tips agar cepat diverifikasi:</strong><br>
          ✅ Foto di tempat terang<br>
          ✅ KTM tidak blur/terpotong<br>
          ✅ Wajah terlihat jelas di selfie<br>
          ❌ Jangan pakai foto editan/filter
        </div>
      </div>

      <div style="display:grid;gap:10px">
        <button class="btn btn-primary btn-full" style="height:48px;font-size:15px${!bothUploaded ? ';opacity:.5;cursor:not-allowed' : ''}"
                ${!bothUploaded ? 'disabled' : ''} id="ktm-next-btn" onclick="regNext()">
          ${bothUploaded ? 'Lanjut →' : `Upload ${!ktmUploaded ? 'KTM' : 'Selfie'} dulu`}
        </button>
        <button class="btn btn-ghost btn-full" style="height:44px" onclick="skipKtm()">
          Lewati & Verifikasi Nanti
        </button>
      </div>
    </div>`;
}

function buildStepSuccess() {
  const isStudent = state.regRole === 'student';
  const skipped   = state.regSkipKtm;
  const msg = isStudent
    ? (skipped
        ? 'Selamat datang! Jangan lupa verifikasi KTM kamu di menu Profil untuk mulai melamar project.'
        : 'Selamat datang! KTM kamu sedang diproses (1-2 hari kerja). Mulai jelajahi project sekarang!')
    : 'Selamat datang! Sekarang kamu bisa mulai pasang project pertama kamu.';
  return `
    <div class="card card-p-lg" style="text-align:center">
      <div class="success-icon"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
      <h3 style="font-size:22px; font-weight:800; margin-bottom:10px">Akun Berhasil Dibuat! 🎉</h3>
      <p style="font-size:14px; color:var(--text-secondary); line-height:1.7; margin-bottom:28px">${msg}</p>
      <button class="btn btn-primary btn-full" style="height:48px;font-size:15px" id="reg-finish-btn" onclick="finishRegistration()">
        <span class="btn-label">Mulai Jelajahi →</span>
        <svg class="btn-loader" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" width="20"><circle cx="12" cy="12" r="10" style="animation:spin 0.8s linear infinite"/></svg>
      </button>
    </div>`;
}

function bindRegEvents() {
  // Tidak ada event handler khusus per step lagi setelah OTP step dihapus.
  // Fungsi dipertahankan agar renderRegStep() tetap aman memanggilnya.
}

function selectRole(r) {
  state.regRole = r;
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`role-${r}`)?.classList.add('selected');
  const btn = document.getElementById('step1-next');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
}

function regNext() {
  state.regStep++;
  renderRegStep();
}

function regStep2Next() {
  const isStudent = state.regRole === 'student';
  const nameEl    = document.getElementById('reg-name');
  const emailEl   = document.getElementById('reg-email');
  const passEl    = document.getElementById('reg-password');
  const confirmEl = document.getElementById('reg-confirm');
  const termsEl   = document.getElementById('reg-terms');

  if (!nameEl?.value.trim())  { showToast('Nama wajib diisi', 'error'); return; }
  if (!emailEl?.value.trim() || !emailEl.value.includes('@')) { showToast('Email tidak valid', 'error'); return; }
  if (!passEl?.value || passEl.value.length < 8) { showToast('Password minimal 8 karakter', 'error'); return; }
  if (passEl.value !== confirmEl?.value) { showToast('Password tidak cocok', 'error'); return; }
  if (!termsEl?.checked) { showToast('Kamu harus menyetujui Syarat & Ketentuan', 'error'); return; }

  if (isStudent) {
    const uniEl = document.getElementById('reg-uni');
    const majEl = document.getElementById('reg-major');
    const semEl = document.getElementById('reg-semester');
    if (!uniEl?.value.trim()) { showToast('Universitas wajib diisi', 'error'); return; }
    if (!majEl?.value.trim()) { showToast('Jurusan wajib diisi', 'error'); return; }
    if (!semEl?.value) { showToast('Pilih semester kamu', 'error'); return; }
    REG.uni = uniEl.value; REG.major = majEl.value; REG.semester = semEl.value;
  } else {
    const phoneEl = document.getElementById('reg-phone');
    if (!phoneEl?.value.trim()) { showToast('Nomor WhatsApp wajib diisi', 'error'); return; }
    REG.phone = phoneEl.value; REG.bizName = nameEl.value;
  }
  REG.name = nameEl.value; REG.email = emailEl.value;
  REG.password = passEl.value; REG.confirmPassword = confirmEl.value;
  regNext();
}

/* ================================================================
   KTM UPLOAD
   ================================================================ */
async function handleKtmFileChange(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Hanya file gambar (JPG/PNG) yang diizinkan', 'error');
    event.target.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran file maksimal 5MB', 'error');
    event.target.value = '';
    return;
  }

  REG.ktmFile     = file;
  REG.ktmUploaded = true;
  REG.ktmName     = file.name;
  REG.ktmUrl      = '';
  renderRegStep();
  showToast('Foto KTM berhasil dipilih ✅', 'success');
  if (event && event.target) event.target.value = '';
}

function pickKtmFile() {
  const input = document.getElementById('ktm-file-input');
  if (input) input.click();
}

/* ================================================================
   SELFIE UPLOAD (pegang KTM)
   ================================================================ */
async function handleSelfieFileChange(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Hanya file gambar (JPG/PNG) yang diizinkan', 'error');
    event.target.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran file maksimal 5MB', 'error');
    event.target.value = '';
    return;
  }

  REG.selfieFile     = file;
  REG.selfieUploaded = true;
  REG.selfieName     = file.name;
  REG.selfieUrl      = '';
  renderRegStep();
  showToast('Foto selfie berhasil dipilih ✅', 'success');
  if (event && event.target) event.target.value = '';
}

function pickSelfieFile() {
  const input = document.getElementById('selfie-file-input');
  if (input) input.click();
}

// Backwards compat shim
function triggerKtmUpload()  { pickKtmFile(); }
function simulateKtmUpload() { triggerKtmUpload(); }

function skipKtm() {
  state.regSkipKtm = true;
  regNext();
}

let _finishRegInFlight = false;
async function finishRegistration() {
  if (_finishRegInFlight) return;
  const btn = document.getElementById('reg-finish-btn');
  if (btn) { btn.classList.add('loading'); btn.disabled = true; }
  _finishRegInFlight = true;

  try {
    const role = state.regRole === 'business' ? 'bisnis' : 'mahasiswa';

    // Kirim payload sesuai role.
    // - Mahasiswa: university, major, semester (schema users punya kolomnya)
    // - Bisnis:    company_name, phone (BELUM ada kolom di schema users —
    //              backend akan terima tapi skip simpan; tambah kolom via
    //              migration kalau ingin disimpan)
    const payload = {
      full_name: role === 'bisnis' ? REG.bizName : REG.name,
      email:     REG.email,
      password:  REG.password,
      role,
      ...(role === 'mahasiswa' && {
        university: REG.uni || undefined,
        major:      REG.major || undefined,
        semester:   REG.semester ? Number(REG.semester) : undefined,
      }),
      ...(role === 'bisnis' && {
        phone:        REG.phone || undefined,
        company_name: REG.bizName || undefined,
      }),
    };

    const regRes = await AuthAPI.register(payload);

    const user  = regRes.data?.user;
    const token = regRes.data?.token;

    if (!token) throw new Error('Token tidak diterima dari server');

    // Simpan token dan user
    TokenManager.set(token);
    TokenManager.setUser(user);

    // Upload KTM + selfie lalu submit verifikasi setelah punya token
    if (role === 'mahasiswa' && REG.ktmFile && !state.regSkipKtm) {
      try {
        // Upload KTM
        const ktmUploadRes = await UploadAPI.uploadFile(REG.ktmFile, 'ktm');
        REG.ktmUrl = ktmUploadRes?.data?.url || '';

        // Upload selfie kalau ada
        let selfieUrl = '';
        if (REG.selfieFile) {
          const selfieUploadRes = await UploadAPI.uploadFile(REG.selfieFile, 'ktm');
          selfieUrl = selfieUploadRes?.data?.url || '';
        }

        if (REG.ktmUrl) {
          await UsersAPI.submitVerification({
            ktm_image_url:     REG.ktmUrl,
            selfie_url:        selfieUrl || undefined,
            university:        REG.uni || '',
            student_id_number: '',
          });
        }
      } catch (verifErr) {
        console.warn('[verif] upload/submit gagal:', verifErr.message);
      }
    }

    showToast('Akun berhasil dibuat! 🎉', 'success');
    window._unauthorizedHandled = false;

    // Connect WebSocket + pasang notif listener untuk user yang baru daftar.
    // reconnect() agar identitas socket selalu sinkron dgn akun terkini.
    if (typeof SocketManager !== 'undefined') SocketManager.reconnect();
    if (typeof initNotifWebsocket === 'function') initNotifWebsocket();
    if (typeof refreshNotifBadge === 'function') refreshNotifBadge();

    // Setelah register, alihkan ke "Check email" screen — minta user verify
    // dulu sebelum masuk dashboard. Token tetap di-set supaya user tidak
    // perlu login ulang setelah klik link verifikasi.
    setTimeout(() => {
      if (typeof showCheckYourEmailScreen === 'function' && REG.email) {
        showCheckYourEmailScreen(REG.email);
      } else {
        // Fallback: route langsung ke dashboard kalau fungsi belum tersedia
        if (role === 'bisnis') goTo('screen-business');
        else goTo('screen-student');
      }
    }, 800);

  } catch (error) {
    showToast(error.message || 'Gagal membuat akun', 'error');
    if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
  } finally {
    _finishRegInFlight = false;
  }
}

/* ================================================================
   LOGOUT
   ================================================================ */
function handleLogout() {
  const existing = document.getElementById('logout-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'logout-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:380px;text-align:center" role="dialog">
      <div class="modal-drag-bar"></div>
      <div style="font-size:40px;margin-bottom:12px">👋</div>
      <h2 style="font-size:18px;font-weight:800;margin-bottom:8px">Keluar dari Akun?</h2>
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:24px;line-height:1.6">
        Kamu akan keluar dari StairsLife. Pastikan semua pekerjaanmu sudah tersimpan.
      </p>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1;height:44px"
          onclick="document.getElementById('logout-modal').remove()">
          Batal
        </button>
        <button class="btn btn-danger" style="flex:1;height:44px"
          onclick="window._confirmLogout()">
          Ya, Keluar
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function _confirmLogout() {
  document.getElementById('logout-modal')?.remove();

  if (typeof SocketManager !== 'undefined') SocketManager.disconnect();
  AuthAPI.logout();

  state.appliedProjects     = new Set();
  state.currentProjectId    = null;
  window._currentContract   = null;
  window.currentContractId  = null;
  window._cachedProjects    = null;
  window._bizProjects       = null;
  window._reviewContext     = null;

  const emailEl = document.getElementById('login-email');
  const passEl  = document.getElementById('login-password');
  if (emailEl) emailEl.value = '';
  if (passEl)  passEl.value  = '';

  showToast('Sampai jumpa! 👋', 'success');
  setTimeout(() => goTo('screen-landing'), 600);
}

/* ================================================================
   ONBOARDING
   ================================================================ */
function obGo(i) {
  const slides = document.querySelectorAll('.onboarding-slide');
  const dots   = document.querySelectorAll('#ob-dots .onboarding-dot');
  const btn    = document.getElementById('ob-next-btn');
  slides.forEach((s, j) => s.classList.toggle('active', j === i));
  dots.forEach((d, j) => d.classList.toggle('active', j === i));
  state.obPage = i;
  btn.innerHTML = i === slides.length - 1
    ? 'Mulai Daftar <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" width="18" height="18"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'
    : 'Lanjut <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" width="18" height="18"><path d="M9 18l6-6-6-6"/></svg>';
}

function obNext() {
  const total = document.querySelectorAll('.onboarding-slide').length;
  if (state.obPage < total - 1) obGo(state.obPage + 1);
  else goTo('screen-register');
}

/* ================================================================
   SUSPENDED MODAL
   ================================================================ */
/**
 * Tampilkan modal "akun di-suspend" dengan alasan tertentu.
 * Dipakai di 2 jalur: (1) user.is_suspended dari response login,
 * (2) error.suspended dari backend saat login gagal.
 */
function showSuspendedModal(reason) {
  const safeReason = reason || 'Melanggar ketentuan penggunaan platform.';
  document.getElementById('suspended-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'suspended-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:420px;text-align:center" role="dialog">
      <div style="font-size:48px;margin-bottom:12px">🚫</div>
      <h2 style="font-size:18px;font-weight:800;color:var(--rose);margin-bottom:8px">Akun Disuspend</h2>
      <p style="font-size:14px;color:var(--text-secondary);line-height:1.6;margin-bottom:12px">Akun kamu telah disuspend dengan alasan:</p>
      <div style="background:#fef2f2;border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-md);padding:12px;margin-bottom:16px">
        <p style="font-size:14px;color:var(--rose);font-weight:600;margin:0">${safeReason}</p>
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">Hubungi support untuk mengajukan banding.</p>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="_closeSuspendedModal()">Tutup</button>
        <button class="btn btn-primary" style="flex:2;height:44px" onclick="document.getElementById('suspended-modal').remove();openSupportChat()">💬 Hubungi Support</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function _closeSuspendedModal() {
  document.getElementById('suspended-modal')?.remove();
  TokenManager.clear(); // Clear token saat user tutup modal tanpa chat
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.REG                  = REG;
window.initLogin            = initLogin;
window.switchLoginRole      = switchLoginRole;
window.handleLogin          = handleLogin;
window.togglePassword       = togglePassword;
window.handleForgotPassword = handleForgotPassword;
window.initRegister         = initRegister;
window.regBack              = regBack;
window.renderRegStep        = renderRegStep;
window.selectRole           = selectRole;
window.regNext              = regNext;
window.regStep2Next         = regStep2Next;
window.handleKtmFileChange    = handleKtmFileChange;
window.pickKtmFile            = pickKtmFile;
window.handleSelfieFileChange = handleSelfieFileChange;
window.pickSelfieFile         = pickSelfieFile;
window.simulateKtmUpload      = simulateKtmUpload;
window.triggerKtmUpload       = triggerKtmUpload;
window.skipKtm                = skipKtm;
window.finishRegistration   = finishRegistration;
window.handleLogout         = handleLogout;
window.obGo                 = obGo;
window.obNext               = obNext;
window._closeSuspendedModal = _closeSuspendedModal;
window._confirmLogout       = _confirmLogout;