/**
 * StairsLife — features/settings/settings.js
 * saveEditProfile, saveBankAccount, renderBankAccounts, renderFAQ, filterFAQ, setFAQCat.
 * Depends on: UsersAPI, showToast, goBack, statusBadge.
 * Phase 3 — Modularisasi.
 */
'use strict';

/* ================================================================
   EDIT PROFILE
   ================================================================ */
async function saveEditProfile() {
  const name = document.getElementById('ep-name')?.value.trim();
  const bio  = document.getElementById('ep-bio')?.value.trim();
  const portfolioUrl = document.getElementById('ep-link')?.value.trim();

  if (!name) { showToast('Nama wajib diisi', 'error'); return; }

  const user   = TokenManager.getUser() || {};
  const role   = (user.role || '').toLowerCase();
  const isBisnis = role === 'bisnis' || role === 'business';

  let payload = { full_name: name, bio, portfolio_url: portfolioUrl || undefined };

  if (isBisnis) {
    // Field khusus bisnis
    const bizType  = document.getElementById('ep-biz-type')?.value;
    const phone    = document.getElementById('ep-phone')?.value.trim();
    const location = document.getElementById('ep-location')?.value.trim();
    payload = { ...payload, business_type: bizType, phone, location };
  } else {
    // Field khusus mahasiswa
    const uni      = document.getElementById('ep-uni')?.value.trim();
    const major    = document.getElementById('ep-major')?.value.trim();
    const semester = parseInt(document.getElementById('ep-sem')?.value || '0');
    const skillsRaw = document.getElementById('ep-skills')?.value || '';
    const skills   = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);
    payload = { ...payload, university: uni, major, semester, skills };
  }

  try {
    const res = await UsersAPI.updateProfile(payload);
    // Update cache localStorage dengan data terbaru
    if (res?.data) TokenManager.setUser({ ...user, ...res.data });
    showToast('Profil berhasil disimpan! ✅', 'success');
    setTimeout(() => goBack(), 800);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/* ================================================================
   BANK ACCOUNT
   ================================================================ */
async function saveBankAccount() {
  const bank   = document.getElementById('bank-name')?.value;
  const number = document.getElementById('bank-number')?.value.trim();
  const owner  = document.getElementById('bank-owner')?.value.trim();
  if (!bank)   { showToast('Pilih nama bank', 'error'); return; }
  if (!number) { showToast('Nomor rekening wajib diisi', 'error'); return; }
  if (!owner)  { showToast('Nama pemilik wajib diisi', 'error'); return; }
  if (!/^[0-9\-\s]{6,}$/.test(number)) {
    showToast('Nomor rekening tidak valid', 'error');
    return;
  }

  try {
    await UsersAPI.saveBankAccount({
      bank_name:      bank,
      account_number: number.replace(/\s|-/g, ''),
      account_holder: owner,
    });
    showToast(`Rekening ${bank} berhasil disimpan ✅`, 'success');
    setTimeout(() => goBack(), 800);
  } catch (error) {
    showToast(error.message || 'Gagal menyimpan rekening', 'error');
  }
}

async function renderBankAccounts() {
  const listEl = document.getElementById('bank-accounts-list');
  if (!listEl) return;
  try {
    const res      = await UsersAPI.getBankAccounts();
    const accounts = res.data || [];
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
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Bank</span><span style="font-weight:600">${a.bank_name}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">No. Rekening</span><span style="font-weight:600">${a.account_number}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Nama Pemilik</span><span style="font-weight:600">${a.account_holder}</span></div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.warn('[bank accounts] backend error:', error.message);
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
        <div class="pay-hist-title">${p.contracts?.projects?.title || 'Project'}</div>
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
   EDIT PROFILE — ROLE-BASED (FIX Masalah 2)
   Dipanggil oleh route hook 'screen-edit-profile'
   ================================================================ */
async function onEnterEditProfile() {
  // Ambil data user — prioritas dari backend, fallback ke localStorage
  let user = TokenManager.getUser() || {};
  try {
    const res = await UsersAPI.getMe();
    user = res.data || user;
    // Update cache localStorage dengan data terbaru
    TokenManager.setUser(user);
  } catch (e) {
    console.warn('[edit-profile] gagal fetch dari backend, pakai cache:', e.message);
  }

  const role = (user.role || '').toLowerCase();
  const isBisnis = role === 'bisnis' || role === 'business';

  // Cari container form edit profile
  const container = document.querySelector('#screen-edit-profile .auth-card.register-card');
  if (!container) return;

  // Update avatar inisial
  const avatarEl = container.querySelector('div[style*="border-radius:50%"]');
  if (avatarEl) avatarEl.textContent = (user.full_name || 'U').charAt(0).toUpperCase();

  // Update judul halaman
  const titleEl = document.querySelector('#screen-edit-profile .auth-topbar span');
  if (titleEl) titleEl.textContent = isBisnis ? 'Edit Profil Bisnis' : 'Edit Profil';

  if (isBisnis) {
    // Render form khusus bisnis
    const formGrid = container.querySelector('div[style*="display:grid"]');
    if (formGrid) {
      formGrid.innerHTML = `
        <div class="form-group">
          <label class="form-label">Nama Bisnis / Perusahaan <span class="req">*</span></label>
          <input class="form-input" id="ep-name" type="text" value="${user.full_name || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Deskripsi Bisnis</label>
          <textarea class="form-textarea" id="ep-bio" rows="3" placeholder="Ceritakan tentang bisnis kamu...">${user.bio || ''}</textarea>
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
          <input class="form-input" id="ep-phone" type="tel" placeholder="+628xxxxxxxxxx" value="${user.phone || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Kota / Lokasi</label>
          <input class="form-input" id="ep-location" type="text" placeholder="Jakarta Selatan" value="${user.location || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Website / Media Sosial</label>
          <input class="form-input" id="ep-link" type="url" placeholder="https://instagram.com/..." value="${user.portfolio_url || ''}">
        </div>
        <button class="btn btn-primary btn-full" style="height:48px;font-size:15px" onclick="saveEditProfile()">Simpan Perubahan</button>
        <button class="btn btn-ghost btn-full" onclick="goBack()">Batal</button>
      `;
    }
  } else {
    // Render form khusus mahasiswa dengan data asli
    const formGrid = container.querySelector('div[style*="display:grid"]');
    if (formGrid) {
      // Buat options semester
      const semOpts = Array.from({length: 14}, (_, i) => i + 1)
        .map(n => `<option value="${n}" ${user.semester == n ? 'selected' : ''}>Semester ${n}</option>`)
        .join('');

      formGrid.innerHTML = `
        <div class="form-group">
          <label class="form-label">Nama Lengkap <span class="req">*</span></label>
          <input class="form-input" id="ep-name" type="text" value="${user.full_name || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Bio / Deskripsi Diri</label>
          <textarea class="form-textarea" id="ep-bio" rows="3" placeholder="Ceritakan sedikit tentang dirimu...">${user.bio || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Universitas <span class="req">*</span></label>
          <input class="form-input" id="ep-uni" type="text" value="${user.university || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Jurusan <span class="req">*</span></label>
          <input class="form-input" id="ep-major" type="text" value="${user.major || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Semester</label>
          <select class="form-select" id="ep-sem">
            <option value="">Pilih semester...</option>
            ${semOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Skills (pisah koma)</label>
          <input class="form-input" id="ep-skills" type="text"
            placeholder="Flutter, React, UI/UX..."
            value="${Array.isArray(user.skills) ? user.skills.join(', ') : (user.skills || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Link LinkedIn / Portfolio</label>
          <input class="form-input" id="ep-link" type="url" placeholder="https://linkedin.com/in/..." value="${user.portfolio_url || ''}">
        </div>
        <button class="btn btn-primary btn-full" style="height:48px;font-size:15px" onclick="saveEditProfile()">Simpan Perubahan</button>
        <button class="btn btn-ghost btn-full" onclick="goBack()">Batal</button>
      `;
    }
  }
}

window.onEnterEditProfile = onEnterEditProfile;
