/**
 * StairsLife — features/admin/projects.js
 * renderAdminRecentProjects, renderAdminProjectManagement, adminSetProjectStatus.
 * ADDED: klik row → lihat detail kontrak + history deliverable
 */
'use strict';

const adminProjectView = { status: 'all', sort: 'newest', q: '' };

function adminSetProjectStatus(status, btn) {
  adminProjectView.status = status;
  document.querySelectorAll('#admin-project-status-chips .filter-chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  renderAdminProjectManagement();
}

function adminToggleProjectSort() {
  adminProjectView.sort = adminProjectView.sort === 'newest' ? 'oldest' : 'newest';
  const btn = document.getElementById('admin-project-sort-btn');
  if (btn) btn.textContent = adminProjectView.sort === 'newest' ? 'Newest' : 'Oldest';
  renderAdminProjectManagement();
}

function adminFilterProjects() {
  adminProjectView.q = document.getElementById('admin-project-search')?.value || '';
  renderAdminProjectManagement();
}

function fmtRpAdmin(n) {
  if (!n || n === 0) return 'Rp 0';
  return `Rp ${n.toLocaleString('id-ID')}`;
}

async function renderAdminRecentProjects() {
  const el = document.getElementById('admin-project-list');
  if (!el) return;

  try {
    const res      = await AdminAPI.getProjects();
    const projects = (res.data || []).slice(0, 8);

    if (!projects.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-title">Belum ada project</div></div>`;
      return;
    }

    el.innerHTML = `<div class="card" style="overflow:hidden">
      <div class="admin-project-row" style="font-weight:700;font-size:12px;color:var(--text-muted);background:var(--bg-secondary);text-transform:uppercase;letter-spacing:.05em">
        <div>Project</div><div>Pemilik Bisnis</div><div>Status</div><div style="text-align:right">Budget</div>
      </div>
      ${projects.map(p => `
      <div class="admin-project-row" style="cursor:pointer" onclick="adminOpenProjectDetail('${p.id}')">
        <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.title}</div>
        <div style="font-size:13px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.users?.full_name || '-'}</div>
        <div>${statusBadge(p.status === 'inProgress' ? 'aktif' : p.status === 'completed' ? 'selesai' : 'open')}</div>
        <div style="font-size:13px;font-weight:600;color:var(--accent);text-align:right">${fmtRange(p.budget_min || 0, p.budget_max || 0)}</div>
      </div>`).join('')}
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat project</div></div>`;
  }
}

async function renderAdminProjectManagement() {
  const el = document.getElementById('admin-projects-table');
  if (!el) return;

  el.innerHTML = skeletons.adminProjectRows ? skeletons.adminProjectRows(6) :
    `<div style="text-align:center;padding:20px;color:var(--text-muted)">Memuat...</div>`;

  try {
    const status   = adminProjectView.status !== 'all' ? adminProjectView.status : undefined;
    const res      = await AdminAPI.getProjects(status);
    let   projects = res.data || [];

    const q = (adminProjectView.q || '').toLowerCase().trim();
    if (q) {
      projects = projects.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.users?.full_name || '').toLowerCase().includes(q),
      );
    }

    if (!projects.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-title">Tidak ada project</div></div>`;
      return;
    }

    el.innerHTML = `<div class="card" style="overflow:hidden">
      <div class="admin-project-row" style="font-weight:700;font-size:12px;color:var(--text-muted);background:var(--bg-secondary);text-transform:uppercase;letter-spacing:.05em">
        <div>Project</div><div>Pemilik Bisnis</div><div>Status</div><div style="text-align:right">Budget</div>
      </div>
      ${projects.map(p => `
      <div class="admin-project-row" style="cursor:pointer"
        onclick="adminOpenProjectDetail('${p.id}')"
        onmouseover="this.style.background='var(--bg-surface)'"
        onmouseout="this.style.background=''">
        <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.title}</div>
        <div style="font-size:13px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.users?.full_name || '-'}</div>
        <div>${statusBadge(p.status === 'inProgress' ? 'aktif' : p.status === 'completed' ? 'selesai' : 'open')}</div>
        <div style="font-size:13px;font-weight:700;color:var(--accent);text-align:right">${fmtRange(p.budget_min || 0, p.budget_max || 0)}</div>
      </div>`).join('')}
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat project</div></div>`;
  }
}

