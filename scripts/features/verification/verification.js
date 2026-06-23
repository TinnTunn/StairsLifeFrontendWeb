/**
 * StairsLife — features/verification/verification.js
 * FIXED: blank page, back-to-landing, dummy data
 */
'use strict';

/* ================================================================
   STATE — diisi dari data user asli saat onEnterVerification
   ================================================================ */
const VERIF = {
  step: 0,
  docType: 'ktm',
  hasMainDoc: false,
  mainDocName: '',
  hasSelfie: false,
  selfieName: '',
  nim: '',
  fullName: '',
  university: '',
  major: '',
  status: 'unsubmitted',
};

/* ================================================================
   ENTRY + RENDER
   ================================================================ */
async function onEnterVerification() {
  // Ambil data user asli dari localStorage dulu (cepat, tidak perlu API)
  const cachedUser = TokenManager.getUser();
  if (cachedUser) {
    VERIF.fullName  = cachedUser.full_name || '';
    VERIF.university = cachedUser.university || '';
    VERIF.major     = cachedUser.major || '';
  }

  // Cek status verifikasi dari backend (dibungkus try-catch agar tidak blank jika gagal)
  try {
    await updateStudentVerificationUI();
  } catch (e) {
    console.warn('[verification] gagal cek status:', e.message);
  }

  VERIF.step = 0;
  renderVerifStep();
}

function renderVerifStep() {
  const titleEl = document.getElementById('verif-title');
  if (titleEl) titleEl.textContent = VERIF.step === 0 ? 'Verifikasi Mahasiswa' : 'Upload Dokumen';
  renderVerifIndicator();
  const content = document.getElementById('verif-content');
  if (!content) {
    console.warn('[verification] elemen #verif-content tidak ditemukan di HTML');
    return;
  }
  content.className = 'anim-up';
  void content.offsetWidth;
  content.innerHTML = buildVerifStepHTML();
}

function renderVerifIndicator() {
  const el = document.getElementById('verif-step-indicator');
  if (!el || VERIF.step === 0) { if (el) el.innerHTML = ''; return; }
  const totalSteps = VERIF.docType === 'ktm' ? 4 : 3;
  const labels     = VERIF.docType === 'ktm' ? ['Jenis', 'KTM', 'Selfie', 'Data'] : ['Jenis', 'Email', 'Data'];
  let html = '<div class="step-indicator">';
  for (let i = 1; i <= totalSteps; i++) {
    if (i > 1) html += `<div class="step-line${i - 1 < VERIF.step ? ' done' : ''}"></div>`;
    const cls = i < VERIF.step ? 'done' : i === VERIF.step ? 'active' : 'upcoming';
    html += `<div class="step-dot ${cls}" title="${labels[i - 1]}">${i < VERIF.step ? '✓' : i}</div>`;
  }
  el.innerHTML = html + '</div>';
}

function buildVerifStepHTML() {
  switch (VERIF.step) {
    case 0: return buildVerifOverview();
    case 1: return buildVerifDocType();
    case 2: return buildVerifUploadMain();
    case 3: return buildVerifSelfie();
    case 4: return buildVerifConfirmData();
    case 5: return buildVerifReview();
    default: return '';
  }
}

