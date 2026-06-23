/**
 * StairsLife — features/settings/settings.js
 * saveEditProfile, saveBankAccount, renderBankAccounts, renderFAQ, filterFAQ, setFAQCat.
 * Depends on: UsersAPI, showToast, goBack, statusBadge.
 * Phase 3 — Modularisasi.
 */
'use strict';

/* ================================================================
   AVATAR UPLOAD
   ================================================================ */
let _uploadAvatarInFlight = false;

function triggerAvatarUpload() {
  const input = document.getElementById('ep-avatar-input');
  if (input) { input.value = ''; input.click(); }
}

async function handleAvatarChange(event) {
  let file = event?.target?.files?.[0];
  if (!file || _uploadAvatarInFlight) return;

  // Foto iPhone (HEIC/HEIF) atau format non-standar → konversi ke JPEG dulu
  // (browser tidak bisa pakai/menampilkan HEIC langsung).
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    try {
      showToast('Menyiapkan foto...', 'info');
      file = await (typeof prepareImageUpload === 'function'
        ? prepareImageUpload(file)
        : Promise.reject(new Error('converter tidak tersedia')));
    } catch (e) {
      showToast('Format foto tidak didukung di sini. Tips iPhone: Settings → Camera → Formats → "Most Compatible", lalu foto ulang — atau pilih foto JPG/PNG.', 'error');
      return;
    }
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran foto maksimal 5MB', 'error'); return;
  }

  _uploadAvatarInFlight = true;
  const btn = document.getElementById('ep-avatar-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Mengupload...'; }

  try {
    // Upload ke server
    const uploadRes = await UploadAPI.uploadFile(file, 'avatar');
    const avatarUrl = uploadRes?.data?.url || uploadRes?.url;
    if (!avatarUrl) throw new Error('Upload gagal — URL tidak diterima');

    // Update profil dengan avatar_url baru
    const user = TokenManager.getUser() || {};
    const updateRes = await UsersAPI.updateProfile({ avatar_url: avatarUrl });
    if (updateRes?.data) TokenManager.setUser({ ...user, ...updateRes.data, avatar_url: avatarUrl });

    // Update preview langsung di page
    _updateAvatarPreview(avatarUrl);
    showToast('Foto profil berhasil diperbarui 📷', 'success');
  } catch (e) {
    showToast(e.message || 'Gagal upload foto', 'error');
  } finally {
    _uploadAvatarInFlight = false;
    if (btn) { btn.disabled = false; btn.textContent = '📷 Ganti Foto'; }
    if (event.target) event.target.value = '';
  }
}

