'use strict';

function adminSetDisputeFilter(status, btn) {
  adminDisputeView.status = status;
  document.querySelectorAll('#admin-dispute-chips .filter-chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  renderAdminDisputes();
}

async function renderAdminDisputes() {
  const el = document.getElementById('admin-disputes-list');
  if (!el) return;

  el.innerHTML = skeletons.disputeCards(3);

  try {
    const status   = adminDisputeView.status !== 'all' ? adminDisputeView.status : undefined;
    const res      = await AdminAPI.getDisputes(status);
    const disputes = res.data || [];

    if (!disputes.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚖️</div><div class="empty-state-title">Tidak ada sengketa</div></div>`;
      return;
    }

    el.innerHTML = disputes.map(d => {
      const studentName  = d.contracts?.users_contracts_student_idTousers?.full_name  || 'Mahasiswa';
      const businessName = d.contracts?.users_contracts_business_idTousers?.full_name || 'Bisnis';
      const projectTitle = d.contracts?.projects?.title || 'Project';
      const openedBy     = d.users_disputes_opened_byTousers?.full_name || '-';
      const budget       = (d.contracts?.agreed_budget || 0).toLocaleString('id-ID');
      const date         = new Date(d.created_at).toLocaleDateString('id-ID');
      const isResolved   = d.status === 'resolved';

      return `
      <div class="admin-dispute-card${isResolved ? ' resolved' : ''}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px">
          <span style="font-size:15px;font-weight:700;flex:1">${projectTitle}</span>
          ${statusBadge(isResolved ? 'selesai' : d.status === 'under_review' ? 'pending' : 'open')}
        </div>

        <div class="dispute-row">
          <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span><strong>${studentName}</strong> vs <strong>${businessName}</strong></span>
        </div>

        <div class="dispute-row">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><strong>Alasan:</strong> ${d.reason || '-'}</span>
        </div>

        <div class="dispute-row">
          <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Diajukan oleh: <strong>${openedBy}</strong></span>
        </div>

        <div class="dispute-row">
          <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/></svg>
          <span>Rp ${budget} · ${date}</span>
        </div>

        ${d.admin_notes ? `
        <div style="margin-top:8px;padding:10px;background:var(--teal-light);border-radius:var(--radius-sm);font-size:13px;color:var(--teal-dark)">
          <strong>Keputusan Admin:</strong> ${d.admin_notes}
        </div>` : ''}

        ${!isResolved ? `
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" style="flex:1"
            onclick="adminResolveDisputeAPI('${d.id}', 'resolved')">
            ✅ Selesaikan & Putuskan
          </button>
          <button class="btn btn-ghost btn-sm" style="flex:1"
            onclick="adminOpenDisputeChat('${d.id}', '${studentName}', '${businessName}', '${d.contracts?.id || ''}')">
            💬 Chat Mediasi
          </button>
        </div>` : ''}
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat sengketa</div></div>`;
  }
}

async function adminResolveDisputeAPI(id, action) {
  const existing = document.getElementById('resolve-dispute-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'resolve-dispute-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:440px" role="dialog">
      <div class="modal-drag-bar"></div>
      <h2 style="font-size:17px;font-weight:800;margin-bottom:6px">Keputusan Final Sengketa</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
        Tulis keputusan admin. Semua pihak akan mendapat notifikasi.
      </p>
      <div class="form-group">
        <label class="form-label">Outcome Dana Escrow <span class="req">*</span></label>
        <select class="form-select" id="resolve-dispute-outcome">
          <option value="favor_business">Refund 100% ke Bisnis</option>
          <option value="favor_student">Cairkan 100% ke Mahasiswa</option>
          <option value="split">Bagi 50:50</option>
          <option value="no_action">Tutup tanpa efek finansial (project lanjut)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Keputusan Admin <span class="req">*</span></label>
        <textarea class="form-textarea" id="resolve-dispute-input" rows="3"
          placeholder="Contoh: Dana dikembalikan 100% ke bisnis karena deliverable tidak sesuai..."></textarea>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-ghost" style="flex:1"
          onclick="document.getElementById('resolve-dispute-modal').remove()">Batal</button>
        <button class="btn btn-primary" style="flex:2;height:44px" id="resolve-dispute-confirm-btn"
          onclick="_confirmResolveDispute('${id}')">✅ Selesaikan</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('resolve-dispute-input')?.focus(), 100);
}

const _resolveDisputeInFlight = new Set();
async function _confirmResolveDispute(id) {
  if (_resolveDisputeInFlight.has(id)) return;
  const decision = document.getElementById('resolve-dispute-input')?.value.trim();
  const outcome  = document.getElementById('resolve-dispute-outcome')?.value || 'no_action';
  if (!decision || decision.length < 5) {
    showToast('Masukkan keputusan minimal 5 karakter', 'error');
    return;
  }
  const btn = document.getElementById('resolve-dispute-confirm-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  _resolveDisputeInFlight.add(id);
  try {
    // Backend butuh status + outcome (outcome WAJIB saat resolved).
    await AdminAPI.resolveDispute(id, {
      status:      'resolved',
      outcome,
      ...(outcome === 'split' ? { student_share_percent: 50 } : {}),
      admin_notes: decision,
    });
    document.getElementById('resolve-dispute-modal')?.remove();
    showToast('Dispute berhasil diselesaikan ✅', 'success');
    await renderAdminDisputes();
  } catch (e) {
    showToast(e.message, 'error');
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  } finally {
    _resolveDisputeInFlight.delete(id);
  }
}

async function adminOpenDisputeChat(disputeId, studentName, businessName, contractId) {
  if (!ADMIN_DISPUTES.find(d => d.id === disputeId)) {
    ADMIN_DISPUTES.push({
      id:         disputeId,
      project:    document.querySelector(`[onclick*="${disputeId}"]`)?.closest('.admin-dispute-card')?.querySelector('span')?.textContent || 'Project',
      biz:        businessName,
      student:    studentName,
      openedBy:   studentName,
      contractId: contractId,
      status:     'open',
    });
  }

  if (contractId) {
    window.currentContractId     = contractId;
    window._activeChatContractId = contractId;
    window._disputeContext       = { disputeId, studentName, businessName };
  }

  try {
    const chat = await ensureMediationChat(disputeId, 'admin');
    if (chat) {
      chat.openedBy = studentName;
      document.getElementById('chat-room-avatar').textContent = '⚖️';
      document.getElementById('chat-room-name').textContent   = `Mediasi: ${studentName} vs ${businessName}`;
      document.getElementById('chat-room-status').innerHTML   = `<span style="color:var(--amber)">● Sengketa Aktif</span>`;

      window._sendMessageOverride = async (text) => {
        const currentUser = AuthAPI.getCurrentUser();
        if (!CHAT_MESSAGES[chat.id]) CHAT_MESSAGES[chat.id] = [];
        CHAT_MESSAGES[chat.id].push({
          text, content: text,
          senderRole: 'admin',
          senderName: currentUser?.full_name || 'Admin',
          sender_id:  currentUser?.id,
          time:       new Date(),
        });
        chat.last = text;
        chat.time = new Date();
        renderChatMessages();

        try {
          await MessagesAPI.sendMediation(disputeId, text);
        } catch (e) {
          console.warn('[mediasi] backend fallback:', e.message);
        }
      };

      openChatRoom(chat.id);
    }
  } catch (err) {
    showToast('Gagal membuka room mediasi: ' + err.message, 'error');
  }
}

function closeAdminDisputeDrawer(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('admin-dispute-drawer')?.classList.remove('open');
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.adminSetDisputeFilter   = adminSetDisputeFilter;
window.renderAdminDisputes     = renderAdminDisputes;
window.adminResolveDisputeAPI  = adminResolveDisputeAPI;
window._confirmResolveDispute  = _confirmResolveDispute;
window.adminOpenDisputeChat    = adminOpenDisputeChat;
window.closeAdminDisputeDrawer = closeAdminDisputeDrawer;