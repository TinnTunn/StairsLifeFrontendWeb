/**
 * StairsLife — features/disputes/disputes.js
 * renderDisputeList, openNewDispute, submitNewDispute, onDisputeEvidenceChange.
 * Depends on: DisputesAPI, ContractsAPI, UploadAPI, showToast, goTo, statusBadge.
 * Phase 3 — Modularisasi.
 */
'use strict';

async function renderDisputeList() {
  const el = document.getElementById('dispute-list-content');
  if (!el) return;

  el.innerHTML = skeletons.disputeCards(3);

  try {
    const res      = await DisputesAPI.getMy();
    const disputes = res.data || [];

    if (!disputes.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🤝</div><div class="empty-state-title">Tidak ada sengketa</div><p class="empty-state-desc">Semua project berjalan lancar!</p></div>`;
      return;
    }

    el.innerHTML = disputes.map(d => `
      <div class="dispute-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px">
          <span class="dispute-title">${esc(d.project || 'Project')}</span>
          ${statusBadge(d.status)}
        </div>
        <div class="dispute-row"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/></svg><span>Nilai: ${d.amount ? 'Rp ' + Number(d.amount).toLocaleString('id-ID') : '-'}</span></div>
        <div class="dispute-row"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg><span>${esc(d.reason || '-')}</span></div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-ghost btn-sm" onclick="openDisputeMediation('${escAttr(d.id)}')">💬 Chat Mediasi</button>
        </div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat sengketa</div></div>`;
  }
}

async function openNewDispute() {
  goTo('screen-new-dispute');

  const sel = document.getElementById('dispute-contract');
  if (!sel) return;

  sel.innerHTML = '<option value="">Memuat kontrak aktif...</option>';
  try {
    const res       = await ContractsAPI.getMyContracts();
    const contracts = (res.data || []).filter(c =>
      c.status === 'in_progress' || c.status === 'pending_review' || c.status === 'inProgress',
    );
    if (!contracts.length) {
      sel.innerHTML = '<option value="">Tidak ada kontrak aktif</option>';
      return;
    }
    sel.innerHTML = '<option value="">Pilih kontrak...</option>' +
      contracts.map(c => {
        const title = c.projects?.title || c.project_title || c.title || `Kontrak ${c.id}`;
        return `<option value="${escAttr(c.id)}">${esc(title)}</option>`;
      }).join('');
  } catch (error) {
    sel.innerHTML = '<option value="">Gagal memuat kontrak</option>';
    showToast(error.message || 'Gagal memuat kontrak', 'error');
  }
}

let _submitDisputeInFlight = false;
async function submitNewDispute() {
  if (_submitDisputeInFlight) return;
  const contractId   = document.getElementById('dispute-contract')?.value;
  const reason       = document.getElementById('dispute-reason')?.value.trim();
  const evidenceFile = document.getElementById('dispute-evidence-input')?.files?.[0] || null;

  if (!contractId) { showToast('Pilih kontrak yang ingin disengketakan', 'error'); return; }
  if (!reason || reason.length < 20) {
    showToast('Jelaskan alasan sengketa minimal 20 karakter', 'error');
    return;
  }

  const btn = document.getElementById('dispute-submit-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  _submitDisputeInFlight = true;

  try {
    let evidenceUrl = null;
    if (evidenceFile) {
      try {
        const up = await UploadAPI.uploadFile(evidenceFile, 'evidence');
        evidenceUrl = up?.data?.url || null;
      } catch (uploadErr) {
        console.warn('[dispute evidence upload]', uploadErr.message);
      }
    }

    await DisputesAPI.create({ contract_id: contractId, reason, evidence_url: evidenceUrl });
    showToast('Sengketa berhasil diajukan. Admin akan menengahi dalam 1×24 jam ✅', 'success');
    setTimeout(() => goTo('screen-dispute-list'), 900);
  } catch (error) {
    showToast(error.message || 'Gagal mengajukan sengketa', 'error');
  } finally {
    _submitDisputeInFlight = false;
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

function onDisputeEvidenceChange(event) {
  const file  = event?.target?.files?.[0];
  const label = document.getElementById('dispute-evidence-label');
  if (label) label.textContent = file ? `📎 ${file.name}` : '📎 Tap untuk pilih file bukti';
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.renderDisputeList       = renderDisputeList;
window.openNewDispute          = openNewDispute;
window.submitNewDispute        = submitNewDispute;
window.onDisputeEvidenceChange = onDisputeEvidenceChange;
