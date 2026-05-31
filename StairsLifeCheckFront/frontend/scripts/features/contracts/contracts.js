/**
 * StairsLife — features/contracts/contracts.js
 * FIXED: deliverable review UI, reject button, rating form
 */
'use strict';

/* ================================================================
   DELIVERABLE UPLOAD
   ================================================================ */
const delivFiles = [];

function addDeliverableFile() {
  const input = document.getElementById('deliv-file-input');
  if (input) { input.value = ''; input.click(); }
}

function handleDelivFileChange(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const MAX_MB = 50;
  if (file.size > MAX_MB * 1024 * 1024) { showToast(`File maksimal ${MAX_MB}MB`, 'error'); return; }
  const sizeKb = Math.round(file.size / 1024);
  delivFiles.push({ name: file.name, size: sizeKb, _file: file });
  renderDelivFiles();
  showToast('File ditambahkan ✅', 'success');
  if (event.target) event.target.value = '';
}

function renderDelivFiles() {
  const el = document.getElementById('deliv-file-list');
  if (!el) return;
  el.innerHTML = delivFiles.map((f, i) => `
    <div class="deliv-file-item">
      <div class="deliv-file-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      <div style="flex:1">
        <div class="deliv-file-name">${f.name}</div>
        <div class="deliv-file-size">${f.size >= 1024 ? (f.size/1024).toFixed(1)+' MB' : f.size+' KB'}</div>
      </div>
      <div class="deliv-file-remove" onclick="removeDelivFile(${i})">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      </div>
    </div>`).join('');
}

function removeDelivFile(i) { delivFiles.splice(i, 1); renderDelivFiles(); }

