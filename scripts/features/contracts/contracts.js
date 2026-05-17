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
  const MAX_MB = 20;
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

async function submitDeliverable() {
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

  try {
    showToast('Mengupload file...', 'info');
    const urls = [];
    for (const f of delivFiles) {
      if (f._file) {
        try {
          const res = await UploadAPI.uploadFile(f._file, 'deliverable');
          urls.push(res?.data?.url || res?.url || f.name);
        } catch (_) { urls.push(f.name); }
      }
    }

    await ContractsAPI.uploadDeliverable(contractId, {
      deliverable_url:   urls[0] || '',
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

    // Cek apakah sudah ada review untuk kontrak ini
    let existingReview = null;
    if (contract.status === 'completed' && !isStudent) {
      try {
        const reviewRes = await ReviewsAPI.getByContract(contract.id);
        existingReview = reviewRes.data;
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
            <div style="font-size:12px;color:${statusCfg.color}">Dimulai ${startedStr} · Deadline ${deadlineStr}</div>
          </div>
          <span class="badge" style="margin-left:auto;background:${statusCfg.color};color:white">${statusCfg.icon} ${statusCfg.label}</span>
        </div>

        <h3 style="font-size:16px;font-weight:700;margin-bottom:14px">${project.title || 'Kontrak'}</h3>

        <div style="display:grid;gap:10px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid var(--divider)">
            <span style="color:var(--text-secondary)">${isStudent ? 'Klien' : 'Freelancer'}</span>
            <span style="font-weight:600">${isStudent ? (business.full_name || '-') : (student.full_name || '-')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid var(--divider)">
            <span style="color:var(--text-secondary)">Nilai Kontrak</span>
            <span style="font-weight:700;color:var(--accent)">Rp ${(contract.agreed_budget || 0).toLocaleString('id-ID')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid var(--divider)">
            <span style="color:var(--text-secondary)">Status Escrow</span>
            <span class="badge ${contract.status === 'completed' ? 'badge-teal' : 'badge-amber'}">
              ${contract.status === 'completed' ? '✅ Dana Dicairkan' : '🔒 Dana Ditahan'}
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0">
            <span style="color:var(--text-secondary)">Progress</span>
            <span style="font-weight:600;color:var(--accent)">${contract.progress_pct || 0}%</span>
          </div>
        </div>

        <div class="progress-bar" style="margin-bottom:16px">
          <div class="progress-fill" style="width:${contract.progress_pct || 0}%"></div>
        </div>

        ${/* Deliverable section — tampilkan untuk bisnis saat pending_review */ ''}
        ${!isStudent && contract.status === 'pending_review' && contract.deliverable_url ? `
        <div style="background:var(--amber-light);border:1px solid rgba(245,158,11,0.3);border-radius:var(--radius-md);padding:16px;margin-bottom:16px">
          <div style="font-size:14px;font-weight:700;color:var(--amber-dark);margin-bottom:10px">📎 Deliverable dari Mahasiswa</div>
          <div style="font-size:13px;color:var(--amber-dark);margin-bottom:10px;line-height:1.6">
            ${contract.deliverable_notes || 'Mahasiswa telah mengirim deliverable'}
          </div>
          <a href="${contract.deliverable_url}" target="_blank" class="btn btn-ghost btn-sm" style="margin-bottom:0">
            📂 Lihat / Download File →
          </a>
        </div>` : ''}

        ${/* Deliverable section — tampilkan untuk mahasiswa */ ''}
        ${isStudent && contract.deliverable_url ? `
        <div style="background:var(--teal-light);border:1px solid rgba(20,184,166,0.3);border-radius:var(--radius-md);padding:14px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:var(--teal-dark);margin-bottom:6px">📎 Deliverable Terkirim</div>
          <div style="font-size:13px;color:var(--teal-dark);margin-bottom:8px">${contract.deliverable_notes || 'File sudah diupload'}</div>
          <a href="${contract.deliverable_url}" target="_blank" class="btn btn-ghost btn-sm">Lihat File →</a>
        </div>` : ''}

        ${/* Review yang sudah ada */ ''}
        ${existingReview ? `
        <div style="background:var(--teal-light);border:1px solid rgba(20,184,166,0.3);border-radius:var(--radius-md);padding:14px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:var(--teal-dark);margin-bottom:6px">⭐ Review Sudah Diberikan</div>
          <div style="font-size:20px;margin-bottom:4px">${'⭐'.repeat(existingReview.rating || 0)}</div>
          <div style="font-size:13px;color:var(--teal-dark)">${existingReview.comment || '-'}</div>
        </div>` : ''}

        ${/* Action buttons */ ''}
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          ${isStudent ? `
            ${contract.status === 'active' ? `
            <button class="btn btn-primary" style="flex:2;height:48px;font-size:15px"
              onclick="window.currentContractId='${contract.id}';goTo('screen-deliverable-upload')">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" width="18"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload Deliverable
            </button>` : ''}
            ${contract.status === 'pending_review' ? `
            <div style="flex:2;background:var(--amber-light);border-radius:var(--radius-md);padding:12px;text-align:center;font-size:13px;color:var(--amber-dark);font-weight:600">
              ⏳ Menunggu review dari klien...
            </div>` : ''}
            ${contract.status === 'completed' && isStudent ? `
            <button class="btn btn-primary" style="flex:2;height:48px;font-size:15px"
              onclick="openStudentReviewModal('${contract.id}', '${business.id}', '${business.full_name || 'Klien'}')">
              ⭐ Beri Rating Klien
            </button>` : ''}
            <button class="btn btn-ghost" style="flex:1;height:48px"
              onclick="openDirectChatWith('${business.full_name || 'Klien'}','bisnis','Kontrak: ${project.title || ''}')">
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
              onclick="openReviewModal('${contract.id}', '${student.id}', '${student.full_name || 'Mahasiswa'}')">
              ⭐ Beri Rating & Review
            </button>` : ''}
            <button class="btn btn-ghost" style="flex:1;height:48px"
              onclick="openDirectChatWith('${student.full_name || 'Freelancer'}','mahasiswa','Kontrak: ${project.title || ''}')">
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
              ${d.deliverable_notes ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">📝 Catatan: ${d.deliverable_notes}</div>` : ''}
              ${d.rejection_reason ? `<div style="font-size:12px;color:var(--rose);margin-bottom:6px;padding:6px 8px;background:rgba(239,68,68,0.1);border-radius:6px">⚠️ Alasan penolakan: <b>${d.rejection_reason}</b></div>` : ''}
              ${d.deliverable_url ? `<a href="${d.deliverable_url}" target="_blank" style="font-size:12px;color:var(--accent);font-weight:600">📂 Lihat File →</a>` : ''}
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

  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  try {
    await ContractsAPI.approve(contract.id);

    // Coba release escrow
      try {
    const paymentRes = await PaymentsAPI.getByContract(contract.id);
    if (paymentRes.data?.id) {
      await PaymentsAPI.releaseEscrow(paymentRes.data.id);
      showToast('💰 Dana escrow berhasil dicairkan ke mahasiswa!', 'success');
    } else {
      console.warn('[escrow] Tidak ada payment ditemukan untuk kontrak ini');
    }
  } catch (escrowErr) {
    console.warn('[escrow] Release gagal:', escrowErr.message);
  }

    showToast('✅ Deliverable disetujui! Kontrak selesai.', 'success');
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
          onclick="_confirmRejectDeliverable('${contract.id}')">❌ Tolak & Minta Upload Ulang</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('reject-reason-input')?.focus(), 100);
}

async function _confirmRejectDeliverable(contractId) {
  const reason = document.getElementById('reject-reason-input')?.value.trim();
  if (!reason || reason.length < 10) {
    showToast('Tulis alasan minimal 10 karakter', 'error');
    return;
  }

  const btn = document.getElementById('reject-confirm-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  try {
    await ContractsAPI.reject(contractId, { reason });
    document.getElementById('reject-deliverable-modal')?.remove();
    showToast('Deliverable ditolak. Mahasiswa akan diminta upload ulang.', 'info');
    await loadContractDetail(contractId);
  } catch (error) {
    showToast(error.message || 'Gagal menolak deliverable', 'error');
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

/* ================================================================
   REVIEW MODAL
   ================================================================ */
function openReviewModal(contractId, studentId, studentName) {
  const existing = document.getElementById('review-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'review-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:480px" role="dialog">
      <div class="modal-drag-bar"></div>
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:36px;margin-bottom:8px">⭐</div>
        <h2 style="font-size:17px;font-weight:800;margin-bottom:4px">Beri Rating untuk ${studentName}</h2>
        <p style="font-size:13px;color:var(--text-secondary)">Review kamu membantu mahasiswa mendapat lebih banyak project</p>
      </div>

      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Rating <span class="req">*</span></label>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:8px" id="star-rating">
          ${[1,2,3,4,5].map(n => `
            <div onclick="setStarRating(${n})" id="star-${n}"
              style="font-size:32px;cursor:pointer;opacity:0.4;transition:all 0.15s">⭐</div>
          `).join('')}
        </div>
        <input type="hidden" id="review-rating" value="0">
      </div>

      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Komentar</label>
        <textarea class="form-textarea" id="review-comment" rows="3"
          placeholder="Ceritakan pengalaman kerjasama kamu dengan mahasiswa ini..."></textarea>
      </div>

      <div class="form-group" style="margin-bottom:20px">
        <label class="form-label">Tag (opsional)</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px" id="review-tags">
          ${['Tepat Waktu','Komunikatif','Hasil Memuaskan','Revisi Cepat','Profesional','Kreatif'].map(tag => `
            <div onclick="toggleContractReviewTag(this,'${tag}')"
              style="padding:6px 12px;border-radius:20px;border:1px solid var(--border);font-size:12px;cursor:pointer;transition:all 0.15s"
              data-tag="${tag}">${tag}</div>
          `).join('')}
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1"
          onclick="document.getElementById('review-modal').remove()">Lewati</button>
        <button class="btn btn-primary" style="flex:2;height:44px" id="review-submit-btn"
          onclick="_submitReview('${contractId}', '${studentId}')">⭐ Kirim Review</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function setStarRating(n) {
  document.getElementById('review-rating').value = n;
  [1,2,3,4,5].forEach(i => {
    const el = document.getElementById(`star-${i}`);
    if (el) el.style.opacity = i <= n ? '1' : '0.3';
  });
}

function toggleContractReviewTag(el, tag) {
  el.classList.toggle('active');
  if (el.classList.contains('active')) {
    el.style.background = 'var(--accent)';
    el.style.color = 'white';
    el.style.borderColor = 'var(--accent)';
  } else {
    el.style.background = '';
    el.style.color = '';
    el.style.borderColor = 'var(--border)';
  }
}

async function _submitReview(contractId, studentId) {
  const rating = parseInt(document.getElementById('review-rating')?.value || '0');
  if (!rating) { showToast('Pilih rating dulu (1-5 bintang)', 'error'); return; }

  const comment = document.getElementById('review-comment')?.value.trim();
  const tags    = Array.from(document.querySelectorAll('#review-tags [data-tag].active'))
    .map(el => el.dataset.tag);

  const btn = document.getElementById('review-submit-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  try {
    await ReviewsAPI.create({ contract_id: contractId, rating, comment, tags });
    document.getElementById('review-modal')?.remove();
    showToast('Review berhasil dikirim! ⭐ Terima kasih atas feedback kamu.', 'success');
    await loadContractDetail(contractId);
  } catch (error) {
    showToast(error.message || 'Gagal mengirim review', 'error');
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

function openStudentReviewModal(contractId, bizId, bizName) {
  const existing = document.getElementById('student-review-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'student-review-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:480px" role="dialog">
      <div class="modal-drag-bar"></div>
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:36px;margin-bottom:8px">⭐</div>
        <h2 style="font-size:17px;font-weight:800;margin-bottom:4px">Beri Rating untuk ${bizName}</h2>
        <p style="font-size:13px;color:var(--text-secondary)">Review kamu membantu bisnis mendapat kepercayaan lebih dari freelancer</p>
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Rating <span class="req">*</span></label>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:8px" id="student-star-rating">
          ${[1,2,3,4,5].map(n => `
            <div onclick="setStudentStarRating(${n})" id="s-star-${n}"
              style="font-size:32px;cursor:pointer;opacity:0.4;transition:all 0.15s">⭐</div>
          `).join('')}
        </div>
        <input type="hidden" id="student-review-rating" value="0">
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Komentar</label>
        <textarea class="form-textarea" id="student-review-comment" rows="3"
          placeholder="Ceritakan pengalaman kerjasama kamu dengan klien ini..."></textarea>
      </div>
      <div class="form-group" style="margin-bottom:20px">
        <label class="form-label">Tag (opsional)</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px" id="student-review-tags">
          ${['Pembayaran Tepat','Komunikatif','Brief Jelas','Feedback Cepat','Ramah','Profesional'].map(tag => `
            <div onclick="toggleStudentReviewTag(this,'${tag}')"
              style="padding:6px 12px;border-radius:20px;border:1px solid var(--border);font-size:12px;cursor:pointer;transition:all 0.15s"
              data-tag="${tag}">${tag}</div>
          `).join('')}
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1"
          onclick="document.getElementById('student-review-modal').remove()">Lewati</button>
        <button class="btn btn-primary" style="flex:2;height:44px" id="student-review-submit-btn"
          onclick="_submitStudentReview('${contractId}', '${bizId}')">⭐ Kirim Review</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function setStudentStarRating(n) {
  document.getElementById('student-review-rating').value = n;
  [1,2,3,4,5].forEach(i => {
    const el = document.getElementById(`s-star-${i}`);
    if (el) el.style.opacity = i <= n ? '1' : '0.3';
  });
}

function toggleStudentReviewTag(el, tag) {
  el.classList.toggle('active');
  if (el.classList.contains('active')) {
    el.style.background = 'var(--accent)';
    el.style.color = 'white';
    el.style.borderColor = 'var(--accent)';
  } else {
    el.style.background = '';
    el.style.color = '';
    el.style.borderColor = 'var(--border)';
  }
}

async function _submitStudentReview(contractId, bizId) {
  const rating = parseInt(document.getElementById('student-review-rating')?.value || '0');
  if (!rating) { showToast('Pilih rating dulu (1-5 bintang)', 'error'); return; }

  const comment = document.getElementById('student-review-comment')?.value.trim();
  const tags    = Array.from(document.querySelectorAll('#student-review-tags [data-tag].active'))
    .map(el => el.dataset.tag);

  const btn = document.getElementById('student-review-submit-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  try {
    await ReviewsAPI.create({
      contract_id: contractId,
      reviewee_id: bizId,
      rating, comment, tags,
    });
    document.getElementById('student-review-modal')?.remove();
    showToast('Review berhasil dikirim! ⭐ Terima kasih.', 'success');
    await loadContractDetail(contractId);
  } catch (error) {
    showToast(error.message || 'Gagal mengirim review', 'error');
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

/* ================================================================
   EXPORTS
   ================================================================ */
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
window.openReviewModal                = openReviewModal;
window.setStarRating                  = setStarRating;
window.toggleContractReviewTag         = toggleContractReviewTag;
window._submitReview                  = _submitReview;
window.openStudentReviewModal         = openStudentReviewModal;
window.setStudentStarRating           = setStudentStarRating;
window.toggleStudentReviewTag         = toggleStudentReviewTag;
window._submitStudentReview           = _submitStudentReview;