async function adminOpenProjectDetail(projectId) {
  const drawer    = document.getElementById('admin-project-drawer');
  const detailEl  = document.getElementById('admin-project-detail');
  if (!drawer || !detailEl) return;

  detailEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">Memuat detail...</div>`;
  drawer.classList.add('open');

  try {
    // Fetch project detail
    const res     = await AdminAPI.getProjects();
    const project = (res.data || []).find(p => p.id === projectId);
    if (!project) throw new Error('Project tidak ditemukan');

    // Fetch kontrak terkait project ini
    let contracts = [];
    try {
      const cRes = await apiFetch(`/admin/projects/${projectId}/contracts`);
      contracts  = cRes.data || [];
    } catch (_) {
      // Endpoint mungkin belum ada, skip
    }

    const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

    detailEl.innerHTML = `
      <h2 style="font-size:18px;font-weight:800;margin-bottom:4px">${project.title}</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${statusBadge(project.status === 'inProgress' ? 'aktif' : project.status === 'completed' ? 'selesai' : 'open')}
        ${tierBadge(project.tier || 'pemula')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div class="card card-p-md">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">Pemilik Bisnis</div>
          <div style="font-weight:600">${project.users?.full_name || '-'}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${project.users?.email || ''}</div>
        </div>
        <div class="card card-p-md">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">Budget</div>
          <div style="font-weight:600;color:var(--accent)">${fmtRange(project.budget_min || 0, project.budget_max || 0)}</div>
          <div style="font-size:12px;color:var(--text-secondary)">Deadline: ${fmtDate(project.deadline)}</div>
        </div>
      </div>

      <div class="card card-p-md" style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;margin-bottom:6px">Deskripsi</div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.6">${project.description || '-'}</div>
      </div>

      ${contracts.length ? `
      <div class="section-hdr"><span class="section-hdr-title">Kontrak & History Deliverable</span></div>
      ${contracts.map(c => _buildContractDelivSection(c, fmtDate)).join('')}
      ` : `
      <div class="section-hdr"><span class="section-hdr-title">Kontrak & History Deliverable</span></div>
      <div class="empty-state" style="padding:20px 0">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">Belum ada kontrak untuk project ini</div>
      </div>`}
    `;
  } catch (e) {
    detailEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">${e.message}</div></div>`;
  }
}

function _buildContractDelivSection(c, fmtDate) {
  const student  = c.users_contracts_student_idTousers  || {};
  const delivs   = c.contract_deliverables || [];

  return `
    <div class="card card-p-md" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:13px;font-weight:700">Mahasiswa: ${student.full_name || '-'}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${student.email || ''}</div>
        </div>
        <div style="text-align:right">
          ${statusBadge(c.status)}
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Budget: ${fmtRpAdmin(c.agreed_budget)}</div>
        </div>
      </div>

      <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">
        History Deliverable (${delivs.length})
      </div>

      ${!delivs.length ? `
        <div style="font-size:13px;color:var(--text-muted);padding:8px 0">Belum ada deliverable diupload</div>
      ` : delivs.map((d, i) => `
        <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:10px;margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:6px">
            <span style="font-size:12px;font-weight:600;color:var(--text-secondary)">Deliverable #${i + 1}</span>
            ${statusBadge(d.status || 'pending')}
          </div>
          ${d.deliverable_notes ? `
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;line-height:1.5">${d.deliverable_notes}</div>
          ` : ''}
          ${d.deliverable_url ? `
            <div style="margin-bottom:6px">
              ${d.deliverable_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                ? `<img src="${d.deliverable_url}" alt="Deliverable" style="max-width:100%;border-radius:var(--radius-sm);cursor:pointer" onclick="window.open('${d.deliverable_url}','_blank')">`
                : `<a href="${d.deliverable_url}" target="_blank" class="btn btn-ghost btn-sm">📎 Lihat File Deliverable</a>`
              }
            </div>
          ` : ''}
          ${d.rejection_reason ? `
            <div style="font-size:12px;color:var(--rose);background:var(--rose-light);padding:6px 8px;border-radius:var(--radius-sm)">
              ❌ Alasan ditolak: ${d.rejection_reason}
            </div>
          ` : ''}
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
            Submit: ${fmtDate(d.submitted_at)}
            ${d.reviewed_at ? ` · Review: ${fmtDate(d.reviewed_at)}` : ''}
          </div>
        </div>
      `).join('')}
    </div>`;
}

function closeAdminProjectDrawer(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('admin-project-drawer')?.classList.remove('open');
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.adminProjectView             = adminProjectView;
window.adminSetProjectStatus        = adminSetProjectStatus;
window.adminToggleProjectSort       = adminToggleProjectSort;
window.adminFilterProjects          = adminFilterProjects;
window.renderAdminRecentProjects    = renderAdminRecentProjects;
window.renderAdminProjectManagement = renderAdminProjectManagement;
window.adminOpenProjectDetail       = adminOpenProjectDetail;
window.closeAdminProjectDrawer      = closeAdminProjectDrawer;