function _updateAvatarPreview(url) {
  const user = TokenManager.getUser() || {};
  const initial = (user.full_name || 'U').charAt(0).toUpperCase();

  // Preview di edit profile screen
  const previewEl = document.getElementById('ep-avatar-preview');
  if (previewEl) {
    previewEl.innerHTML = url
      ? `<img src="${escAttr(url)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">
         <div id="ep-avatar-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.4);border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s">
           <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" width="24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
         </div>`
      : `${initial}
         <div id="ep-avatar-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.4);border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s">
           <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" width="24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
         </div>`;
  }

  // Update .profile-avatar HANYA di dashboard role aktif + layar settings.
  // Hindari querySelectorAll global yang juga menyentuh layar role lain
  // (tersembunyi) — sumber inkonsistensi DOM.
  const _role = (typeof getCurrentRole === 'function') ? getCurrentRole() : 'student';
  const _dashSel = _role === 'biz' ? '#screen-business'
                 : _role === 'admin' ? '#screen-admin'
                 : '#screen-student';
  document.querySelectorAll(`${_dashSel} .profile-avatar, #screen-settings .profile-avatar`).forEach(el => {
    if (url) {
      el.style.padding = '0';
      el.style.overflow = 'hidden';
      el.innerHTML = `<img src="${escAttr(url)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      el.innerHTML = initial;
    }
  });
}

let _saveEditProfileInFlight = false;
async function saveEditProfile() {
  if (_saveEditProfileInFlight) return;
  const name = document.getElementById('ep-name')?.value.trim();
  const bio  = document.getElementById('ep-bio')?.value.trim();
  const portfolioUrl = document.getElementById('ep-link')?.value.trim();

  if (!name) { showToast('Nama wajib diisi', 'error'); return; }

  const user   = TokenManager.getUser() || {};
  const role   = (user.role || '').toLowerCase();
  const isBisnis = role === 'bisnis' || role === 'business';

  // Build payload dengan field yang BERUBAH saja — empty string tidak dikirim
  // karena di backend itu akan overwrite valid value dengan "" (data hilang).
  // Backend juga filter empty string sebagai safety net.
  const payload = { full_name: name };
  if (bio)          payload.bio = bio;
  if (portfolioUrl) {
    // Auto-prefix https:// kalau user tidak ketik protokol
    payload.portfolio_url = /^https?:\/\//i.test(portfolioUrl)
      ? portfolioUrl
      : `https://${portfolioUrl}`;
  }

  if (isBisnis) {
    // Field khusus bisnis — hanya kirim yang user isi
    const bizType  = document.getElementById('ep-biz-type')?.value;
    const phone    = document.getElementById('ep-phone')?.value.trim();
    const location = document.getElementById('ep-location')?.value.trim();
    if (bizType)  payload.business_type = bizType;
    if (phone)    payload.phone = phone;
    if (location) payload.location = location;
  } else {
    // Field khusus mahasiswa
    const uni       = document.getElementById('ep-uni')?.value.trim();
    const major     = document.getElementById('ep-major')?.value.trim();
    const semester  = parseInt(document.getElementById('ep-sem')?.value || '0');
    const skillsRaw = document.getElementById('ep-skills')?.value || '';
    const skills    = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);

    if (uni)         payload.university = uni;
    if (major)       payload.major = major;
    if (semester)    payload.semester = semester;
    if (skills.length) payload.skills = skills;
  }

  // Cari semua tombol "Simpan Perubahan" di edit-profile screen — disable
  // semuanya selama save. Ada 2 di HTML (mahasiswa & bisnis variant).
  const btns = Array.from(document.querySelectorAll('#screen-edit-profile button.btn-primary'));
  const originals = btns.map(b => ({ html: b.innerHTML, disabled: b.disabled }));
  btns.forEach(b => { b.disabled = true; b.textContent = '⏳ Menyimpan...'; });
  _saveEditProfileInFlight = true;

  try {
    const res = await UsersAPI.updateProfile(payload);
    // Update cache localStorage dengan data terbaru
    if (res?.data) TokenManager.setUser({ ...user, ...res.data });
    showToast('Profil berhasil disimpan! ✅', 'success');
    setTimeout(() => goBack(), 800);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    _saveEditProfileInFlight = false;
    btns.forEach((b, i) => {
      if (!b.isConnected) return;
      b.disabled = originals[i].disabled;
      b.innerHTML = originals[i].html;
    });
  }
}

/* ================================================================
   BANK ACCOUNT
   ================================================================ */
let _saveBankAccountInFlight = false;
async function saveBankAccount() {
  if (_saveBankAccountInFlight) return;
  const bankSel  = document.getElementById('bank-name');
  const bankCode = bankSel?.value;                                   // mis. "MANDIRI"
  const bank     = bankSel?.selectedOptions?.[0]?.textContent?.trim() || bankCode; // nama tampil
  const number   = document.getElementById('bank-number')?.value.trim();
  const owner    = document.getElementById('bank-owner')?.value.trim();
  if (!bankCode) { showToast('Pilih nama bank', 'error'); return; }
  if (!number) { showToast('Nomor rekening wajib diisi', 'error'); return; }
  if (!owner)  { showToast('Nama pemilik wajib diisi', 'error'); return; }
  if (!/^[0-9\-\s]{6,}$/.test(number)) {
    showToast('Nomor rekening tidak valid', 'error');
    return;
  }

  // Cari tombol simpan untuk visual feedback
  const btn = document.querySelector('#screen-bank-account button.btn-primary');
  const originalHTML = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyimpan...'; }
  _saveBankAccountInFlight = true;

  // Simpan ke backend (endpoint /bank-accounts via UsersAPI.saveBankAccount).
  try {
    await UsersAPI.saveBankAccount({
      bank_name:      bank,
      bank_code:      bankCode,
      account_number: number.replace(/\s|-/g, ''),
      account_holder: owner,
      is_primary:     true,
    });
    showToast(`Rekening ${bank} berhasil disimpan ✅`, 'success');
    if (typeof renderBankAccounts === 'function') renderBankAccounts();
    setTimeout(() => goBack(), 1000);
  } catch (error) {
    showToast(error?.message || 'Gagal menyimpan rekening', 'error');
  } finally {
    _saveBankAccountInFlight = false;
    if (btn && btn.isConnected) {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }
}

async function renderBankAccounts() {
  const listEl = document.getElementById('bank-accounts-list');
  if (!listEl) return;
  try {
    let accounts = [];
    // Coba dari backend dulu; kalau endpoint belum ada, baca dari localStorage
    if (typeof UsersAPI?.getBankAccounts === 'function') {
      try {
        const res = await UsersAPI.getBankAccounts();
        accounts  = res.data || [];
      } catch (_) {
        // fall through ke localStorage
      }
    }
    if (!accounts.length) {
      const userId = TokenManager.getUser()?.id || 'guest';
      const raw    = localStorage.getItem(`stairslife:bank_account:${userId}`);
      if (raw) {
        try { accounts = [JSON.parse(raw)]; } catch (_) {}
      }
    }

    if (!accounts.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏦</div><div class="empty-state-title">Belum ada rekening</div><p class="empty-state-desc">Tambahkan rekening untuk pencairan dana.</p></div>`;
      return;
    }
    listEl.innerHTML = accounts.map(a => `
      <div class="card card-p-lg" style="margin-bottom:12px;border-left:3px solid var(--teal)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:15px;font-weight:700">${a.is_primary ? 'Rekening Utama' : 'Rekening'}</span>
          <span class="badge badge-teal">✅ Aktif</span>
        </div>
        <div style="display:grid;gap:6px;font-size:14px">
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Bank</span><span style="font-weight:600">${esc(a.bank_name)}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">No. Rekening</span><span style="font-weight:600">${esc(a.account_number)}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Nama Pemilik</span><span style="font-weight:600">${esc(a.account_holder)}</span></div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.warn('[bank accounts] error:', error.message);
  }
}

/* ================================================================
   PAYMENT HISTORY
   ================================================================ */
let currentPayFilter = 'all';

async function renderPaymentHistory() {
  const el = document.getElementById('payment-list-container');
  if (!el) return;

  try {
    const res      = await PaymentsAPI.getMyPayments();
    const payments = res.data || [];

    const filtered = currentPayFilter === 'all'
      ? payments
      : payments.filter(p => p.status === currentPayFilter);

    if (!filtered.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💳</div><div class="empty-state-title">Tidak ada transaksi</div></div>`;
      return;
    }

    el.innerHTML = filtered.map(p => `
    <div class="pay-hist-item">
      <div class="pay-hist-icon" style="background:${p.status === 'released' ? 'var(--teal-light)' : p.status === 'held' ? 'var(--amber-light)' : 'var(--bg-secondary)'};color:${p.status === 'released' ? 'var(--teal-dark)' : p.status === 'held' ? 'var(--amber-dark)' : 'var(--text-muted)'}">
        <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
      </div>
      <div style="flex:1">
        <div class="pay-hist-title">${esc(p.contracts?.projects?.title || 'Project')}</div>
        <div class="pay-hist-sub">${new Date(p.created_at).toLocaleDateString('id-ID')}</div>
      </div>
      <div>
        <div class="pay-hist-amount" style="color:${p.status === 'released' ? 'var(--teal-dark)' : 'var(--amber-dark)'}">
          Rp ${(p.net_amount || p.amount || 0).toLocaleString('id-ID')}
        </div>
        ${statusBadge(p.status)}
      </div>
    </div>`).join('');
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat riwayat</div></div>`;
  }
}

function setPayFilter(f, btn) {
  currentPayFilter = f;
  document.querySelectorAll('#screen-payment-history .filter-chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  renderPaymentHistory();
}

/* ================================================================
   FAQ / HELP
   ================================================================ */
const FAQS = [
  { q: 'Bagaimana cara mendaftar sebagai mahasiswa?', a: 'Klik "Daftar Gratis" di halaman utama, pilih peran Mahasiswa, isi data dirimu (nama, email, universitas, jurusan), lalu buat password. Setelah mendaftar, upload KTM untuk verifikasi.', cat: 'Akun' },
  { q: 'Bagaimana cara verifikasi KTM?', a: 'Masuk ke Profil → Verifikasi KTM, lalu upload foto KTM kamu yang masih berlaku + selfie sambil memegang KTM. Tim admin akan mereview dalam 1-2 hari kerja.', cat: 'Verifikasi' },
  { q: 'Apakah saya perlu verifikasi KTM untuk melamar project?', a: 'Ya, verifikasi KTM wajib untuk melamar project apapun. Ini memastikan hanya mahasiswa aktif yang terdaftar. Proses verifikasi biasanya 1-2 hari kerja.', cat: 'Verifikasi' },
  { q: 'Bagaimana sistem Escrow bekerja?', a: 'Saat kontrak dibuat, klien mendepositkan dana ke rekening Escrow StairsLife. Dana ditahan selama project berlangsung. Setelah deliverable disetujui klien, dana otomatis dicairkan ke rekeningmu dalam 1-3 hari kerja.', cat: 'Pembayaran' },
  { q: 'Berapa lama dana dicairkan setelah project selesai?', a: 'Dana dicairkan dalam 1-3 hari kerja setelah klien menyetujui deliverable. Jika klien tidak merespon dalam 7 hari, dana otomatis dicairkan (auto-release).', cat: 'Pembayaran' },
  { q: 'Apa yang terjadi jika klien tidak mau membayar?', a: 'Karena menggunakan sistem Escrow, klien harus mendepositkan dana sebelum project dimulai. Jika ada masalah, ajukan Sengketa melalui menu Sengketa. Admin akan menengahi dan memastikan keputusan yang adil.', cat: 'Sengketa' },
  { q: 'Bagaimana cara mengajukan sengketa?', a: 'Masuk ke menu Sengketa → Ajukan Sengketa. Pilih project yang bermasalah, jelaskan situasinya, dan upload bukti pendukung. Admin akan menghubungi kedua pihak dalam 1×24 jam.', cat: 'Sengketa' },
  { q: 'Berapa komisi yang diambil StairsLife?', a: 'StairsLife mengambil komisi 10% dari nilai project untuk mahasiswa dan 5% dari klien. Semua biaya sudah termasuk dalam nilai yang tertera — tidak ada biaya tersembunyi.', cat: 'Pembayaran' },
  { q: 'Bagaimana cara naik tier?', a: 'Tier naik otomatis berdasarkan jumlah project selesai dan rating rata-rata. Pemula (0-2 project) → Menengah (3-9 project) → Mahir (10+ project dengan rating ≥ 4.5).', cat: 'Project' },
  { q: 'Apa itu Micro-task project?', a: 'Micro-task adalah project kecil dengan scope terbatas yang bisa diselesaikan dalam 1-7 hari. Cocok untuk mahasiswa yang ingin memulai tanpa komitmen waktu besar.', cat: 'Project' },
  { q: 'Bagaimana cara menambah rekening bank?', a: 'Masuk ke Pengaturan → Rekening Bank → Tambah Rekening. Masukkan nama bank, nomor rekening, dan nama pemilik. Pastikan nama sesuai dengan nama di KTM.', cat: 'Pembayaran' },
  { q: 'Apakah ada fitur chat dengan klien?', a: 'Ya! Setelah lamaran diterima, kamu bisa langsung chat dengan klien melalui menu Pesan. Tersedia di bagian Profil → Pesan & Chat.', cat: 'Project' },
];

let faqCat   = 'Semua';
let faqQuery = '';

function filterFAQ() {
  faqQuery = document.getElementById('faq-search')?.value.toLowerCase() || '';
  renderFAQ();
}

function setFAQCat(cat, btn) {
  faqCat = cat;
  document.querySelectorAll('#faq-cats .filter-chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  renderFAQ();
}

function renderFAQ() {
  const el = document.getElementById('faq-list');
  if (!el) return;
  const filtered = FAQS.filter(f =>
    (faqCat === 'Semua' || f.cat === faqCat) &&
    (!faqQuery || f.q.toLowerCase().includes(faqQuery) || f.a.toLowerCase().includes(faqQuery)),
  );
  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">Tidak ada pertanyaan ditemukan</div></div>`;
    return;
  }
  el.innerHTML = filtered.map((f, i) => `
    <div class="faq-item">
      <div class="faq-question" id="faq-q-${i}" onclick="toggleFAQ(${i})">
        <span style="flex:1">${f.q}</span>
        <svg class="faq-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="faq-answer" id="faq-a-${i}">${f.a}</div>
    </div>`).join('');
}

function toggleFAQ(i) {
  const q = document.getElementById(`faq-q-${i}`);
  const a = document.getElementById(`faq-a-${i}`);
  if (!q || !a) return;
  q.classList.toggle('open');
  a.classList.toggle('open');
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.saveEditProfile    = saveEditProfile;
window.saveBankAccount    = saveBankAccount;
window.renderBankAccounts = renderBankAccounts;
window.renderPaymentHistory = renderPaymentHistory;
window.setPayFilter       = setPayFilter;
window.filterFAQ          = filterFAQ;
window.setFAQCat          = setFAQCat;
window.renderFAQ          = renderFAQ;
window.toggleFAQ          = toggleFAQ;

/* ================================================================
   EDIT PROFILE — role-based
   Dipanggil oleh route hook 'screen-edit-profile' di router.js

   Approach:
   - HTML form untuk MAHASISWA sudah ada di index.html (default).
   - JS hanya POPULATE value field-field yang ada.
   - Kalau user BISNIS, JS REPLACE form-grid dengan template bisnis.
   - Avatar di-update dari user.avatar_url atau initial nama.
   ================================================================ */
async function onEnterEditProfile() {
  // 1) Ambil data user — prioritas backend, fallback localStorage
  let user = TokenManager.getUser() || {};
  try {
    const res = await UsersAPI.getMe();
    user = res.data || user;
    TokenManager.setUser(user);
  } catch (e) {
    console.warn('[edit-profile] gagal fetch backend, pakai cache:', e.message);
  }

  const role     = (user.role || '').toLowerCase();
  const isBisnis = role === 'bisnis' || role === 'business';

  // 2) Update title topbar
  const titleEl = document.querySelector('#screen-edit-profile .auth-topbar span');
  if (titleEl) titleEl.textContent = isBisnis ? 'Edit Profil Bisnis' : 'Edit Profil';

  // 3) Update avatar preview
  _updateAvatarPreview(user.avatar_url || '');

  // 4) Replace form-grid kalau bisnis, atau populate field kalau mahasiswa
  const formGrid = document.querySelector('#screen-edit-profile div[style*="display:grid"]');
  if (!formGrid) {
    console.warn('[edit-profile] form-grid tidak ditemukan di DOM');
    return;
  }

  if (isBisnis) {
    // Render form khusus bisnis (replace HTML)
    formGrid.innerHTML = `
      <div class="form-group">
        <label class="form-label">Nama Bisnis / Perusahaan <span class="req">*</span></label>
        <input class="form-input" id="ep-name" type="text" value="${escAttr(user.full_name || '')}" placeholder="Nama bisnis kamu">
      </div>
      <div class="form-group">
        <label class="form-label">Deskripsi Bisnis</label>
        <textarea class="form-textarea" id="ep-bio" rows="3" placeholder="Ceritakan tentang bisnis kamu...">${esc(user.bio || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Jenis Bisnis</label>
        <select class="form-select" id="ep-biz-type">
          <option value="">Pilih jenis...</option>
          ${['UMKM','Startup','Freelancer','Korporat','Lainnya'].map(t =>
            `<option value="${t}" ${user.business_type === t ? 'selected' : ''}>${t}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Nomor WhatsApp</label>
        <input class="form-input" id="ep-phone" type="tel" placeholder="+628xxxxxxxxxx" value="${escAttr(user.phone || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Kota / Lokasi</label>
        <input class="form-input" id="ep-location" type="text" placeholder="cth: Jakarta Selatan" value="${escAttr(user.location || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Website / Media Sosial</label>
        <input class="form-input" id="ep-link" type="url" placeholder="https://instagram.com/..." value="${escAttr(user.portfolio_url || '')}">
      </div>
      <button class="btn btn-primary btn-full" style="height:48px;font-size:15px" onclick="saveEditProfile()">Simpan Perubahan</button>
      <button class="btn btn-ghost btn-full" onclick="goBack()">Batal</button>
    `;
  } else {
    // Mahasiswa: populate field yang SUDAH ADA di HTML (jangan re-render!)
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null) el.value = val;
    };

    setVal('ep-name',   user.full_name || '');
    setVal('ep-bio',    user.bio || '');
    setVal('ep-uni',    user.university || '');
    setVal('ep-major',  user.major || '');
    setVal('ep-sem',    user.semester || '');
    setVal('ep-skills', Array.isArray(user.skills) ? user.skills.join(', ') : (user.skills || ''));
    setVal('ep-link',   user.portfolio_url || '');
  }
}

window.onEnterEditProfile  = onEnterEditProfile;
window.triggerAvatarUpload = triggerAvatarUpload;
window.handleAvatarChange  = handleAvatarChange;
