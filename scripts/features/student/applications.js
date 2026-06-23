/**
 * StairsLife — features/student/applications.js
 * FIXED: Lihat Kontrak button now sets currentContractId before navigating
 */
'use strict';

async function renderApplications() {
  const list = document.getElementById('application-list');
  if (!list) return;

  list.innerHTML = skeletons.applicationCards(3);

  try {
    const res          = await ApplicationsAPI.getMyApplications();
    const applications = res.data || [];

    const f        = state.appFilter;
    const filtered = f === 'semua' ? applications : applications.filter(a => a.status === f);

    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📤</div><div class="empty-state-title">Tidak ada lamaran ditemukan</div><p class="empty-state-desc">Coba filter lain atau lamar project baru!</p><button class="btn btn-primary" onclick="switchStudentTab(1)" style="margin-top:12px">Cari Project</button></div>`;
      return;
    }

    list.innerHTML = filtered.map(a => {
      const project      = a.projects || {};
      const biz          = project.users || {};
      const bizName      = biz.full_name || 'Pemilik Bisnis';
      const bizUserId    = biz.id || null;
      const projectTitle = project.title || 'Project';
      const projId       = project.id || a.project_id || '';
      // Contract ID: applications.contracts[] adalah relation array (one-to-many).
      // Ambil yang pertama. Sebelumnya kode coba a.contract_id (tidak ada) atau
      // a.contracts?.id (object access pada array → undefined).
      const contractId = Array.isArray(a.contracts) && a.contracts.length
        ? a.contracts[0].id
        : (a.contract_id || a.contracts?.id || null);

      return `
      <div class="application-card">
        <div class="application-icon">
          <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
        </div>
        <div style="flex:1">
          <div class="application-title">${projectTitle}</div>
          <div class="application-meta">${bizName} · Dilamar ${timeAgo(a.created_at)}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">
            ${statusBadge(a.status)}
            ${a.status !== 'rejected' ? `
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openDirectChatWith('${bizName}','bisnis','Project: ${projectTitle}','${bizUserId || ''}')">
                💬 Chat Bisnis
              </button>
            ` : ''}
            ${a.status === 'approved' && contractId ? `
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();openMyContract('${contractId}')">
                📄 Lihat Kontrak
              </button>
            ` : a.status === 'approved' ? `
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();loadAndOpenContract()">
                📄 Lihat Kontrak
              </button>
            ` : ''}
            ${(a.status === 'pending' || a.status === 'shortlisted') ? `
              <button class="btn btn-ghost btn-sm" style="color:var(--rose)" onclick="event.stopPropagation();withdrawApplication('${escAttr(a.id)}','${escAttr(projectTitle)}','${escAttr(projId)}')">
                ✕ Batalkan
              </button>
            ` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (error) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat lamaran</div><p class="empty-state-desc">${esc(error.message)}</p></div>`;
  }
}

// Buka kontrak berdasarkan ID yang sudah diketahui
function openMyContract(contractId) {
  window.currentContractId = contractId;
  window._currentContract  = null; // paksa reload dari API
  goTo('screen-contract-detail');
}

// Fallback: ambil kontrak aktif dari API lalu buka
async function loadAndOpenContract() {
  try {
    const res       = await ContractsAPI.getMyContracts();
    const contracts = res.data || [];
    const active    = contracts.find(c => c.status === 'active' || c.status === 'pending_review' || c.status === 'inProgress');
    if (active) {
      window.currentContractId = active.id;
      window._currentContract  = active;
      goTo('screen-contract-detail');
    } else {
      showToast('Kontrak belum ditemukan. Tunggu konfirmasi dari bisnis.', 'info');
    }
  } catch (e) {
    showToast('Gagal memuat kontrak: ' + e.message, 'error');
  }
}

function setAppFilter(f, btn) {
  state.appFilter = f;
  document.querySelectorAll('#st-tab-2 .filter-chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  renderApplications();
}

// Batalkan lamaran (hanya pending/shortlisted). Konfirmasi dulu via modal.
function withdrawApplication(id, title, projectId) {
  if (typeof showConfirmModal !== 'function') return;
  showConfirmModal({
    title: 'Batalkan Lamaran',
    message: `Batalkan lamaran untuk "${title}"? Kamu bisa melamar lagi nanti.`,
    confirmText: 'Ya, Batalkan',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await ApplicationsAPI.withdraw(id);
        // Bersihkan state supaya tombol "Lamar" muncul lagi di project tsb.
        if (projectId && state?.appliedProjects?.delete) state.appliedProjects.delete(projectId);
        showToast('Lamaran dibatalkan ✅', 'success');
        await renderApplications();
      } catch (e) {
        showToast(e.message || 'Gagal membatalkan lamaran', 'error');
      }
    },
  });
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.renderApplications  = renderApplications;
window.setAppFilter        = setAppFilter;
window.openMyContract      = openMyContract;
window.loadAndOpenContract = loadAndOpenContract;
window.withdrawApplication = withdrawApplication;
