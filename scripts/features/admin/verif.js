/**
 * StairsLife — features/admin/verif.js
 * renderAdminVerifListAPI, adminApproveVerifAPI, adminRejectVerifAPI.
 * Phase 3 — Modularisasi.
 */
'use strict';

function adminSetVerifFilter(status, btn) {
  adminVerifView.status = status;
  document.querySelectorAll('#admin-verif-chips .filter-chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  renderAdminVerifListAPI();
}

async function renderAdminVerifListAPI() {
  const el = document.getElementById('admin-verif-list');
  if (!el) return;

  el.innerHTML = skeletons.verifCards(3);

  try {
    const status = adminVerifView.status || 'pending';
    const res    = await AdminAPI.getVerifications(status);
    const items  = res.data || [];

    if (!items.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Tidak ada pengajuan ${status}</div></div>`;
      return;
    }

    el.innerHTML = items.map(v => {
      const user = v.verifications_verifications_user_idTousers || v.user || {};
      return `
      <div class="admin-verif-card">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="width:48px;height:48px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:var(--accent);flex-shrink:0">
            ${(user.full_name || 'U').charAt(0)}
          </div>
          <div style="flex:1">
            <div style="font-size:15px;font-weight:700">${user.full_name || 'User'}</div>
            <div style="font-size:13px;color:var(--text-secondary)">${v.university}</div>
            <div style="font-size:12px;color:var(--text-muted)">${user.email || ''}</div>
          </div>
          ${statusBadge(v.status === 'approved' ? 'aktif' : v.status === 'rejected' ? 'rejected' : 'pending')}
        </div>
        <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:10px;margin-bottom:12px">
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">
            <span style="font-weight:600">NIM:</span> ${v.student_id_number || '-'} &nbsp;·&nbsp;
            <span style="font-weight:600">Universitas:</span> ${v.university || '-'}
          </div>
        </div>
        ${v.ktm_image_url ? `
        <div style="margin-bottom:8px">
          <div style="font-size:12px;color:var(--text-secondary);font-weight:600;margin-bottom:6px">Foto KTM:</div>
          <img src="${v.ktm_image_url}" alt="KTM ${user.full_name}"
            style="width:100%;max-width:400px;border-radius:var(--radius-md);border:1px solid var(--border);cursor:pointer"
            onclick="window.open('${v.ktm_image_url}','_blank')"
            onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
          <div style="display:none;font-size:12px;color:var(--rose);padding:8px">
            ⚠️ Gambar tidak bisa dimuat. 
            <a href="${v.ktm_image_url}" target="_blank" style="color:var(--accent)">Buka link →</a>
          </div>
          <a href="${v.ktm_image_url}" target="_blank" 
            style="font-size:11px;color:var(--accent);display:block;margin-top:4px">
            🔗 Buka di tab baru
          </a>
        </div>` : `
        <div style="font-size:12px;color:var(--rose)">⚠️ Tidak ada foto KTM</div>`}
      </div>
        ${v.status === 'pending' ? `
        <div style="display:flex;gap:10px">
          <button class="btn btn-danger" style="flex:1;height:40px" onclick="adminRejectVerifAPI('${v.id}')">❌ Tolak</button>
          <button class="btn btn-primary" style="flex:2;height:40px" onclick="adminApproveVerifAPI('${v.id}')">✅ Approve</button>
        </div>` : (v.rejection_reason ? `<div style="font-size:12px;color:var(--rose);font-weight:600">Alasan: ${v.rejection_reason}</div>` : '')}
      </div>`;
    }).join('');
  } catch (error) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat data</div></div>`;
  }
}

async function adminApproveVerifAPI(id) {
  try {
    await AdminAPI.reviewVerification(id, { status: 'approved' });
    showToast('Verifikasi berhasil disetujui ✅', 'success');
    await renderAdminVerifListAPI();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function adminRejectVerifAPI(id) {
  // Buat inline modal — ganti native prompt() yang tidak bisa di-style
  const existing = document.getElementById('reject-reason-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id    = 'reject-reason-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:440px" role="dialog">
      <div class="modal-drag-bar"></div>
      <h2 style="font-size:17px;font-weight:800;margin-bottom:6px">Tolak Verifikasi</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Masukkan alasan penolakan. Mahasiswa akan menerima notifikasi beserta alasan ini.</p>
      <div class="form-group">
        <label class="form-label">Alasan Penolakan <span class="req">*</span></label>
        <textarea class="form-textarea" id="reject-reason-input" rows="3"
          placeholder="Contoh: Foto KTM buram / data tidak sesuai / dokumen kadaluarsa..."></textarea>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('reject-reason-modal').remove()">Batal</button>
        <button class="btn btn-danger" style="flex:2;height:44px" id="reject-reason-confirm-btn"
          onclick="_confirmRejectVerif('${id}')">❌ Tolak Verifikasi</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('reject-reason-input')?.focus(), 100);
}

async function _confirmRejectVerif(id) {
  const reason = document.getElementById('reject-reason-input')?.value.trim();
  if (!reason || reason.length < 5) {
    showToast('Masukkan alasan minimal 5 karakter', 'error');
    return;
  }
  const btn = document.getElementById('reject-reason-confirm-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  try {
    await AdminAPI.reviewVerification(id, {
      status: 'rejected',
      rejection_reason: reason,
    });
    document.getElementById('reject-reason-modal')?.remove();
    showToast('Verifikasi ditolak ❌', 'error');
    await renderAdminVerifListAPI();
  } catch (error) {
    showToast(error.message, 'error');
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

// Aliases (HTML may call these)
async function renderAdminVerifList() { return renderAdminVerifListAPI(); }
async function adminApprove(id) { return adminApproveVerifAPI(id); }
async function adminReject(id)  { return adminRejectVerifAPI(id); }

/* ================================================================
   EXPORTS
   ================================================================ */
window.adminSetVerifFilter    = adminSetVerifFilter;
window.renderAdminVerifListAPI = renderAdminVerifListAPI;
window.adminApproveVerifAPI   = adminApproveVerifAPI;
window.adminRejectVerifAPI    = adminRejectVerifAPI;
window._confirmRejectVerif    = _confirmRejectVerif;
window.renderAdminVerifList   = renderAdminVerifList;
window.adminApprove           = adminApprove;
window.adminReject            = adminReject;