function buildVerifOverview() {
  const s = VERIF.status;
  const configs = {
    unsubmitted: { color: 'var(--amber)', icon: '⬆️', title: 'Belum Terverifikasi', desc: 'Lengkapi verifikasi untuk bisa melamar project di StairsLife.', btnLabel: 'Mulai Verifikasi', btnFn: 'verifStart()' },
    pending:     { color: 'var(--amber)', icon: '⏳', title: 'Sedang Diverifikasi', desc: 'Dokumen kamu sedang ditinjau admin. Estimasi 1-2 hari kerja.', btnLabel: 'Cek Status', btnFn: "showToast('Status: Sedang diproses admin ⏳','info')" },
    approved:    { color: 'var(--teal-dark)', icon: '✅', title: 'Terverifikasi!', desc: 'Selamat! Kamu sudah terverifikasi sebagai mahasiswa aktif.', btnLabel: null },
    rejected:    { color: 'var(--rose)', icon: '❌', title: 'Ditolak', desc: 'Dokumen ditolak. Pastikan foto jelas dan sesuai identitas.', btnLabel: 'Upload Ulang', btnFn: 'verifStart()' },
  };
  const c = configs[s] || configs['unsubmitted'];
  return `
  <div style="border-top:4px solid ${c.color};background:var(--bg-card);border-radius:var(--radius-md);padding:20px;margin-bottom:16px;box-shadow:var(--shadow-sm)">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
      <div style="width:44px;height:44px;border-radius:var(--radius-sm);background:${c.color}22;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${c.icon}</div>
      <div>
        <div style="font-size:16px;font-weight:700">${c.title}</div>
        <span class="badge ${s === 'approved' ? 'badge-teal' : s === 'pending' ? 'badge-amber' : s === 'rejected' ? 'badge-rose' : 'badge-gray'}">${s === 'approved' ? 'Terverifikasi' : s === 'pending' ? 'Menunggu Review' : s === 'rejected' ? 'Ditolak' : 'Belum Submit'}</span>
      </div>
    </div>
    <p style="font-size:14px;color:var(--text-secondary);line-height:1.6">${c.desc}</p>
  </div>
  ${s !== 'approved' ? `
  <details class="card card-p-lg" style="margin-bottom:16px">
    <summary style="cursor:pointer;font-size:15px;font-weight:600;list-style:none;display:flex;align-items:center;gap:10px">
      <div style="width:32px;height:32px;background:var(--accent-light);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" width="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>Kenapa harus verifikasi?
    </summary>
    <div style="margin-top:12px;display:grid;gap:6px">
      ${['Bisa melamar semua project di platform', 'Meningkatkan kepercayaan dari bisnis', 'Dapat badge "Mahasiswa Terverifikasi"', 'Diprioritaskan dalam pemilihan kandidat'].map(t => `<div class="bullet-item"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>${t}</div>`).join('')}
    </div>
  </details>` : ''}
  ${c.btnLabel ? `<button class="btn btn-primary btn-full" style="height:48px;font-size:15px;margin-bottom:12px" onclick="${c.btnFn}">${c.btnLabel}</button>` : ''}
  <div class="tips-card">
    <div class="tips-card-title"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Data kamu aman</div>
    <p style="font-size:13px;color:var(--text-secondary);line-height:1.6">Dokumen kamu hanya digunakan untuk verifikasi status mahasiswa. Tidak dibagikan ke pihak ketiga dan terenkripsi.</p>
  </div>`;
}

function buildVerifDocType() {
  return `
  <h2 style="font-size:20px;font-weight:800;text-align:center;margin-bottom:8px">Pilih Jenis Dokumen</h2>
  <p style="font-size:14px;color:var(--text-secondary);text-align:center;margin-bottom:24px">Kamu hanya perlu salah satu untuk verifikasi.</p>
  <div class="doc-type-card${VERIF.docType === 'ktm' ? ' selected' : ''}" onclick="selectDocType('ktm')">
    <div class="doc-type-icon">🪪</div>
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <div class="doc-type-title">Kartu Tanda Mahasiswa (KTM)</div>
        <span class="badge badge-teal" style="font-size:9px;padding:2px 6px">POPULER</span>
      </div>
      <div class="doc-type-sub">Foto KTM + selfie sambil memegang KTM untuk anti-pemalsuan.</div>
      <div class="doc-type-extra">✅ Disarankan — verifikasi paling cepat</div>
    </div>
    ${VERIF.docType === 'ktm' ? '<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="3" width="22" height="22"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' : ''}
  </div>
  <div class="doc-type-card${VERIF.docType === 'email' ? ' selected' : ''}" onclick="selectDocType('email')">
    <div class="doc-type-icon">📧</div>
    <div style="flex:1">
      <div class="doc-type-title" style="margin-bottom:4px">Email Kampus (.ac.id)</div>
      <div class="doc-type-sub">Screenshot email kampus aktif dengan domain .ac.id.</div>
      <div class="doc-type-extra">⚡ Alternatif — perlu konfirmasi tambahan</div>
    </div>
    ${VERIF.docType === 'email' ? '<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="3" width="22" height="22"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' : ''}
  </div>
  <button class="btn btn-primary btn-full" style="height:48px;font-size:15px;margin-top:20px" onclick="verifNext()">Lanjut →</button>`;
}

