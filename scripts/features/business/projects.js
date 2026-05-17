/**
 * StairsLife — features/business/projects.js
 * renderMyProjectsAPI, handlePostProject, saveProjectEdit,
 * acceptApplicationFromProject, renderIncomingApps,
 * renderBizRecentAppsAPI, renderBizRecentProjectsFromAPI.
 * Phase 3 — Modularisasi.
 */
'use strict';

/* ================================================================
   POST PROJECT
   ================================================================ */
function openPostProject() { goTo('screen-post-project'); }

async function handlePostProject() {
  const title        = document.getElementById('pp-title')?.value.trim();
  const desc         = document.getElementById('pp-desc')?.value.trim();
  const bMin         = parseInt(document.getElementById('pp-budget-min')?.value);
  const bMax         = parseInt(document.getElementById('pp-budget-max')?.value);
  const deadline     = document.getElementById('pp-deadline')?.value;
  const cat          = document.getElementById('pp-category')?.value;
  const tier         = document.getElementById('pp-tier')?.value;
  const skillsRaw    = document.getElementById('pp-skills')?.value || '';
  const deliverables = document.getElementById('pp-deliverables')?.value || '';

  if (!title)    { showToast('Judul project wajib diisi', 'error'); return; }
  if (!desc)     { showToast('Deskripsi project wajib diisi', 'error'); return; }
  if (!bMin || !bMax) { showToast('Budget wajib diisi', 'error'); return; }
  if (!deadline) { showToast('Deadline wajib diisi', 'error'); return; }
  if (!cat)      { showToast('Pilih kategori project', 'error'); return; }
  if (!tier)     { showToast('Pilih tier skill', 'error'); return; }

  const skills = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);

  try {
    await ProjectsAPI.create({ title, description: desc, budget_min: bMin, budget_max: bMax, deadline, category: cat, tier, skills, deliverables });
    showToast('Project berhasil dipasang! 🚀', 'success');
    setTimeout(() => goTo('screen-business'), 800);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/* ================================================================
   MY PROJECTS (biz tab-1)
   ================================================================ */
async function renderMyProjectsAPI() {
  const el = document.getElementById('my-projects-list');
  if (!el) return;

  el.innerHTML = skeletons.applicationCards(3);

  try {
    const res      = await ProjectsAPI.getMyProjects();
    let   projects = res.data || [];

    // Deduplikasi berdasarkan ID
    const seen = new Set();
    projects = projects.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

    if (!projects.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Belum ada project</div><p class="empty-state-desc">Mulai pasang project pertama kamu!</p><button class="btn btn-primary" onclick="openPostProject()" style="margin-top:12px">Pasang Project</button></div>`;
      return;
    }

    el.innerHTML = projects.map(p => `
  <div class="my-proj-card" style="cursor:pointer" onclick="toggleProjectApplicants('${p.id}', this)">
    <div class="my-proj-header">
      <div class="my-proj-title">${p.title}</div>
      ${p.status === 'completed'
        ? `<span class="badge badge-teal">✅ Selesai</span>`
        : p.status === 'inProgress'
        ? `<span class="badge badge-accent">🔵 Aktif</span>`
        : `<span class="badge" style="background:var(--teal-light);color:var(--teal-dark)">🟢 Open</span>`
      }
    </div>
    <div class="my-proj-meta">${p.category}</div>
    <div class="my-proj-footer">
      <span style="font-size:14px;font-weight:700;color:var(--accent)">
        Rp ${((p.budget_min || 0) / 1000).toFixed(0)}K – ${((p.budget_max || 0) / 1000).toFixed(0)}K
      </span>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="applicant-count">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          ${p.applicant_count || 0} pelamar
        </div>
        <span style="font-size:12px;color:var(--text-muted)">
          ${Math.ceil((new Date(p.deadline) - new Date()) / 86400000)} hari lagi
        </span>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap" onclick="event.stopPropagation()">
      ${(p.status === 'open' || p.status === 'inProgress') ? `
      <button class="btn btn-ghost btn-sm" style="flex:1"
        onclick="showEditProjectModal('${p.id}', ${p.budget_min}, ${p.budget_max}, '${(p.deadline || '').split('T')[0]}')">
        ✏️ Edit Budget & Deadline
      </button>` : ''}
      ${p.status === 'inProgress' ? `
      <button class="btn btn-primary btn-sm" style="flex:1"
        onclick="openBizContract('${p.id}')">
        📄 Lihat Kontrak
      </button>` : ''}
      ${p.status === 'completed' ? `
      <button class="btn btn-primary btn-sm" style="flex:1"
        onclick="openBizContract('${p.id}')">
        📄 Lihat Kontrak & Riwayat
      </button>` : ''}
      ${p.status === 'open' ? `
      <button class="btn btn-danger btn-sm" style="padding:0 14px"
        onclick="deleteProject('${p.id}', '${p.title.replace(/'/g, "\\'")}', this)">
        🗑️ Hapus
      </button>` : ''}
    </div>
    <div class="project-applicants-drawer" id="drawer-${p.id}" style="display:none;margin-top:16px;border-top:1px solid var(--divider);padding-top:14px">
      <div style="font-size:13px;font-weight:700;color:var(--text-secondary);margin-bottom:10px">Pelamar Project</div>
      <div class="applicants-list-${p.id}"><div style="text-align:center;color:var(--text-muted);font-size:13px">Memuat...</div></div>
    </div>
  </div>`).join('');
  } catch (error) {
    showToast('Gagal memuat project: ' + error.message, 'error');
  }
}

async function toggleProjectApplicants(projectId, card) {
  const drawer = document.getElementById(`drawer-${projectId}`);
  if (!drawer) return;
  if (drawer.style.display !== 'none') { drawer.style.display = 'none'; return; }
  drawer.style.display = 'block';

  try {
    const res    = await ApplicationsAPI.getProjectApplications(projectId);
    const apps   = res.data || [];
    const listEl = drawer.querySelector(`.applicants-list-${projectId}`);

    if (!apps.length) {
      listEl.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:10px">Belum ada pelamar</div>`;
      return;
    }

    listEl.innerHTML = apps.map(a => {
      const student = a.users || {};
      const name    = student.full_name || 'Mahasiswa';

      let actionButtons = '';
      if (a.status === 'pending') {
        actionButtons = `
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openDirectChatWith('${name}','mahasiswa','${projectId}')">💬 Chat</button>
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();acceptApplicationFromProject('${a.id}','${a.offered_budget || 0}','${a.estimated_completion}',this)">✅ Terima</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();rejectApplication('${a.id}',this)">❌ Tolak</button>
        `;
      } else if (a.status === 'approved') {
        actionButtons = `
          <span class="badge badge-teal">✅ Diterima</span>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openDirectChatWith('${name}','mahasiswa','${projectId}')">💬 Chat</button>
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openBizContract('${a.id}')">📄 Lihat Kontrak</button>
        `;
      } else if (a.status === 'rejected') {
        actionButtons = `<span class="badge badge-rose">❌ Ditolak</span>`;
      } else {
        actionButtons = statusBadge(a.status);
      }

      return `
      <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:8px">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:var(--accent);flex-shrink:0">${name.charAt(0)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700">${name}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">${student.university || '-'} · ${tierBadge(student.tier || 'pemula')}</div>
          <div style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin-bottom:8px">"${a.cover_letter}"</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">
            Estimasi: ${new Date(a.estimated_completion).toLocaleDateString('id-ID')}
            ${a.offered_budget ? ` · Budget: Rp ${a.offered_budget.toLocaleString('id-ID')}` : ''}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">${actionButtons}</div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    const listEl = drawer.querySelector(`.applicants-list-${projectId}`);
    if (listEl) listEl.innerHTML = `<div style="color:var(--rose);font-size:13px;padding:10px">Gagal memuat pelamar</div>`;
  }
}

async function openBizContract(applicationId) {
  try {
    // Cari kontrak berdasarkan application
    const res       = await ContractsAPI.getMyContracts();
    const contracts = res.data || [];
    const contract  = contracts.find(c => c.application_id === applicationId);

    if (contract) {
      window._currentContract  = contract;
      window.currentContractId = contract.id;
      goTo('screen-contract-detail');
      await loadContractDetail(contract.id);
    } else {
      showToast('Kontrak belum dibuat. Buat kontrak dulu setelah accept lamaran.', 'info');
    }
  } catch (e) {
    showToast('Gagal membuka kontrak: ' + e.message, 'error');
  }
}

async function acceptApplicationFromProject(applicationId, offeredBudget, estimatedCompletion, btn) {
  try {
    btn.disabled    = true;
    btn.textContent = '⏳';

    // BUG FIX: tampilkan escrow modal DULU, baru approve application setelah
    // kontrak & escrow berhasil dibuat (di dalam submitEscrowAndContract)
    let application = null;
    try {
      const res = await ApplicationsAPI.getById(applicationId);
      application = res.data || null;
    } catch (fetchErr) {
      console.warn('[acceptApplicationFromProject] getById fallback:', fetchErr.message);
    }

    if (!application) {
      application = {
        id: applicationId,
        offered_budget: parseInt(offeredBudget) || null,
        estimated_completion: estimatedCompletion,
        users: { full_name: 'Mahasiswa' },
      };
    }

    const projectTitle = application.projects?.title || application.project?.title || 'Project';

    // Simpan applicationId agar submitEscrowAndContract bisa approve setelah kontrak jadi
    window._pendingApplicationId = applicationId;
    showEscrowModal(applicationId, application, projectTitle);

    btn.disabled    = false;
    btn.textContent = '✅ Terima';
    await renderMyProjectsAPI();
  } catch (error) {
    showToast(error.message, 'error');
    btn.disabled    = false;
    btn.textContent = '✅ Terima';
  }
}

function showEditProjectModal(projectId, budgetMin, budgetMax, deadline) {
  const existing = document.getElementById('edit-project-modal');
  if (existing) existing.remove();

  const modal        = document.createElement('div');
  modal.id           = 'edit-project-modal';
  modal.className    = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML    = `
    <div class="modal-sheet" style="max-width:480px" role="dialog">
      <div class="modal-drag-bar"></div>
      <h2 style="font-size:18px;font-weight:800;margin-bottom:6px">Edit Project</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">Hanya bisa diubah selama belum ada lamaran yang diterima.</p>
      <div style="display:grid;gap:14px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">Budget Min (Rp)</label>
            <input class="form-input" id="edit-budget-min" type="number" value="${budgetMin}">
          </div>
          <div class="form-group">
            <label class="form-label">Budget Max (Rp)</label>
            <input class="form-input" id="edit-budget-max" type="number" value="${budgetMax}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Deadline</label>
          <input class="form-input" id="edit-deadline" type="date" value="${deadline}" min="${new Date().toISOString().split('T')[0]}">
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('edit-project-modal').remove()">Batal</button>
        <button class="btn btn-primary" style="flex:2;height:48px" onclick="saveProjectEdit('${projectId}')">Simpan Perubahan</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

async function deleteProject(projectId, projectTitle, btn) {
  // Konfirmasi dengan modal kecil — tidak pakai native confirm()
  const existing = document.getElementById('delete-project-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'delete-project-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:400px" role="dialog">
      <div class="modal-drag-bar"></div>
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:40px;margin-bottom:8px">🗑️</div>
        <h2 style="font-size:17px;font-weight:800;margin-bottom:6px">Hapus Project?</h2>
        <p style="font-size:13px;color:var(--text-secondary)">"${projectTitle}"<br>Project yang sudah dihapus tidak bisa dikembalikan.</p>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('delete-project-modal').remove()">Batal</button>
        <button class="btn btn-danger" style="flex:1;height:44px" id="delete-project-confirm-btn"
          onclick="_confirmDeleteProject('${projectId}')">Hapus</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function _confirmDeleteProject(projectId) {
  const btn = document.getElementById('delete-project-confirm-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  try {
    await ProjectsAPI.delete(projectId);
    document.getElementById('delete-project-modal')?.remove();
    document.body.style.overflow = '';
    showToast('Project berhasil dihapus', 'success');
    await renderMyProjectsAPI();
    await onEnterBusiness();
  } catch (e) {
    showToast(e.message || 'Gagal menghapus project', 'error');
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

async function saveProjectEdit(projectId) {
  const budgetMin = parseInt(document.getElementById('edit-budget-min')?.value || '0');
  const budgetMax = parseInt(document.getElementById('edit-budget-max')?.value || '0');
  const deadline  = document.getElementById('edit-deadline')?.value;

  if (!budgetMin || !budgetMax || budgetMin > budgetMax) { showToast('Budget tidak valid', 'error'); return; }
  if (!deadline) { showToast('Deadline wajib diisi', 'error'); return; }

  try {
    await ProjectsAPI.update(projectId, { budget_min: budgetMin, budget_max: budgetMax, deadline });
    document.getElementById('edit-project-modal')?.remove();
    document.body.style.overflow = '';
    showToast('Project berhasil diperbarui ✅', 'success');
    await renderMyProjectsAPI();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/* ================================================================
   INCOMING APPS (biz tab-2)
   ================================================================ */
async function renderIncomingApps() {
  const el = document.getElementById('incoming-apps-list');
  if (!el) return;

  el.innerHTML = skeletons.applicationCards(3);

  try {
    const projectsRes  = await ProjectsAPI.getMyProjects();
    const projects     = projectsRes.data || [];

    if (!projects.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📥</div><div class="empty-state-title">Belum ada lamaran</div></div>`;
      return;
    }

    const openProject  = projects.find(p => p.status === 'open') || projects[0];
    const appsRes      = await ApplicationsAPI.getProjectApplications(openProject.id);
    const applications = appsRes.data || [];

    if (!applications.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📥</div><div class="empty-state-title">Belum ada lamaran masuk</div></div>`;
      return;
    }

    el.innerHTML = applications.map(a => {
      const student = a.users || {};
      return `
      <div class="incoming-card">
        <div class="applicant-row">
          <div class="applicant-avatar">${(student.full_name || 'M').charAt(0)}</div>
          <div style="flex:1">
            <div class="applicant-name">${student.full_name || 'Mahasiswa'}</div>
            <div class="applicant-uni">${tierBadge(student.tier || 'pemula')}</div>
          </div>
          ${statusBadge(a.status)}
        </div>
        <div class="cover-letter-text">"${a.cover_letter}"</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">
          Estimasi selesai: ${new Date(a.estimated_completion).toLocaleDateString('id-ID')}
          ${a.offered_budget ? ` · Budget tawaran: Rp ${a.offered_budget.toLocaleString('id-ID')}` : ''}
        </div>
        ${a.status === 'pending' ? `
        <div class="applicant-actions">
          <button class="btn btn-sm btn-primary" onclick="acceptApplication('${a.id}', this)">✅ Terima</button>
          <button class="btn btn-sm btn-danger" onclick="rejectApplication('${a.id}', this)">❌ Tolak</button>
        </div>` : ''}
      </div>`;
    }).join('');
  } catch (error) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat lamaran</div></div>`;
  }
}

async function acceptApplication(id, btn) {
  try {
    btn.disabled    = true;
    btn.textContent = '⏳';
    const projectsRes = await ProjectsAPI.getMyProjects();
    const projects    = projectsRes.data || [];
    let   application = null;
    let   projectTitle = '';

    for (const p of projects) {
      try {
        const appsRes = await ApplicationsAPI.getProjectApplications(p.id);
        const found   = (appsRes.data || []).find(a => a.id === id);
        if (found) { application = found; projectTitle = p.title; break; }
      } catch (e) {}
    }

    await ApplicationsAPI.updateStatus(id, 'approved');
    showEscrowModal(id, application, projectTitle);
    await renderIncomingApps();
  } catch (error) {
    showToast(error.message, 'error');
    btn.disabled    = false;
    btn.textContent = '✅ Terima';
  }
}

async function rejectApplication(id, btn) {
  try {
    btn.disabled    = true;
    btn.textContent = '⏳';
    await ApplicationsAPI.updateStatus(id, 'rejected');
    showToast('Lamaran ditolak', 'info');
    await renderIncomingApps();
  } catch (error) {
    showToast(error.message, 'error');
    btn.disabled    = false;
    btn.textContent = '❌ Tolak';
  }
}

/* ================================================================
   RECENT (dashboard overview)
   ================================================================ */
async function renderBizRecentAppsAPI() {
  const el = document.getElementById('biz-recent-apps');
  if (!el) return;

  try {
    const projectsRes      = await ProjectsAPI.getMyProjects();
    const projects         = projectsRes.data || [];
    if (!projects.length) { el.innerHTML = ''; return; }

    const projectWithApps = projects.find(p => (p.applicant_count || 0) > 0);
    if (!projectWithApps) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📥</div><div class="empty-state-title">Belum ada lamaran</div></div>`;
      return;
    }

    const appsRes = await ApplicationsAPI.getProjectApplications(projectWithApps.id);
    const apps    = (appsRes.data || []).slice(0, 3);

    el.innerHTML = apps.map(a => {
      const student     = a.users || {};
      const studentName = student.full_name || 'Mahasiswa';
      return `
      <div class="incoming-card" style="cursor:pointer" onclick="switchBizTab(2)">
        <div class="applicant-row">
          <div class="applicant-avatar">${studentName.charAt(0)}</div>
          <div style="flex:1">
            <div class="applicant-name">${studentName}</div>
            <div class="applicant-uni">${student.university || '-'} · ${tierBadge(student.tier || 'pemula')}</div>
          </div>
          ${statusBadge(a.status)}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px">Project: ${projectWithApps.title}</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openDirectChatWith('${studentName}','mahasiswa','Project: ${projectWithApps.title}')">💬 Chat</button>
          ${a.status === 'pending' ? `
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();acceptApplication('${a.id}', this)">✅ Terima</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();rejectApplication('${a.id}', this)">❌ Tolak</button>
          ` : ''}
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    console.error('Gagal load recent apps:', e);
  }
}

function renderBizRecentProjectsFromAPI(projects) {
  const el = document.getElementById('biz-recent-projects');
  if (!el) return;
  el.innerHTML = projects.slice(0, 3).map(p => `
    <div class="my-proj-card" style="cursor:pointer" onclick="switchBizTab(1)">
      <div class="my-proj-header">
        <div class="my-proj-title">${p.title}</div>
        ${statusBadge(p.status === 'inProgress' ? 'aktif' : p.status === 'completed' ? 'selesai' : 'open')}
      </div>
      <div class="my-proj-meta">${p.category}</div>
      <div class="my-proj-footer">
        <span style="font-size:14px;font-weight:700;color:var(--accent)">
          Rp ${((p.budget_min || 0) / 1000).toFixed(0)}K – ${((p.budget_max || 0) / 1000).toFixed(0)}K
        </span>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="applicant-count">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            ${p.applicant_count || 0} pelamar
          </div>
          <span style="font-size:12px;color:var(--text-muted)">${Math.ceil((new Date(p.deadline) - new Date()) / 86400000)} hari lagi</span>
        </div>
      </div>
    </div>`).join('');
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.openPostProject               = openPostProject;
window.handlePostProject             = handlePostProject;
window.renderMyProjectsAPI           = renderMyProjectsAPI;
window.toggleProjectApplicants       = toggleProjectApplicants;
window.acceptApplicationFromProject  = acceptApplicationFromProject;
window.showEditProjectModal          = showEditProjectModal;
window.saveProjectEdit               = saveProjectEdit;
window.deleteProject                 = deleteProject;
window._confirmDeleteProject         = _confirmDeleteProject;
window.renderIncomingApps            = renderIncomingApps;
window.acceptApplication             = acceptApplication;
window.rejectApplication             = rejectApplication;
window.renderBizRecentAppsAPI        = renderBizRecentAppsAPI;
window.renderBizRecentProjectsFromAPI = renderBizRecentProjectsFromAPI;
window.openBizContract                = openBizContract;