let _submitDelivInFlight = false;
async function submitDeliverable() {
  if (_submitDelivInFlight) return;
  if (!delivFiles.length) { showToast('Upload minimal 1 file deliverable', 'error'); return; }

  let contractId = window._currentContract?.id || window.currentContractId || null;
  if (!contractId) {
    try {
      const res       = await ContractsAPI.getMyContracts();
      const contracts = res.data || [];
      const active    = contracts.find(c => c.status === 'active' || c.status === 'pending_review');
      if (active) { contractId = active.id; window._currentContract = active; }
    } catch (_) {}
  }

  if (!contractId) { showToast('Kontrak tidak ditemukan. Buka halaman "Project Aktif" dulu.', 'error'); return; }

  const btn = document.getElementById('deliv-submit-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  _submitDelivInFlight = true;

  try {
    showToast('Mengupload file...', 'info');
    const urls = [];
    for (const f of delivFiles) {
      if (f._file) {
        try {
          const res = await UploadAPI.uploadFile(f._file, 'deliverable');
          const url = res?.data?.url || res?.url;
          if (url) urls.push(url);
        } catch (_) {
          showToast(`Gagal upload: ${f.name}`, 'error');
        }
      }
    }

    if (urls.length === 0) {
      throw new Error('Semua file gagal diupload. Coba lagi.');
    }

    // Kirim semua URL — backend simpan sebagai JSON array kalau > 1 file.
    // FIX: sebelumnya hanya kirim urls[0], file ke-2 dan seterusnya hilang.
    await ContractsAPI.uploadDeliverable(contractId, {
      deliverable_urls:  urls,                 // array semua file
      deliverable_url:   urls[0] || '',        // backward compat
      deliverable_notes: document.getElementById('deliv-note')?.value?.trim() || '',
    });

    showToast('Deliverable berhasil dikirim! ✅ Menunggu review klien.', 'success');
    delivFiles.length = 0;
    renderDelivFiles();
    window.currentContractId = null;
    setTimeout(() => goBack(), 900);
  } catch (error) {
    showToast(error.message || 'Gagal mengirim deliverable', 'error');
  } finally {
    _submitDelivInFlight = false;
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

/* ================================================================
   CONTRACT DETAIL
   ================================================================ */
async function loadContractDetail(contractId = null) {
  const contentEl = document.getElementById('contract-detail-content');
  if (contentEl) contentEl.innerHTML = skeletons.activeProjectCards(1);

  try {
    const res       = await ContractsAPI.getMyContracts();
    const contracts = res.data || [];

    let contract = contractId
      ? contracts.find(c => c.id === contractId)
      : contracts.find(c => c.status === 'active' || c.status === 'pending_review') || contracts[0];

    if (!contract) { showToast('Kontrak tidak ditemukan', 'info'); return; }

    window._currentContract = contract;

    const project     = contract.projects || {};
    const student     = contract.users_contracts_student_idTousers || {};
    const business    = contract.users_contracts_business_idTousers || {};
    const currentUser = AuthAPI.getCurrentUser();
    const isStudent   = currentUser?.role === 'mahasiswa';

    const deadlineStr = new Date(contract.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const startedStr  = new Date(contract.started_at || contract.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    const statusConfig = {
      active:         { label: 'Kontrak Aktif',   color: 'var(--teal-dark)',  bg: 'var(--teal-light)',  icon: '🔵' },
      pending_review: { label: 'Menunggu Review', color: 'var(--amber-dark)', bg: 'var(--amber-light)', icon: '⏳' },
      completed:      { label: 'Selesai',          color: 'var(--teal-dark)',  bg: 'var(--teal-light)',  icon: '✅' },
      disputed:       { label: 'Sengketa',         color: 'var(--rose)',       bg: 'var(--rose-light)',  icon: '⚠️' },
    };
    const statusCfg = statusConfig[contract.status] || statusConfig.active;

    // Cek apakah sudah ada review dari user yang sedang login untuk kontrak ini.
    // API getByContract mengembalikan ARRAY semua review (bisa 2 — biz→student
    // dan student→biz). Sebelumnya FE memperlakukan ini sebagai object,
    // menyebabkan tombol "Beri Rating" tidak pernah muncul (array kosong itu truthy).
    let existingReview = null;
    if (contract.status === 'completed') {
      try {
        const reviewRes = await ReviewsAPI.getByContract(contract.id);
        const reviews   = Array.isArray(reviewRes.data) ? reviewRes.data : [];
        existingReview  = reviews.find(r => r.reviewer_id === currentUser?.id) || null;
      } catch (_) {}
    }

    // Ambil history deliverable
    let deliverableHistory = [];
      try {
        const histRes = await ContractsAPI.getDeliverableHistory(contract.id);
        deliverableHistory = histRes.data || [];
          } catch (_) {}

    const statusBar = document.getElementById('contract-detail-content');
    if (statusBar) {
      statusBar.innerHTML = `
        <div style="background:${statusCfg.bg};border:1px solid rgba(0,0,0,0.1);border-radius:var(--radius-md);padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:16px">
          <svg viewBox="0 0 24 24" fill="none" stroke="${statusCfg.color}" stroke-width="2" width="24" height="24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>
            <div style="font-size:14px;font-weight:700;color:${statusCfg.color}">${statusCfg.label}</div>
            <div style="font-size:12px;color:${statusCfg.color}">Dimulai ${esc(startedStr)} · Deadline ${esc(deadlineStr)}</div>
          </div>
          <span class="badge" style="margin-left:auto;background:${statusCfg.color};color:white">${statusCfg.icon} ${statusCfg.label}</span>
        </div>

        <h3 style="font-size:16px;font-weight:700;margin-bottom:14px">${esc(project.title || 'Kontrak')}</h3>

        <div style="display:grid;gap:10px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid var(--divider)">
            <span style="color:var(--text-secondary)">${isStudent ? 'Klien' : 'Freelancer'}</span>
            <span class="profile-link"
                  onclick="openPublicProfile('${escAttr(isStudent ? (business.id || '') : (student.id || ''))}','${escAttr(isStudent ? (business.full_name || '') : (student.full_name || ''))}')">
              ${esc(isStudent ? (business.full_name || '-') : (student.full_name || '-'))}
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid var(--divider)">
            <span style="color:var(--text-secondary)">Nilai Kontrak</span>
            <span style="font-weight:700;color:var(--accent)">Rp ${(Number(contract.agreed_budget) || 0).toLocaleString('id-ID')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid var(--divider)">
            <span style="color:var(--text-secondary)">Status Escrow</span>
            <span class="badge ${contract.status === 'completed' ? 'badge-teal' : 'badge-amber'}">
              ${contract.status === 'completed' ? '✅ Dana Dicairkan' : '🔒 Dana Ditahan'}
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0">
            <span style="color:var(--text-secondary)">Progress</span>
            <span style="font-weight:600;color:var(--accent)">${Number(contract.progress_pct) || 0}%</span>
          </div>
        </div>

        <div class="progress-bar" style="margin-bottom:16px">
          <div class="progress-fill" style="width:${Number(contract.progress_pct) || 0}%"></div>
        </div>

        ${/* Deliverable section — tampilkan untuk bisnis saat pending_review */ ''}
        ${!isStudent && contract.status === 'pending_review' && contract.deliverable_url ? `
        <div style="background:var(--amber-light);border:1px solid rgba(245,158,11,0.3);border-radius:var(--radius-md);padding:16px;margin-bottom:16px">
          <div style="font-size:14px;font-weight:700;color:var(--amber-dark);margin-bottom:10px">📎 Deliverable dari Mahasiswa</div>
          <div style="font-size:13px;color:var(--amber-dark);margin-bottom:10px;line-height:1.6;white-space:pre-wrap">
            ${esc(contract.deliverable_notes || 'Mahasiswa telah mengirim deliverable')}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${renderDeliverableFileLinks(contract.deliverable_url, 'margin-bottom:0')}
          </div>
        </div>` : ''}

        ${/* Deliverable section — tampilkan untuk mahasiswa */ ''}
        ${isStudent && contract.deliverable_url ? `
        <div style="background:var(--teal-light);border:1px solid rgba(20,184,166,0.3);border-radius:var(--radius-md);padding:14px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:var(--teal-dark);margin-bottom:6px">📎 Deliverable Terkirim</div>
          <div style="font-size:13px;color:var(--teal-dark);margin-bottom:8px;white-space:pre-wrap">${esc(contract.deliverable_notes || 'File sudah diupload')}</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${renderDeliverableFileLinks(contract.deliverable_url)}
          </div>
        </div>` : ''}

        ${/* Review yang sudah ada */ ''}
        ${existingReview ? `
        <div style="background:var(--teal-light);border:1px solid rgba(20,184,166,0.3);border-radius:var(--radius-md);padding:14px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:var(--teal-dark);margin-bottom:8px">⭐ Review Sudah Diberikan</div>
          <div style="font-size:22px;margin-bottom:6px">${'⭐'.repeat(Number(existingReview.rating) || 0)}</div>
          ${existingReview.tags?.length ? `
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
            ${(existingReview.tags || []).map(t => `
              <span style="background:rgba(20,184,166,0.2);color:var(--teal-dark);font-size:11px;padding:3px 8px;border-radius:12px;font-weight:600">${esc(t)}</span>
            `).join('')}
          </div>` : ''}
          ${existingReview.comment ? `<div style="font-size:13px;color:var(--teal-dark);white-space:pre-wrap;font-style:italic">"${esc(existingReview.comment)}"</div>` : ''}
        </div>` : ''}

        ${/* Action buttons */ ''}
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          ${isStudent ? `
            ${contract.status === 'active' ? `
            <button class="btn btn-primary" style="flex:2;height:48px;font-size:15px"
              onclick="window.currentContractId='${escAttr(contract.id)}';goTo('screen-deliverable-upload')">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" width="18"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload Deliverable
            </button>` : ''}
            ${contract.status === 'pending_review' ? `
            <div style="flex:2;background:var(--amber-light);border-radius:var(--radius-md);padding:12px;text-align:center;font-size:13px;color:var(--amber-dark);font-weight:600">
              ⏳ Menunggu review dari klien...
            </div>` : ''}
            ${contract.status === 'completed' && isStudent && !existingReview ? `
            <button class="btn btn-primary" style="flex:2;height:48px;font-size:15px"
              onclick="openStudentReviewModal('${escAttr(contract.id)}', '${escAttr(business.id)}', '${escAttr(business.full_name || 'Klien')}')">
              ⭐ Beri Rating Klien
            </button>` : ''}
            <button class="btn btn-ghost" style="flex:1;height:48px"
              onclick="openDirectChatWith('${escAttr(business.full_name || 'Klien')}','bisnis','Kontrak: ${escAttr(project.title || '')}','${escAttr(business.id || '')}')">
              💬 Chat Klien
            </button>
          ` : `
            ${contract.status === 'pending_review' ? `
            <button class="btn btn-primary" style="flex:2;height:48px;font-size:15px"
              onclick="approveDeliverableFromContract()">
              ✅ Approve & Selesaikan
            </button>
            <button class="btn btn-danger" style="flex:1;height:48px"
              onclick="rejectDeliverableFromContract()">
              ❌ Tolak
            </button>` : ''}
            ${contract.status === 'completed' && !existingReview ? `
            <button class="btn btn-primary" style="flex:2;height:48px;font-size:15px"
              onclick="openReviewModal('${escAttr(contract.id)}', '${escAttr(student.id)}', '${escAttr(student.full_name || 'Mahasiswa')}')">
              ⭐ Beri Rating & Review
            </button>` : ''}
            <button class="btn btn-ghost" style="flex:1;height:48px"
              onclick="openDirectChatWith('${escAttr(student.full_name || 'Freelancer')}','mahasiswa','Kontrak: ${escAttr(project.title || '')}','${escAttr(student.id || '')}')">
              💬 Chat Freelancer
            </button>
          `}
           ${contract.status !== 'completed' ? `
          <button class="btn btn-danger" style="height:48px;padding:0 16px"
            onclick="goTo('screen-dispute-list')">
            ⚠️ Sengketa
          </button>` : ''}
        </div>

        ${deliverableHistory.length > 0 ? `
        <div style="margin-top:20px">
          <div style="font-size:14px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px">
            📋 Riwayat Deliverable
            <span class="badge badge-gray" style="font-size:11px">${deliverableHistory.length} pengiriman</span>
          </div>
          ${deliverableHistory.map(d => `
            <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;margin-bottom:8px;border-left:3px solid ${d.status === 'approved' ? 'var(--teal-dark)' : d.status === 'rejected' ? 'var(--rose)' : 'var(--amber)'}">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:12px;font-weight:700;color:${d.status === 'approved' ? 'var(--teal-dark)' : d.status === 'rejected' ? 'var(--rose)' : 'var(--amber-dark)'}">
                  ${d.status === 'approved' ? '✅ Disetujui' : d.status === 'rejected' ? '❌ Ditolak' : '⏳ Menunggu Review'}
                </span>
                <span style="font-size:11px;color:var(--text-muted)">
                  ${new Date(d.submitted_at).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'})}
                </span>
              </div>
              ${d.deliverable_notes ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;white-space:pre-wrap">📝 Catatan: ${esc(d.deliverable_notes)}</div>` : ''}
              ${d.rejection_reason ? `<div style="font-size:12px;color:var(--rose);margin-bottom:6px;padding:6px 8px;background:rgba(239,68,68,0.1);border-radius:6px">⚠️ Alasan penolakan: <b>${esc(d.rejection_reason)}</b></div>` : ''}
              ${d.deliverable_url ? `
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
                ${renderDeliverableFileLinks(d.deliverable_url, 'font-size:11px')}
              </div>` : ''}
            </div>
          `).join('')}
        </div>` : ''}
      `;
    }
  } catch (error) {
    showToast('Gagal load kontrak: ' + error.message, 'error');
  }
}

/* ================================================================
   APPROVE DELIVERABLE
   ================================================================ */
async function approveDeliverableFromContract() {
  const contract = window._currentContract;
  if (!contract) return;

  const btn = window.event?.target;
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  try {
    await ContractsAPI.approve(contract.id);
    // Badge "Perlu Review" di My Projects perlu di-refresh.
    if (typeof invalidateMyProjectsCache === 'function') invalidateMyProjectsCache();

    // Backend ContractsService.approveDeliverable() sudah otomatis release
    // escrow di dalam transaksi yang sama. Tidak perlu panggil releaseEscrow
    // dari FE lagi — sebelumnya panggilan kedua selalu ditolak backend karena
    // status sudah 'released', error-nya ditelan diam-diam, dan user tidak
    // pernah melihat konfirmasi pencairan dana.
    showToast('✅ Deliverable disetujui & dana escrow dicairkan ke mahasiswa!', 'success');
    await loadContractDetail(contract.id);

    // Tampilkan form review setelah approve
    setTimeout(() => {
      openReviewModal(contract.id,
        contract.users_contracts_student_idTousers?.id,
        contract.users_contracts_student_idTousers?.full_name || 'Mahasiswa');
    }, 800);
  } catch (error) {
    showToast(error.message, 'error');
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

/* ================================================================
   REJECT DELIVERABLE
   ================================================================ */
async function rejectDeliverableFromContract() {
  const contract = window._currentContract;
  if (!contract) return;

  const existing = document.getElementById('reject-deliverable-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'reject-deliverable-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:440px" role="dialog">
      <div class="modal-drag-bar"></div>
      <h2 style="font-size:17px;font-weight:800;margin-bottom:6px">Tolak Deliverable</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
        Berikan alasan penolakan agar mahasiswa tahu apa yang perlu diperbaiki.
      </p>
      <div class="form-group">
        <label class="form-label">Alasan Penolakan <span class="req">*</span></label>
        <textarea class="form-textarea" id="reject-reason-input" rows="3"
          placeholder="Contoh: File tidak sesuai spesifikasi, resolusi terlalu rendah..."></textarea>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-ghost" style="flex:1"
          onclick="document.getElementById('reject-deliverable-modal').remove()">Batal</button>
        <button class="btn btn-danger" style="flex:2;height:44px" id="reject-confirm-btn"
          onclick="_confirmRejectDeliverable('${escAttr(contract.id)}')">❌ Tolak & Minta Upload Ulang</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('reject-reason-input')?.focus(), 100);
}

let _confirmRejectDelivInFlight = false;
async function _confirmRejectDeliverable(contractId) {
  if (_confirmRejectDelivInFlight) return;
  const reason = document.getElementById('reject-reason-input')?.value.trim();
  if (!reason || reason.length < 10) {
    showToast('Tulis alasan minimal 10 karakter', 'error');
    return;
  }

  const btn = document.getElementById('reject-confirm-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  _confirmRejectDelivInFlight = true;

  try {
    await ContractsAPI.reject(contractId, { reason });
    if (typeof invalidateMyProjectsCache === 'function') invalidateMyProjectsCache();
    document.getElementById('reject-deliverable-modal')?.remove();
    showToast('Deliverable ditolak. Mahasiswa akan diminta upload ulang.', 'info');
    await loadContractDetail(contractId);
  } catch (error) {
    showToast(error.message || 'Gagal menolak deliverable', 'error');
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  } finally {
    _confirmRejectDelivInFlight = false;
  }
}

/* ================================================================
   REVIEW MODAL — design unified untuk biz & student
   ================================================================
   Sebelumnya ada DUA modal terpisah (openReviewModal & openStudentReviewModal)
   dengan ~95 baris kode yang sangat mirip — duplication murni. Sekarang
   satu fungsi shared dengan parameter `kind` untuk decide tag preset dan
   panggilan API. Visual juga di-upgrade: hero gradient header, animasi
   star yang lebih hidup, character counter, tag emoji, dan button feedback.
*/

/**
 * Buka modal review.
 * @param {object} opts
 * @param {string} opts.contractId
 * @param {string} opts.targetId       — user yang di-review (untuk reviewee_id, kalau perlu)
 * @param {string} opts.targetName     — nama yang ditampilkan di header
 * @param {'bisnis'|'mahasiswa'} opts.targetRole — peran target (untuk pilih preset tag & copywriting)
 */
function openContractReviewModal(opts) {
  const { contractId, targetId, targetName, targetRole } = opts;

  // Cleanup modal lama
  document.getElementById('contract-review-modal')?.remove();

  // Preset tag berbeda untuk biz (rating mahasiswa) vs mahasiswa (rating biz)
  const isReviewingStudent = targetRole === 'mahasiswa';
  const tags = isReviewingStudent
    ? ['⏰ Tepat Waktu', '💬 Komunikatif', '✨ Hasil Memuaskan', '🔄 Revisi Cepat', '👔 Profesional', '💡 Kreatif']
    : ['💸 Pembayaran Tepat', '💬 Komunikatif', '📋 Brief Jelas', '⚡ Feedback Cepat', '😊 Ramah', '👔 Profesional'];

  const subCopy = isReviewingStudent
    ? 'Review kamu membantu mahasiswa mendapat lebih banyak project'
    : 'Review kamu membantu bisnis mendapat kepercayaan lebih dari freelancer';

  const initial = (targetName || '?').charAt(0).toUpperCase();

  const modal = document.createElement('div');
  modal.id = 'contract-review-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:460px;padding:0;overflow:hidden" role="dialog">

      <!-- ─── HERO HEADER ─── -->
      <div style="
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark, #4338ca) 100%);
          padding: 24px 24px 32px;
          text-align: center;
          position: relative;
          overflow: hidden;
        ">
        <!-- Dekoratif -->
        <div style="position:absolute;top:10px;left:18px;font-size:14px;opacity:0.25">✨</div>
        <div style="position:absolute;top:18px;right:22px;font-size:18px;opacity:0.2">⭐</div>
        <div style="position:absolute;bottom:8px;left:32px;font-size:12px;opacity:0.2">✨</div>
        <div style="position:absolute;bottom:18px;right:18px;font-size:10px;opacity:0.25">⭐</div>

        <div style="
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            backdrop-filter: blur(8px);
            border: 2px solid rgba(255,255,255,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            font-weight: 700;
            color: white;
            margin: 0 auto 10px;
            position: relative;
            z-index: 1;
          ">${esc(initial)}</div>
        <div style="font-size:16px;font-weight:700;color:white;position:relative;z-index:1">
          Beri Rating untuk ${esc(targetName)}
        </div>
        <div style="font-size:11.5px;color:rgba(255,255,255,0.85);margin-top:4px;line-height:1.5;padding:0 8px;position:relative;z-index:1">
          ${esc(subCopy)}
        </div>
      </div>

      <!-- ─── BODY ─── -->
      <div style="padding: 20px 24px 24px">

        <!-- Star Rating Card -->
        <div style="
            text-align: center;
            margin-bottom: 18px;
            margin-top: -22px;
            background: var(--bg-card, #fff);
            border-radius: 14px;
            padding: 16px 12px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.08);
            position: relative;
            z-index: 2;
          ">
          <p style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;letter-spacing:0.5px;text-transform:uppercase">
            Seberapa puas dengan kolaborasi ini?
          </p>
          <div style="display:flex;gap:6px;justify-content:center" id="cr-star-rating">
            ${[1,2,3,4,5].map(n => `
              <div onclick="setContractReviewRating(${n})" id="cr-star-${n}"
                style="font-size:34px;cursor:pointer;filter:grayscale(1) opacity(0.35);transition:filter 0.2s ease, transform 0.15s ease">⭐</div>
            `).join('')}
          </div>
          <input type="hidden" id="cr-review-rating" value="0">
          <p id="cr-rating-label" style="font-size:13px;font-weight:600;color:var(--accent);margin-top:10px;min-height:18px;transition:opacity 0.2s">
            Tap bintang untuk memberi rating
          </p>
        </div>

        <!-- Tags -->
        <div style="margin-bottom: 16px">
          <label style="
              font-size: 11px;
              font-weight: 600;
              color: var(--text-secondary);
              letter-spacing: 0.4px;
              text-transform: uppercase;
              display: block;
              margin-bottom: 10px;
            ">
            Apa yang menonjol? <span style="text-transform:none;color:var(--text-muted);font-weight:400">(opsional)</span>
          </label>
          <div style="display:flex;flex-wrap:wrap;gap:6px" id="cr-review-tags">
            ${tags.map(tag => `
              <button type="button" class="filter-chip"
                onclick="this.classList.toggle('active')"
                data-tag="${esc(tag)}"
                style="font-size:12px;padding:7px 12px">${esc(tag)}</button>
            `).join('')}
          </div>
        </div>

        <!-- Comment -->
        <div style="margin-bottom: 18px">
          <label style="
              font-size: 11px;
              font-weight: 600;
              color: var(--text-secondary);
              letter-spacing: 0.4px;
              text-transform: uppercase;
              display: block;
              margin-bottom: 8px;
            ">
            Ceritakan pengalamanmu
          </label>
          <textarea class="form-textarea" id="cr-review-comment" rows="3"
            maxlength="500"
            placeholder="${isReviewingStudent ? 'Bagaimana hasil kerjanya? Komunikasinya?' : 'Bagaimana brief & feedback klien? Kerja samanya?'}"
            oninput="document.getElementById('cr-char-count').textContent = this.value.length"
            style="resize:vertical;min-height:80px;font-size:13.5px"></textarea>
          <div style="font-size:10.5px;color:var(--text-muted);text-align:right;margin-top:4px">
            <span id="cr-char-count">0</span> / 500
          </div>
        </div>

        <!-- Action buttons -->
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" style="flex:1;height:44px;font-size:13.5px"
            onclick="document.getElementById('contract-review-modal').remove()">
            Lewati
          </button>
          <button class="btn btn-primary" style="
              flex: 2;
              height: 44px;
              font-size: 14px;
              font-weight: 700;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(99, 102, 241, 0.28);
            " id="cr-review-submit-btn"
            onclick="_submitContractReview('${escAttr(contractId)}', '${escAttr(targetId || '')}', '${esc(targetRole || '')}')">
            Kirim Review ⭐
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

/**
 * Set rating dengan animasi pop-in.
 */
function setContractReviewRating(n) {
  document.getElementById('cr-review-rating').value = n;
  [1,2,3,4,5].forEach(i => {
    const el = document.getElementById(`cr-star-${i}`);
    if (!el) return;
    const isActive = i <= n;
    el.style.filter    = isActive ? 'grayscale(0) opacity(1)' : 'grayscale(1) opacity(0.35)';
    el.style.transform = isActive ? 'scale(1.05)' : 'scale(1)';
  });

  // Pulse animation pada bintang yang baru di-tap
  const picked = document.getElementById(`cr-star-${n}`);
  if (picked) {
    picked.style.transform = 'scale(1.25)';
    setTimeout(() => { picked.style.transform = 'scale(1.05)'; }, 180);
  }

  const labels = [
    '',
    '😞 Buruk — tidak memuaskan',
    '😐 Kurang — banyak yang harus diperbaiki',
    '😊 Cukup — sesuai ekspektasi',
    '😄 Bagus — pengalaman menyenangkan',
    '🤩 Luar Biasa — sangat direkomendasikan!',
  ];
  const lbl = document.getElementById('cr-rating-label');
  if (lbl) {
    lbl.style.opacity = '0';
    setTimeout(() => {
      lbl.textContent = labels[n] || '';
      lbl.style.opacity = '1';
    }, 100);
  }
}

let _submitContractReviewInFlight = false;
async function _submitContractReview(contractId, targetId, targetRole) {
  if (_submitContractReviewInFlight) return;

  const rating = parseInt(document.getElementById('cr-review-rating')?.value || '0');
  if (!rating) {
    showToast('Pilih rating dulu (1-5 bintang)', 'error');
    // Shake animasi pada star area
    const wrap = document.getElementById('cr-star-rating');
    if (wrap) {
      wrap.style.animation = 'shake 0.4s ease';
      setTimeout(() => { wrap.style.animation = ''; }, 500);
    }
    return;
  }

  const comment = document.getElementById('cr-review-comment')?.value.trim() || '';
  const tags    = Array.from(document.querySelectorAll('#cr-review-tags .filter-chip.active'))
    .map(el => el.dataset.tag || el.textContent.trim());

  const btn = document.getElementById('cr-review-submit-btn');
  const originalHTML = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Mengirim...'; }
  _submitContractReviewInFlight = true;

  try {
    // Kirim hanya field yang ada di DTO backend: contract_id, rating, comment, tags.
    // reviewee_id TIDAK dikirim — backend auto-derive dari contract (line 36-39
    // reviews.service.ts): kalau bisnis review → reviewee = student, sebaliknya.
    // Mengirim reviewee_id akan trigger "property reviewee_id should not exist"
    // karena DTO backend tidak punya field itu (class-validator whitelistnya ketat).
    const payload = { contract_id: contractId, rating, comment, tags };

    await ReviewsAPI.create(payload);
    document.getElementById('contract-review-modal')?.remove();
    showToast('Review berhasil dikirim! ⭐ Terima kasih atas feedback kamu.', 'success');
    await loadContractDetail(contractId);
  } catch (error) {
    showToast(error.message || 'Gagal mengirim review', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = originalHTML || 'Kirim Review ⭐'; }
  } finally {
    _submitContractReviewInFlight = false;
  }
}

/* ── Backward-compatible aliases ──
   HTML existing memanggil openReviewModal & openStudentReviewModal
   dengan signature (contractId, targetId, targetName). Kita pertahankan
   kompatibilitas dengan adapter ini supaya tidak perlu ubah HTML.
*/
function openReviewModal(contractId, studentId, studentName) {
  return openContractReviewModal({
    contractId,
    targetId:   studentId,
    targetName: studentName,
    targetRole: 'mahasiswa',
  });
}

function openStudentReviewModal(contractId, bizId, bizName) {
  return openContractReviewModal({
    contractId,
    targetId:   bizId,
    targetName: bizName,
    targetRole: 'bisnis',
  });
}

// Legacy stubs — beberapa baris HTML lama mungkin masih panggil ini.
// Forward ke implementasi baru supaya tidak ada handler null.
function setStarRating(n)         { return setContractReviewRating(n); }
function setStudentStarRating(n)  { return setContractReviewRating(n); }
function toggleContractReviewTag(el)  { el.classList.toggle('active'); }
function toggleStudentReviewTag(el)   { el.classList.toggle('active'); }
async function _submitReview(contractId, studentId) {
  return _submitContractReview(contractId, studentId, 'mahasiswa');
}
async function _submitStudentReview(contractId, bizId) {
  return _submitContractReview(contractId, bizId, 'bisnis');
}

/* ================================================================
   DELIVERABLE FILE URL HELPERS
   ================================================================ */

/**
 * Parse deliverable_url yang bisa berupa plain string atau JSON array.
 * Backend simpan multiple file sebagai JSON array string.
 * Return: array of URL strings.
 */
function parseDeliverableUrls(urlField) {
  if (!urlField) return [];
  if (urlField.startsWith('[')) {
    try {
      const parsed = JSON.parse(urlField);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [urlField];
    } catch (_) { return [urlField]; }
  }
  return [urlField];
}

/**
 * Render semua file link dari deliverable_url sebagai HTML buttons.
 * Sebelumnya hanya tampil 1 link ("Lihat File →"), sekarang tampil
 * semua file yang di-upload dengan nama file masing-masing.
 */
function renderDeliverableFileLinks(urlField, extraStyle = '') {
  const urls = parseDeliverableUrls(urlField);
  if (urls.length === 0) return '';
  return urls.map((urlOrPath, idx) => {
    const parts       = urlOrPath.split('/');
    const rawName     = decodeURIComponent(parts[parts.length - 1] || `File ${idx + 1}`);
    const displayName = rawName.length > 35 ? rawName.substring(0, 32) + '...' : rawName;
    return `<button type="button"
      class="btn btn-ghost btn-sm"
      style="font-size:12px;display:inline-flex;align-items:center;gap:6px;${extraStyle}"
      onclick="openDeliverableFile('${escAttr(urlOrPath)}')">
      📂 ${esc(displayName)}
    </button>`;
  }).join('');
}

async function openDeliverableFile(urlOrPath) {
  try {
    const url = await resolveImageUrl(urlOrPath);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else showToast('Gagal membuka file', 'error');
  } catch {
    showToast('Gagal membuka file', 'error');
  }
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.parseDeliverableUrls          = parseDeliverableUrls;
window.renderDeliverableFileLinks    = renderDeliverableFileLinks;
window.delivFiles                     = delivFiles;
window.addDeliverableFile             = addDeliverableFile;
window.handleDelivFileChange          = handleDelivFileChange;
window.renderDelivFiles               = renderDelivFiles;
window.removeDelivFile                = removeDelivFile;
window.submitDeliverable              = submitDeliverable;
window.loadContractDetail             = loadContractDetail;
window.approveDeliverableFromContract = approveDeliverableFromContract;
window.rejectDeliverableFromContract  = rejectDeliverableFromContract;
window._confirmRejectDeliverable      = _confirmRejectDeliverable;
window.openContractReviewModal        = openContractReviewModal;
window.setContractReviewRating        = setContractReviewRating;
window._submitContractReview          = _submitContractReview;
window.openReviewModal                = openReviewModal;
window.openStudentReviewModal         = openStudentReviewModal;
window.setStarRating                  = setStarRating;
window.setStudentStarRating           = setStudentStarRating;
window.toggleContractReviewTag        = toggleContractReviewTag;
window.toggleStudentReviewTag         = toggleStudentReviewTag;
window._submitReview                  = _submitReview;
window._submitStudentReview           = _submitStudentReview;
window.openDeliverableFile = openDeliverableFile;