function buildVerifUploadMain() {
  const isKtm    = VERIF.docType === 'ktm';
  const uploaded = VERIF.hasMainDoc;
  return `
  <h2 style="font-size:20px;font-weight:800;text-align:center;margin-bottom:8px">${isKtm ? 'Upload Foto KTM' : 'Upload Screenshot Email'}</h2>
  <p style="font-size:14px;color:var(--text-secondary);text-align:center;margin-bottom:24px">${isKtm ? 'Pastikan semua data di KTM terbaca jelas.' : 'Screenshot inbox email kampus domain .ac.id.'}</p>
  <input type="file" id="verif-main-input" accept="image/*,application/pdf"
    style="display:none" onchange="pickMainDoc(event)">
  <div class="upload-area${uploaded ? ' uploaded' : ''}" onclick="document.getElementById('verif-main-input').click()">
    <svg viewBox="0 0 24 24">${uploaded ? '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' : (isKtm ? '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>' : '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>')}</svg>
    <div class="upload-area-title">${uploaded ? '✅ ' + VERIF.mainDocName : (isKtm ? 'Tap untuk upload foto KTM' : 'Tap untuk upload screenshot')}</div>
    <div class="upload-area-sub">${uploaded ? 'Tap untuk ganti file' : 'Format JPG, PNG, PDF (maks. 5MB)'}</div>
  </div>
  <div style="display:flex;gap:10px;margin-top:20px">
    <button class="btn btn-ghost" style="flex:1;height:48px" onclick="verifBack()">← Kembali</button>
    <button class="btn btn-primary" style="flex:2;height:48px;font-size:15px${!uploaded ? ';opacity:.6;cursor:not-allowed' : ''}" ${!uploaded ? 'disabled' : ''} onclick="verifNext()">Lanjut →</button>
  </div>`;
}

function buildVerifSelfie() {
  const uploaded = VERIF.hasSelfie;
  return `
  <h2 style="font-size:20px;font-weight:800;text-align:center;margin-bottom:8px">Foto Selfie Memegang KTM</h2>
  <p style="font-size:14px;color:var(--text-secondary);text-align:center;margin-bottom:24px">Untuk memastikan KTM benar milik kamu (anti-pemalsuan).</p>
  <input type="file" id="verif-selfie-input" accept="image/*"
    style="display:none" onchange="pickSelfieDoc(event)">
  <div class="upload-area${uploaded ? ' uploaded' : ''}" onclick="document.getElementById('verif-selfie-input').click()">
    <svg viewBox="0 0 24 24">${uploaded ? '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' : '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>'}</svg>
    <div class="upload-area-title">${uploaded ? '✅ ' + VERIF.selfieName : 'Tap untuk ambil / upload selfie'}</div>
    <div class="upload-area-sub">${uploaded ? 'Tap untuk ganti' : 'Pastikan wajah & KTM terlihat jelas dalam satu frame'}</div>
  </div>
  <div style="display:flex;gap:10px;margin-top:20px">
    <button class="btn btn-ghost" style="flex:1;height:48px" onclick="verifBack()">← Kembali</button>
    <button class="btn btn-primary" style="flex:2;height:48px;font-size:15px${!uploaded ? ';opacity:.6;cursor:not-allowed' : ''}" ${!uploaded ? 'disabled' : ''} onclick="verifNext()">Lanjut →</button>
  </div>`;
}

