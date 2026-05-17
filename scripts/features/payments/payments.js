/**
 * StairsLife — features/payments/payments.js
 * renderPayments, showEscrowModal, submitEscrowAndContract, approveDeliverableAndRelease.
 * Depends on: PaymentsAPI, ContractsAPI, showToast, onEnterBusiness, statusBadge.
 * Phase 3 — Modularisasi.
 */
'use strict';

/* ================================================================
   PAYMENTS LIST (business dashboard tab)
   ================================================================ */
async function renderPayments() {
  const el = document.getElementById('payments-list');
  if (!el) return;

  try {
    const res      = await PaymentsAPI.getMyPayments();
    const payments = res.data || [];

    if (!payments.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💳</div><div class="empty-state-title">Belum ada transaksi</div></div>`;
      return;
    }

    el.innerHTML = payments.map(p => `
    <div class="card card-p-md" style="margin-bottom:10px;display:flex;align-items:center;gap:14px">
      <div style="width:44px;height:44px;border-radius:50%;background:${p.status === 'released' ? 'var(--teal-light)' : 'var(--amber-light)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="${p.status === 'released' ? 'var(--teal-dark)' : 'var(--amber-dark)'}" stroke-width="2" width="22" height="22"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
      </div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:600;margin-bottom:2px">${p.contracts?.projects?.title || 'Project'}</div>
        <div style="font-size:12px;color:var(--text-muted)">${new Date(p.created_at).toLocaleDateString('id-ID')}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight:700;color:${p.status === 'released' ? 'var(--teal-dark)' : 'var(--amber-dark)'}">
          Rp ${(p.amount || 0).toLocaleString('id-ID')}
        </div>
        ${statusBadge(p.status)}
      </div>
    </div>`).join('');
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat pembayaran</div></div>`;
  }
}

/* ================================================================
   ESCROW MODAL
   ================================================================ */
let _escrowProofUploaded = false;
let _escrowProofFile    = null; // actual File object untuk diupload ke backend

function showEscrowModal(applicationId, application, projectTitle) {
  const existing = document.getElementById('escrow-modal');
  if (existing) existing.remove();

  const amount       = application?.offered_budget || '';
  const deadline     = application?.estimated_completion
    ? new Date(application.estimated_completion).toISOString().split('T')[0]
    : '';
  const studentName  = application?.users?.full_name || 'Mahasiswa';

  const modal        = document.createElement('div');
  modal.id           = 'escrow-modal';
  modal.className    = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML    = `
    <div class="modal-sheet" style="max-width:520px;overflow-y:auto;max-height:90vh" role="dialog">
      <div class="modal-drag-bar"></div>
      <div style="text-align:center;margin-bottom:20px">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px">🔒</div>
        <h2 style="font-size:20px;font-weight:800;margin-bottom:6px">Deposit Escrow</h2>
        <p style="font-size:13px;color:var(--text-secondary)">Project: <b>${projectTitle}</b> · Freelancer: <b>${studentName}</b></p>
      </div>
      <div class="info-box info-box--teal" style="margin-bottom:16px">
        <svg viewBox="0 0 24 24" style="stroke:var(--teal-dark)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
        <p style="color:var(--teal-dark);font-size:13px">Dana ditahan sampai kamu approve deliverable. Aman & terlindungi.</p>
      </div>
      <div style="display:grid;gap:14px;margin-bottom:20px">
        <div class="form-group">
          <label class="form-label">Nominal Kontrak (Rp) <span class="req">*</span></label>
          <input class="form-input" id="escrow-amount" type="number" value="${amount}" placeholder="Sesuai kesepakatan" min="10000">
          <div class="form-hint">Sesuai tawaran freelancer: ${amount ? 'Rp ' + parseInt(amount).toLocaleString('id-ID') : 'belum ada tawaran, isi manual'}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Deadline Kontrak <span class="req">*</span></label>
          <input class="form-input" id="escrow-deadline" type="date" value="${deadline}" min="${new Date().toISOString().split('T')[0]}">
          <div class="form-hint">Estimasi dari freelancer: ${deadline ? new Date(deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Upload Bukti Transfer <span class="req">*</span></label>
          <div class="ktm-upload-area" id="escrow-upload-area" onclick="document.getElementById('escrow-proof-input').click()" style="cursor:pointer">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p style="font-size:14px;font-weight:600;color:var(--text-secondary);margin:0">Tap untuk upload bukti transfer</p>
            <p style="font-size:12px;color:var(--text-muted);margin-top:4px">JPG, PNG, PDF (maks. 5MB)</p>
          </div>
          <!-- Hidden file input -->
          <input type="file" id="escrow-proof-input"
                 accept="image/jpeg,image/png,application/pdf"
                 style="display:none"
                 onchange="handleEscrowProofChange(event)">
          <div id="escrow-upload-status" style="display:none;margin-top:8px">
            <div style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--teal-light);border-radius:var(--radius-sm)">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal-dark)" stroke-width="2" width="18"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span style="font-size:13px;color:var(--teal-dark);font-weight:600" id="escrow-upload-name">bukti_transfer.jpg</span>
              <button style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:12px" onclick="document.getElementById('escrow-proof-input').click()">Ganti</button>
            </div>
          </div>
        </div>
      </div>
      <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;margin-bottom:16px;font-size:13px;color:var(--text-secondary)">
        💡 <b>Cara transfer:</b> Transfer ke rekening Virtual Account StairsLife, lalu upload screenshot konfirmasi transfer.
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="closeEscrowModal()">Batal</button>
        <button class="btn btn-primary" style="flex:2;height:48px;font-size:15px" id="escrow-submit-btn" onclick="submitEscrowAndContract('${applicationId}')">
          🔒 Konfirmasi & Buat Kontrak
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

/**
 * Dipanggil saat user pilih file di <input id="escrow-proof-input">.
 * Validasi ukuran, simpan ke _escrowProofFile, update UI.
 */
function handleEscrowProofChange(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  const MAX_MB = 5;
  if (file.size > MAX_MB * 1024 * 1024) {
    showToast(`Ukuran file maksimal ${MAX_MB}MB`, 'error');
    if (event.target) event.target.value = '';
    return;
  }

  _escrowProofFile    = file;
  _escrowProofUploaded = true;

  const area   = document.getElementById('escrow-upload-area');
  const status = document.getElementById('escrow-upload-status');
  const name   = document.getElementById('escrow-upload-name');
  if (area)   area.style.display   = 'none';
  if (status) status.style.display = 'block';
  if (name)   name.textContent     = file.name;
  showToast('Bukti transfer dipilih ✅', 'success');
}

// Alias untuk backward compat jika ada referensi lama di HTML
function simulateEscrowUpload() {
  document.getElementById('escrow-proof-input')?.click();
}

function closeEscrowModal() {
  const modal = document.getElementById('escrow-modal');
  if (modal) modal.remove();
  document.body.style.overflow = '';
  // Reset state file setelah modal ditutup
  _escrowProofUploaded = false;
  _escrowProofFile     = null;
}

async function submitEscrowAndContract(applicationId) {
  const amount   = parseInt(document.getElementById('escrow-amount')?.value || '0');
  const deadline = document.getElementById('escrow-deadline')?.value;

  if (!amount || amount < 10000) { showToast('Masukkan jumlah minimal Rp 10.000', 'error'); return; }
  if (!deadline)                  { showToast('Pilih deadline kontrak', 'error'); return; }
  if (!_escrowProofFile)          { showToast('Upload bukti transfer dulu', 'error'); return; }

  const btn = document.getElementById('escrow-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Mengupload bukti...'; }

  try {
    // 1. Upload bukti transfer ke storage
    const uploadRes = await UploadAPI.uploadFile(_escrowProofFile, 'payment_proof');
    const proofUrl  = uploadRes?.data?.url || uploadRes?.url || null;

    if (btn) btn.textContent = '⏳ Membuat kontrak...';

    // 2. Buat kontrak
    const contractRes = await ContractsAPI.create({
      application_id: applicationId,
      agreed_budget:  amount,
      deadline,
    });
    const contract = contractRes.data;

    // 3. Hold escrow dengan proof URL
    await PaymentsAPI.holdEscrow({
      contract_id: contract.id,
      amount,
      ...(proofUrl && { proof_url: proofUrl }),
    });

    // 4. Approve application SETELAH kontrak & escrow berhasil
    // (L2 fix: sebelumnya approve terjadi sebelum escrow dikonfirmasi)
    await ApplicationsAPI.updateStatus(applicationId, 'approved');

    _escrowProofUploaded = false;
    _escrowProofFile     = null;
    closeEscrowModal();
    showToast(`✅ Kontrak aktif! Rp ${amount.toLocaleString('id-ID')} ditahan di Escrow.`, 'success');
    await onEnterBusiness();
  } catch (error) {
    showToast(error.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🔒 Konfirmasi & Buat Kontrak'; }
  }
}

async function approveDeliverableAndRelease(contractId, paymentId) {
  try {
    await ContractsAPI.approve(contractId);
    if (paymentId) {
      await PaymentsAPI.releaseEscrow(paymentId);
      showToast('✅ Deliverable disetujui! Dana Escrow berhasil dicairkan ke mahasiswa.', 'success');
    } else {
      showToast('✅ Deliverable disetujui!', 'success');
    }
    await onEnterBusiness();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.renderPayments               = renderPayments;
window.showEscrowModal              = showEscrowModal;
window.handleEscrowProofChange      = handleEscrowProofChange;
window.simulateEscrowUpload         = simulateEscrowUpload;
window.closeEscrowModal             = closeEscrowModal;
window.submitEscrowAndContract      = submitEscrowAndContract;
window.approveDeliverableAndRelease = approveDeliverableAndRelease;
