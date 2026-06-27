/**
 * StairsLife — features/student/projects.js
 * FIXED: filter aktif/selesai, history project selesai dengan Lihat Kontrak
 */
'use strict';

// State filter project
if (!window._projectFilter) window._projectFilter = 'active';

async function loadProjectsFromAPI(filters = {}) {
  const homeGrid   = document.getElementById('home-project-grid');
  const browseGrid = document.getElementById('browse-project-grid');
  if (homeGrid)   homeGrid.innerHTML   = skeletons.projectCards(4);
  if (browseGrid) browseGrid.innerHTML = skeletons.projectCards(6);

  try {
    // Selalu fetch terbaru — bukan hanya kalau cache kosong. Bug sebelumnya:
    // kalau cache sudah ada, project yang baru dilamar masih tampil tombol "Lamar"
    // sampai reload.
    try {
      const appsRes = await ApplicationsAPI.getMyApplications();
      const apps    = appsRes.data || [];
      state.appliedProjects.clear();
      apps.forEach(a => { if (a.project_id) state.appliedProjects.add(a.project_id); });
    } catch (_) {}

    const res      = await ProjectsAPI.getAll(filters);
    const projects = res.data || [];

    const normalized = projects.map(p => ({
      id: p.id, biz: p.users?.full_name || 'Bisnis',
      bizUserId: p.users?.id || null, bizVerified: p.users?.is_verified || false,
      title: p.title, desc: p.description, category: p.category,
      skills: p.skills || [], tier: p.tier,
      budgetMin: p.budget_min, budgetMax: p.budget_max,
      deadline: new Date(p.deadline), deliverables: p.deliverables || '',
      applicants: p.applicant_count || 0, apiId: p.id,
    }));

    const seen   = new Set();
    const unique = normalized.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

    const emptyHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🔍</div><div class="empty-state-title">Tidak ada project ditemukan</div><p class="empty-state-desc">Belum ada project tersedia saat ini. Coba ubah filter atau cek lagi nanti.</p></div>`;

    const homeGridEl = document.getElementById('home-project-grid');
    if (homeGridEl) homeGridEl.innerHTML = unique.length
      ? unique.slice(0, 4).map((p, i) => buildProjectCard(p, i)).join('')
      : emptyHTML;

    const browseGridEl = document.getElementById('browse-project-grid');
    if (browseGridEl) browseGridEl.innerHTML = unique.length
      ? unique.map((p, i) => buildProjectCard(p, i)).join('')
      : emptyHTML;

    const countEl = document.getElementById('browse-count-txt');
    if (countEl) countEl.textContent = `${unique.length} project tersedia untuk kamu`;

    window._cachedProjects = unique;
  } catch (error) {
    showToast('Gagal memuat project: ' + error.message, 'error');
    renderHomeProjects();
    renderBrowseProjects();
  }
}

function buildProjectCard(p, i = 0) {
  const delay   = Math.min(i, 4);
  const applied = state.appliedProjects.has(p.id);
  // SECURITY: p.title, p.biz, p.skills semua dari API → bisa berisi
  // konten dari user lain (bisnis). Wajib esc() pada setiap interpolasi
  // ke innerHTML. ID-nya pakai escAttr() karena masuk ke onclick="...('${id}')".
  return `
  <article class="project-card anim-up anim-up-${delay}" style="animation-delay:${delay * 0.08}s" tabindex="0">
    <div onclick="openProject('${escAttr(p.id)}')" onkeydown="if(event.key==='Enter')openProject('${escAttr(p.id)}')">
      <div class="pc-header">${tierBadge(p.tier)}<div class="applicant-count"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>${esc(p.applicants)}</div></div>
      <div class="pc-title">${esc(p.title)}</div>
      <div class="pc-company">
        <div class="pc-avatar">${esc(initials(p.biz))}</div>
        <span class="pc-biz-name">${esc(p.biz)}</span>
        ${p.bizVerified ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="#1FB97D"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>' : ''}
      </div>
      <div class="pc-skills">${p.skills.slice(0, 3).map(s => `<span class="skill-tag">${esc(s)}</span>`).join('')}${p.skills.length > 3 ? `<span class="skill-tag">+${p.skills.length - 3}</span>` : ''}</div>
      <div class="pc-footer">
        <span class="pc-budget">${esc(fmtRange(p.budgetMin, p.budgetMax))}</span>
        <span class="pc-deadline"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${esc(daysLeft(p.deadline))}</span>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      ${applied
        ? `<span class="badge badge-teal" style="flex:1;justify-content:center">✅ Lamaran Terkirim</span>`
        : `<button class="btn btn-primary btn-sm" style="flex:2" onclick="openProject('${escAttr(p.id)}')">Lihat Detail →</button>`
      }
      <button class="btn btn-ghost btn-sm" style="flex:1" onclick="event.stopPropagation();openProjectInquiry('${escAttr(p.id)}','${escAttr(p.biz)}','${escAttr(p.bizUserId || '')}','${escAttr(p.title)}')">
        💬 Tanya
      </button>
    </div>
  </article>`;
}

function renderHomeProjects() {
  const grid = document.getElementById('home-project-grid');
  if (!grid) return;
  const items = PROJECTS.filter(p => p.tier === 'pemula').slice(0, 4);
  grid.innerHTML = items.map((p, i) => buildProjectCard(p, i)).join('');
}

function renderBrowseProjects() {
  const grid = document.getElementById('browse-project-grid');
  if (!grid) return;
  const q = state.searchQuery.toLowerCase();
  const f = state.browseFilter;
  const CATEGORY_MAP = { desain: 'Desain Grafis', penulisan: 'Penulisan', teknologi: 'Pembuatan Website' };
  const filtered = PROJECTS.filter(p => {
    const tierMatch = f === 'semua' || p.tier === f;
    const catMatch  = !CATEGORY_MAP[f] || p.category === CATEGORY_MAP[f];
    const fMatch    = ['semua', 'pemula', 'menengah', 'mahir'].includes(f) ? tierMatch : catMatch;
    const qMatch    = !q || p.title.toLowerCase().includes(q) || p.biz.toLowerCase().includes(q) || p.skills.some(s => s.toLowerCase().includes(q));
    return fMatch && qMatch;
  });
  document.getElementById('browse-count-txt').textContent = `${filtered.length} project tersedia untuk kamu`;
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🔍</div><div class="empty-state-title">Tidak ada project ditemukan</div></div>`;
    return;
  }
  grid.innerHTML = filtered.map((p, i) => buildProjectCard(p, i)).join('');
}

function filterProjects() {
  state.searchQuery = document.getElementById('search-input')?.value || '';
  const projects    = window._cachedProjects || PROJECTS;
  const q           = state.searchQuery.toLowerCase();
  const f           = state.browseFilter;
  const CATEGORY_MAP = { desain: 'Desain Grafis', penulisan: 'Penulisan', teknologi: 'Pembuatan Website' };
  const filtered = projects.filter(p => {
    const tierMatch = f === 'semua' || p.tier === f;
    const catMatch  = !CATEGORY_MAP[f] || p.category === CATEGORY_MAP[f];
    const fMatch    = ['semua', 'pemula', 'menengah', 'mahir'].includes(f) ? tierMatch : catMatch;
    const qMatch    = !q || p.title.toLowerCase().includes(q) || (p.biz || '').toLowerCase().includes(q);
    return fMatch && qMatch;
  });
  const browseGrid = document.getElementById('browse-project-grid');
  if (browseGrid) {
    browseGrid.innerHTML = !filtered.length
      ? `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🔍</div><div class="empty-state-title">Tidak ada project ditemukan</div></div>`
      : filtered.map((p, i) => buildProjectCard(p, i)).join('');
  }
  const countEl = document.getElementById('browse-count-txt');
  if (countEl) countEl.textContent = `${filtered.length} project tersedia untuk kamu`;
}

function setFilter(f, btn) {
  state.browseFilter = f;
  document.querySelectorAll('#st-tab-1 .filter-chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  filterProjects();
}

/* ================================================================
   FILTER PROJECT AKTIF / SELESAI (TAB 3)
   ================================================================ */
function setProjectFilter(filter, btn) {
  window._projectFilter = filter;
  document.querySelectorAll('#st-tab-3 .filter-chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  renderActiveProjects();
}

async function renderActiveProjects() {
  const list = document.getElementById('active-project-list');
  if (!list) return;

  list.innerHTML = skeletons.activeProjectCards(2);

  try {
    const res       = await ContractsAPI.getMyContracts();
    const contracts = res.data || [];
    const filter    = window._projectFilter || 'active';

    const filtered = filter === 'completed'
      ? contracts.filter(c => c.status === 'completed')
      : contracts.filter(c => c.status === 'active' || c.status === 'pending_review');

    if (!filtered.length) {
      const emptyMsg  = filter === 'completed' ? 'Belum ada project selesai' : 'Belum ada project aktif';
      const emptyDesc = filter === 'completed'
        ? 'Project yang berhasil diselesaikan akan muncul di sini.'
        : 'Lamar project dan tunggu diterima untuk mulai bekerja.';
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">${emptyMsg}</div><p class="empty-state-desc">${emptyDesc}</p></div>`;
      return;
    }

    list.innerHTML = filtered.map(c => {
      const project      = c.projects || {};
      const biz          = c.users_contracts_business_idTousers || {};
      const deadlineDays = Math.ceil((new Date(c.deadline) - new Date()) / 86400000);
      const deadlineStr  = new Date(c.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const completedStr = c.completed_at
        ? new Date(c.completed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : deadlineStr;
      const progress     = c.progress_pct || 0;
      const isCompleted  = c.status === 'completed';

      // SECURITY: project.title dan biz.full_name dari user lain. esc()
      // wajib. ID kontrak dari server (UUID) — strictly tidak perlu, tapi
      // pakai escAttr untuk konsistensi dan defense-in-depth.
      const cid = escAttr(c.id);
      const titleSafe = esc(project.title || 'Project');
      const bizSafe   = esc(biz.full_name || 'Bisnis');
      const budgetSafe= esc((c.agreed_budget || 0).toLocaleString('id-ID'));

      if (isCompleted) {
        return `
        <div class="active-proj-card" style="cursor:pointer;border-left:3px solid var(--teal-dark)"
          onclick="window.currentContractId='${cid}';window._currentContract=null;goTo('screen-contract-detail');loadContractDetail('${cid}')">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:4px;gap:10px">
            <div class="active-proj-title">${titleSafe}</div>
            <span class="badge badge-teal">✅ Selesai</span>
          </div>
          <div class="active-proj-meta">${bizSafe} · Rp ${budgetSafe}</div>
          <div style="font-size:12px;color:var(--teal-dark);margin:6px 0 10px;display:flex;align-items:center;gap:6px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Selesai pada ${esc(completedStr)}
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary btn-sm" style="flex:1"
              onclick="event.stopPropagation();window.currentContractId='${cid}';window._currentContract=null;goTo('screen-contract-detail');loadContractDetail('${cid}')">
              📄 Lihat Detail & Riwayat
            </button>
          </div>
        </div>`;
      }

      return `
      <div class="active-proj-card" style="cursor:pointer"
        onclick="window.currentContractId='${cid}';window._currentContract=null;goTo('screen-contract-detail');loadContractDetail('${cid}')">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:4px;gap:10px">
          <div class="active-proj-title">${titleSafe}</div>
          ${statusBadge(c.status === 'pending_review' ? 'pending' : 'aktif')}
        </div>
        <div class="active-proj-meta">${bizSafe} · Rp ${budgetSafe}</div>
        <div class="progress-row">
          <span class="progress-row-label">Progress pengerjaan</span>
          <span class="progress-row-pct">${progress}%</span>
        </div>
        <div class="progress-bar-sm" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar-sm-fill" style="width:${progress}%"></div>
        </div>
        <div class="active-proj-footer">
          <div class="deadline-text${deadlineDays <= 7 ? ' urgent' : ''}">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Deadline: ${esc(deadlineStr)}
          </div>
          <button class="btn btn-primary btn-sm"
            onclick="event.stopPropagation();window.currentContractId='${cid}';goTo('screen-deliverable-upload')">
            Upload Hasil
          </button>
        </div>
      </div>`;
    }).join('');
  } catch (error) {
    // error.message juga di-esc supaya pesan dari throw new Error(`xyz`)
    // dengan konten user-controlled tidak jadi XSS.
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat project</div><p class="empty-state-desc">${esc(error.message)}</p></div>`;
  }
}

/* ================================================================
   OPEN PROJECT
   ================================================================ */
async function openProject(id) {
  const cachedProjects = window._cachedProjects || [];
  let p = cachedProjects.find(x => x.id === id) || PROJECTS.find(x => x.id === id);
  if (!p) {
    try {
      const res = await ProjectsAPI.getById(id);
      const api = res.data;
      p = {
        id: api.id, biz: api.users?.full_name || 'Bisnis',
        bizVerified: api.users?.is_verified || false,
        title: api.title, desc: api.description, category: api.category,
        skills: api.skills || [], tier: api.tier,
        budgetMin: api.budget_min, budgetMax: api.budget_max,
        deadline: new Date(api.deadline), deliverables: api.deliverables || '',
        applicants: api.applicant_count || 0, apiId: api.id,
      };
    } catch (error) { showToast('Project tidak ditemukan', 'error'); return; }
  }

  // Refresh status lamaran sebelum tampilkan detail — supaya tombol selalu akurat
  try {
    const appsRes = await ApplicationsAPI.getMyApplications();
    const apps    = appsRes.data || [];
    state.appliedProjects.clear();
    apps.forEach(a => { if (a.project_id) state.appliedProjects.add(a.project_id); });
  } catch (_) {}

  state.currentProjectId = id;
  state.prevScreen       = state.currentScreen;

  document.getElementById('pd-title').textContent = p.title;
  const tierLabel = p.tier === 'pemula' ? '🌱 Pemula' : p.tier === 'menengah' ? '⚡ Menengah' : '🔥 Mahir';
  const tierCls   = p.tier === 'pemula' ? 'badge-teal' : p.tier === 'menengah' ? 'badge-amber' : 'badge-accent';
  const tierEl    = document.getElementById('pd-tier-badge');
  if (tierEl) { tierEl.className = `badge ${tierCls}`; tierEl.textContent = tierLabel; }

  const pdBizEl = document.getElementById('pd-biz');
  if (pdBizEl) {
    pdBizEl.textContent = p.biz + (p.bizVerified ? ' ✅' : '');
    // Klik nama bisnis → buka profil publik (gaya .profile-link elegan)
    if (p.bizUserId) {
      pdBizEl.classList.add('profile-link', 'on-dark');
      pdBizEl.style.cssText = '';   // bersihkan inline style lama
      pdBizEl.onclick = () => openPublicProfile(p.bizUserId, p.biz);
    } else {
      pdBizEl.classList.remove('profile-link', 'on-dark');
      pdBizEl.onclick = null;
    }
  }
  document.getElementById('pd-desc').textContent = p.desc || p.description || '';
  // SECURITY: pd-title, pd-biz, pd-desc, pd-budget, dst — sudah pakai
  // textContent (aman by spec). Tidak perlu esc().
  // Tapi pd-skills dan pd-deliverables pakai innerHTML → wajib esc().
  document.getElementById('pd-skills').innerHTML = (p.skills || []).map(s => `<span class="skill-tag" style="font-size:13px;padding:5px 12px">${esc(s)}</span>`).join('');

  const budgetText = fmtRange(p.budgetMin || p.budget_min, p.budgetMax || p.budget_max);
  document.getElementById('pd-budget').textContent     = budgetText;
  document.getElementById('pd-budget-mob').textContent = budgetText;

  const deadline = p.deadline instanceof Date ? p.deadline : new Date(p.deadline);
  document.getElementById('pd-deadline').textContent   = fmtDate(deadline) + ` (${daysLeft(deadline)})`;
  document.getElementById('pd-applicants').textContent = `${p.applicants || 0} orang`;
  document.getElementById('pd-category').textContent   = p.category;

  if (document.getElementById('apply-modal-subtitle'))
    document.getElementById('apply-modal-subtitle').textContent = p.title;
  if (document.getElementById('apply-budget-hint'))
    document.getElementById('apply-budget-hint').textContent = `Range project: ${budgetText}`;

  const dlvEl    = document.getElementById('pd-deliverables');
  const delivStr = p.deliverables || '';
  const lines    = delivStr.split('\n').filter(Boolean);
  // SECURITY: setiap baris deliverable dari user → esc() sebelum innerHTML.
  dlvEl.innerHTML = lines.length
    ? lines.map(l => `<div class="deliverable-item"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg><span style="font-size:14px;color:var(--text-secondary)">${esc(l.replace(/^•\s*/, ''))}</span></div>`).join('')
    : `<p style="font-size:14px;color:var(--text-secondary)">Lihat deskripsi project untuk detail deliverables.</p>`;

  const applied      = state.appliedProjects.has(id);
  const applyBtnDesk = document.getElementById('pd-apply-btn-desk');
  if (applyBtnDesk) {
    if (applied) {
      applyBtnDesk.textContent = '✅ Lamaran Terkirim';
      applyBtnDesk.disabled    = true;
      applyBtnDesk.style.background = 'var(--teal-dark)';
    } else {
      applyBtnDesk.textContent = 'Lamar Project →';
      applyBtnDesk.disabled    = false;
      applyBtnDesk.style.background = '';
      applyBtnDesk.onclick     = () => openApplyModal();
    }
  }

  // Tombol "Tanya Bisnis" — buka inquiry chat dengan pemilik project.
  // openDirectChatWith() otomatis: pakai chat kontrak kalau sudah ada
  // kontrak, kalau belum → inquiry chat persisten (pre-contract).
  const openBizChat = () => {
    if (!p.bizUserId) { showToast('Info bisnis tidak tersedia untuk chat', 'error'); return; }
    openDirectChatWith(p.biz, 'bisnis', p.title, p.bizUserId);
  };
  const chatBtnDesk = document.getElementById('pd-chat-btn-desk');
  const chatBtnMob  = document.getElementById('pd-chat-btn-mob');
  if (chatBtnDesk) chatBtnDesk.onclick = openBizChat;
  if (chatBtnMob)  chatBtnMob.onclick  = openBizChat;

  document.getElementById('pd-back-btn').onclick = () => goBack();
  goTo('screen-project-detail');
}

/* ================================================================
   APPLY MODAL
   ================================================================ */
function openApplyModal() {
  if (!AuthAPI.isLoggedIn()) { showToast('Login dulu untuk melamar project', 'error'); goTo('screen-login'); return; }
  if (VERIF.status !== 'approved') {
    document.getElementById('unverified-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    return;
  }
  const todayStr = new Date().toISOString().split('T')[0];
  const maxStr   = new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0];
  const defaultD = new Date();
  defaultD.setDate(defaultD.getDate() + 7);
  const dateEl = document.getElementById('apply-date');
  if (dateEl) {
    dateEl.min = todayStr;
    dateEl.max = maxStr;
    if (!dateEl.value) dateEl.value = defaultD.toISOString().split('T')[0];
  }
  document.getElementById('apply-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeApplyModal() { document.getElementById('apply-modal').classList.remove('open'); document.body.style.overflow = ''; }
function closeApplyModalOutside(e) { if (e.target === e.currentTarget) closeApplyModal(); }
function closeUnverifiedModal() { document.getElementById('unverified-modal').classList.remove('open'); document.body.style.overflow = ''; }
function closeUnverifiedModalOutside(e) { if (e.target === e.currentTarget) closeUnverifiedModal(); }

let _submitApplyInFlight = false;
async function submitApply() {
  if (_submitApplyInFlight) return;
  const cover       = document.getElementById('apply-cover').value.trim();
  const date        = document.getElementById('apply-date').value;
  const budgetRaw   = slParsePrice(document.getElementById('apply-budget').value);
  const budgetInput = budgetRaw ? Math.round(budgetRaw / 1000) * 1000 : 0;

  if (!cover || cover.length < 50) { showToast('Cover letter minimal 50 karakter', 'error'); document.getElementById('apply-cover').focus(); return; }
  if (!date) { showToast('Pilih estimasi tanggal selesai', 'error'); return; }

  // Validasi tanggal estimasi
  const estDate = new Date(date);
  const todayD  = new Date(); todayD.setHours(0,0,0,0);
  const maxDate = new Date(Date.now() + 365*24*3600*1000);
  if (isNaN(estDate.getTime())) { showToast('Format tanggal tidak valid', 'error'); return; }
  if (estDate < todayD)         { showToast('Estimasi tidak boleh tanggal masa lalu', 'error'); return; }
  if (estDate > maxDate)        { showToast('Estimasi maksimal 1 tahun dari sekarang', 'error'); return; }

  if (budgetInput && budgetInput < 10000)     { showToast('Budget tawaran minimal Rp 10.000', 'error'); return; }
  if (budgetInput && budgetInput > 100000000) { showToast('Budget tawaran maksimal Rp 100.000.000', 'error'); return; }

  const btn = document.getElementById('apply-submit-btn');
  btn.classList.add('loading');
  if (btn) btn.disabled = true;
  _submitApplyInFlight = true;

  try {
    const cachedProjects  = window._cachedProjects || [];
    const currentProject  = cachedProjects.find(p => p.id === state.currentProjectId);
    const projectId       = currentProject?.apiId || state.currentProjectId;

    await ApplicationsAPI.apply({
      project_id: projectId, cover_letter: cover,
      estimated_completion: date,
      ...(budgetInput && { offered_budget: budgetInput }),
    });

    closeApplyModal();
    state.appliedProjects.add(state.currentProjectId);
    showToast('Lamaran berhasil dikirim! 🚀 Semoga berhasil!', 'success');

    // Auto-refresh tombol "Lamar" di detail screen (kalau user masih di sana)
    // SEBELUMNYA: state.appliedProjects di-update, tapi tombol di screen
    // detail TIDAK ter-render ulang sehingga user bisa klik "Lamar" lagi
    // (yang akan throw 409 "sudah pernah melamar"). Sekarang force re-render.
    const applyBtnDesk = document.getElementById('pd-apply-btn-desk');
    if (applyBtnDesk) {
      applyBtnDesk.textContent      = '✅ Lamaran Terkirim';
      applyBtnDesk.disabled         = true;
      applyBtnDesk.style.background = 'var(--teal-dark)';
      applyBtnDesk.style.cursor     = 'not-allowed';
      applyBtnDesk.onclick          = null;  // hapus handler supaya benar2 tidak bisa diklik
    }

    // Refetch project list di home/browse (state.appliedProjects sudah di-sync,
    // jadi tombol di list otomatis berubah ke badge "Lamaran Terkirim")
    await loadProjectsFromAPI();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    _submitApplyInFlight = false;
    btn.classList.remove('loading');
    if (btn) btn.disabled = false;
  }
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.loadProjectsFromAPI         = loadProjectsFromAPI;
window.buildProjectCard            = buildProjectCard;
window.renderHomeProjects          = renderHomeProjects;
window.renderBrowseProjects        = renderBrowseProjects;
window.filterProjects              = filterProjects;
window.setFilter                   = setFilter;
window.setProjectFilter            = setProjectFilter;
window.openProject                 = openProject;
window.renderActiveProjects        = renderActiveProjects;
window.openApplyModal              = openApplyModal;
window.closeApplyModal             = closeApplyModal;
window.closeApplyModalOutside      = closeApplyModalOutside;
window.closeUnverifiedModal        = closeUnverifiedModal;
window.closeUnverifiedModalOutside = closeUnverifiedModalOutside;
window.submitApply                 = submitApply;