function buildVerifConfirmData() {
  // Gunakan data user asli, bukan hardcoded
  return `
  <h2 style="font-size:20px;font-weight:800;text-align:center;margin-bottom:8px">Konfirmasi Data</h2>
  <p style="font-size:14px;color:var(--text-secondary);text-align:center;margin-bottom:24px">Data ini akan dicocokkan dengan dokumen yang kamu upload.</p>
  <div class="card card-p-lg" style="margin-bottom:16px">
    <div style="display:grid;gap:14px">
      <div class="form-group"><label class="form-label">NIM <span class="req">*</span></label><input class="form-input" id="verif-nim" type="text" placeholder="2401234567" value="${VERIF.nim}"></div>
      <div class="form-group"><label class="form-label">Nama Lengkap (sesuai KTM) <span class="req">*</span></label><input class="form-input" id="verif-name" type="text" value="${VERIF.fullName}"></div>
      <div class="form-group"><label class="form-label">Universitas <span class="req">*</span></label><input class="form-input" id="verif-uni" type="text" value="${VERIF.university}"></div>
      <div class="form-group"><label class="form-label">Jurusan / Program Studi <span class="req">*</span></label><input class="form-input" id="verif-major" type="text" value="${VERIF.major}"></div>
    </div>
  </div>
  <div style="display:flex;gap:10px">
    <button class="btn btn-ghost" style="flex:1;height:48px" onclick="verifBack()">← Kembali</button>
    <button class="btn btn-primary" style="flex:2;height:48px;font-size:15px" onclick="verifConfirmData()">Lanjut Review →</button>
  </div>`;
}

function buildVerifReview() {
  const isKtm = VERIF.docType === 'ktm';
  return `
  <div style="background:var(--teal-light);border:1px solid rgba(31,185,125,0.3);border-radius:var(--radius-md);padding:14px;display:flex;align-items:center;gap:10px;margin-bottom:20px">
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal-dark)" stroke-width="2" width="20"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    <span style="font-size:13px;font-weight:600;color:var(--teal-dark)">Semua data terisi. Cek ulang sebelum submit.</span>
  </div>
  ${buildReviewSection('Jenis Dokumen', 1, [['Jenis', isKtm ? 'Kartu Tanda Mahasiswa (KTM)' : 'Email Kampus (.ac.id)']])}
  ${buildReviewSection('Dokumen Diunggah', 2, [['File utama', VERIF.mainDocName || '-'], ...(isKtm ? [['Selfie', VERIF.selfieName || '-']] : [])])}
  ${buildReviewSection('Data Mahasiswa', 4, [['NIM', VERIF.nim || '-'], ['Nama', VERIF.fullName], ['Universitas', VERIF.university], ['Jurusan', VERIF.major]])}
  <div style="background:var(--amber-light);border-radius:var(--radius-md);padding:14px;display:flex;align-items:flex-start;gap:10px;margin-bottom:20px">
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--amber-dark)" stroke-width="2" width="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <p style="font-size:13px;color:var(--amber-dark);line-height:1.6">Admin akan review dalam 1-2 hari kerja. Kamu akan mendapat notifikasi hasilnya.</p>
  </div>
  <div style="display:flex;gap:10px">
    <button class="btn btn-ghost" style="flex:1;height:48px" onclick="verifBack()">← Kembali</button>
    <button class="btn btn-primary" style="flex:2;height:48px;font-size:15px" onclick="submitVerification()">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" width="18"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Submit Verifikasi
    </button>
  </div>`;
}

function buildReviewSection(title, editStep, items) {
  return `
  <div class="card card-p-lg" style="margin-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <span style="font-size:15px;font-weight:700">${title}</span>
      <button class="btn btn-ghost btn-sm" onclick="VERIF.step=${editStep};renderVerifStep()">✏️ Edit</button>
    </div>
    ${items.map(([k, v]) => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--divider)"><span style="color:var(--text-secondary)">${k}</span><span style="font-weight:600;text-align:right;max-width:60%">${v}</span></div>`).join('')}
  </div>`;
}

/* ================================================================
   ACTIONS
   ================================================================ */
function verifStart() { VERIF.step = 1; renderVerifStep(); }

function verifBack() {
  if (VERIF.step === 0) {
    // FIX: kembali ke screen-student, bukan ke landing
    goTo('screen-student');
  } else if (VERIF.step === 4 && VERIF.docType === 'email') {
    VERIF.step = 2; renderVerifStep();
  } else {
    VERIF.step--; renderVerifStep();
  }
}

function verifNext() {
  if (VERIF.step === 2 && VERIF.docType === 'email') { VERIF.step = 4; }
  else VERIF.step++;
  renderVerifStep();
}

function selectDocType(t) { VERIF.docType = t; renderVerifStep(); }

async function pickMainDoc(event) {
  let file = event?.target?.files?.[0];
  if (!file) return;
  // Foto iPhone (HEIC) → konversi ke JPEG (PDF dibiarkan).
  const ok = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!ok.includes(file.type) && typeof prepareImageUpload === 'function') {
    try { file = await prepareImageUpload(file); }
    catch { showToast('Format file tidak didukung. Tips iPhone: Settings → Camera → "Most Compatible".', 'error'); return; }
  }
  if (file.size > 5 * 1024 * 1024) { showToast('File maksimal 5MB', 'error'); return; }

  showToast('Mengupload dokumen...', 'info');
  try {
    const res = await UploadAPI.uploadFile(file, 'ktm');
    VERIF.hasMainDoc   = true;
    VERIF.mainDocName  = file.name;
    VERIF._mainDocUrl  = res?.data?.url || res?.url || null;
    VERIF._mainDocFile = null;
    renderVerifStep();
    showToast('Dokumen berhasil diupload ✅', 'success');
  } catch (err) {
    // Jangan tandai sebagai terupload kalau gagal — supaya tidak ada
    // record verifikasi dengan path palsu (nama file mentah).
    VERIF.hasMainDoc   = false;
    VERIF._mainDocUrl  = null;
    VERIF._mainDocFile = null;
    renderVerifStep();
    showToast(`Gagal upload dokumen: ${err.message || 'coba lagi'}`, 'error');
  }
  if (event.target) event.target.value = '';
}

async function pickSelfieDoc(event) {
  let file = event?.target?.files?.[0];
  if (!file) return;
  // Foto iPhone (HEIC) → konversi ke JPEG.
  const ok = ['image/jpeg', 'image/png', 'image/webp'];
  if (!ok.includes(file.type) && typeof prepareImageUpload === 'function') {
    try { file = await prepareImageUpload(file); }
    catch { showToast('Format foto tidak didukung. Tips iPhone: Settings → Camera → "Most Compatible".', 'error'); return; }
  }
  if (file.size > 5 * 1024 * 1024) { showToast('File maksimal 5MB', 'error'); return; }

  showToast('Mengupload selfie...', 'info');
  try {
    const res = await UploadAPI.uploadFile(file, 'selfie');
    VERIF.hasSelfie   = true;
    VERIF.selfieName  = file.name;
    VERIF._selfieUrl  = res?.data?.url || res?.url || null;
    VERIF._selfieFile = null;
    renderVerifStep();
    showToast('Selfie berhasil diupload ✅', 'success');
  } catch (err) {
    VERIF.hasSelfie    = false;
    VERIF._selfieUrl   = null;
    VERIF._selfieFile  = null;
    renderVerifStep();
    showToast(`Gagal upload selfie: ${err.message || 'coba lagi'}`, 'error');
  }
  if (event.target) event.target.value = '';
}

function verifConfirmData() {
  const nim   = document.getElementById('verif-nim')?.value.trim();
  const name  = document.getElementById('verif-name')?.value.trim();
  const uni   = document.getElementById('verif-uni')?.value.trim();
  const major = document.getElementById('verif-major')?.value.trim();
  if (!nim || nim.length < 5) { showToast('NIM minimal 5 karakter', 'error'); return; }
  if (!name)  { showToast('Nama lengkap wajib diisi', 'error'); return; }
  if (!uni)   { showToast('Universitas wajib diisi', 'error'); return; }
  if (!major) { showToast('Jurusan wajib diisi', 'error'); return; }
  VERIF.nim = nim; VERIF.fullName = name; VERIF.university = uni; VERIF.major = major;
  verifNext();
}

let _submitVerifInFlight = false;
async function submitVerification() {
  if (_submitVerifInFlight) return;
  if (!VERIF.hasMainDoc || !VERIF.mainDocName) {
    showToast('Upload foto KTM dulu sebelum submit', 'error');
    return;
  }

  _submitVerifInFlight = true;
  // Cari tombol "Submit Verifikasi" untuk visual feedback
  const btn = document.querySelector('#verif-step-content button.btn-primary');
  const originalText = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }

  showToast('Memproses dokumen...', 'info');
  try {
    // Upload KTM — re-upload kalau file ada tapi belum sempat terupload
    let ktmUrl = VERIF._mainDocUrl;
    if (!ktmUrl && VERIF._mainDocFile) {
      const up = await UploadAPI.uploadFile(VERIF._mainDocFile, 'ktm');
      ktmUrl = up?.data?.url || up?.url || null;
    }
    if (!ktmUrl) {
      throw new Error('Foto KTM belum berhasil diupload. Silakan upload ulang.');
    }

    // Upload selfie kalau ada (opsional)
    let selfieUrl = VERIF._selfieUrl || '';
    if (!selfieUrl && VERIF._selfieFile) {
      const up = await UploadAPI.uploadFile(VERIF._selfieFile, 'selfie');
      selfieUrl = up?.data?.url || up?.url || '';
    }

    await UsersAPI.submitVerification({
      ktm_image_url:     ktmUrl,
      selfie_url:        selfieUrl || undefined,
      university:        VERIF.university,
      student_id_number: VERIF.nim,
    });

    VERIF.status = 'pending';
    await updateStudentVerificationUI();
    showToast('Dokumen berhasil dikirim! ✅ Menunggu review admin 1-2 hari kerja.', 'success');
    setTimeout(() => goTo('screen-student'), 1200);
  } catch (error) {
    showToast(error.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = originalText || 'Submit Verifikasi'; }
  } finally {
    _submitVerifInFlight = false;
  }
}

async function updateStudentVerificationUI() {
  try {
    const res   = await UsersAPI.getVerificationStatus();
    const verif = res.data;
    VERIF.status = verif ? verif.status : 'unsubmitted';
  } catch (error) {
    console.warn('[verification] gagal cek status dari backend:', error.message);
    // Jangan ubah VERIF.status jika backend tidak bisa dicapai
  }

  const s         = VERIF.status;
  const badgeHome  = document.getElementById('st-verify-badge-home');
  const badgeProf  = document.getElementById('st-verify-badge-profile');
  const alertEl    = document.getElementById('st-verify-alert');
  const chipEl     = document.getElementById('st-verify-status-chip');

  const cfg = {
    approved:    { cls: 'badge-teal',  txt: '✅ Terverifikasi',       chipCls: 'badge-teal',  chipTxt: 'Terverifikasi', showAlert: false },
    pending:     { cls: 'badge-amber', txt: '⏳ Proses Verifikasi',   chipCls: 'badge-amber', chipTxt: 'Proses',        showAlert: true  },
    rejected:    { cls: 'badge-rose',  txt: '❌ Verifikasi Ditolak',  chipCls: 'badge-rose',  chipTxt: 'Ditolak',       showAlert: true  },
    unsubmitted: { cls: 'badge-amber', txt: '⚠️ Belum Terverifikasi', chipCls: 'badge-amber', chipTxt: 'Belum',         showAlert: true  },
  }[s] || { cls: 'badge-amber', txt: '⚠️ Belum Terverifikasi', chipCls: 'badge-amber', chipTxt: 'Belum', showAlert: true };

  [badgeHome, badgeProf].forEach(el => {
    if (!el) return;
    el.className   = `badge ${cfg.cls}`;
    el.textContent = cfg.txt;
  });
  if (chipEl) { chipEl.className = `badge ${cfg.chipCls}`; chipEl.textContent = cfg.chipTxt; }
  if (alertEl) alertEl.style.display = cfg.showAlert ? '' : 'none';
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.VERIF                       = VERIF;
window.onEnterVerification         = onEnterVerification;
window.renderVerifStep             = renderVerifStep;
window.verifStart                  = verifStart;
window.verifBack                   = verifBack;
window.verifNext                   = verifNext;
window.selectDocType               = selectDocType;
window.pickMainDoc                 = pickMainDoc;
window.pickSelfieDoc               = pickSelfieDoc;
window.verifConfirmData            = verifConfirmData;
window.submitVerification          = submitVerification;
window.updateStudentVerificationUI = updateStudentVerificationUI;
