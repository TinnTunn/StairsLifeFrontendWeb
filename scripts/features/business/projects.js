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

async function handlePostProject(btnEl) {
  // SUBMIT LOCK — anti double-tap.
  // Bug history: tanpa lock, user double-tap → 2 POST → 2 row di DB
  // dengan title sama (id beda) → terlihat "duplikat" di my-projects.
  // Lihat helpers.js withSubmitLock untuk detail.
  return withSubmitLock(btnEl, async () => {
    const title        = document.getElementById('pp-title')?.value.trim();
    const desc         = document.getElementById('pp-desc')?.value.trim();
    const bMinRaw      = slParsePrice(document.getElementById('pp-budget-min')?.value);
    const bMaxRaw      = slParsePrice(document.getElementById('pp-budget-max')?.value);
    const bMin         = bMinRaw ? Math.round(bMinRaw / 1000) * 1000 : 0;
    const bMax         = bMaxRaw ? Math.round(bMaxRaw / 1000) * 1000 : 0;
    const deadline     = document.getElementById('pp-deadline')?.value;
    const cat          = document.getElementById('pp-category')?.value;
    const tier         = document.getElementById('pp-tier')?.value;
    const skillsRaw    = document.getElementById('pp-skills')?.value || '';
    const deliverables = document.getElementById('pp-deliverables')?.value || '';

    if (!title)    { showToast('Judul project wajib diisi', 'error'); return; }
    if (!desc)     { showToast('Deskripsi project wajib diisi', 'error'); return; }
    if (!bMin || !bMax) { showToast('Budget wajib diisi', 'error'); return; }
    if (bMin < 10000)   { showToast('Budget minimum minimal Rp 10.000', 'error'); return; }
    if (bMax > 100000000) { showToast('Budget maximum maksimal Rp 100.000.000', 'error'); return; }
    if (bMin > bMax)    { showToast('Budget Min tidak boleh lebih besar dari Budget Max', 'error'); return; }
    if (!deadline) { showToast('Deadline wajib diisi', 'error'); return; }

    // Validasi deadline: harus future, max 1 tahun ke depan
    const dlDate    = new Date(deadline);
    const todayD    = new Date(); todayD.setHours(0,0,0,0);
    const maxDate   = new Date(Date.now() + 365*24*3600*1000);
    if (isNaN(dlDate.getTime())) { showToast('Format tanggal deadline tidak valid', 'error'); return; }
    if (dlDate < todayD)    { showToast('Deadline tidak boleh tanggal masa lalu', 'error'); return; }
    if (dlDate > maxDate)   { showToast('Deadline maksimal 1 tahun dari sekarang', 'error'); return; }

    if (!cat)      { showToast('Pilih kategori project', 'error'); return; }
    if (!tier)     { showToast('Pilih tier skill', 'error'); return; }

    const skills = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);

    try {
      await ProjectsAPI.create({ title, description: desc, budget_min: bMin, budget_max: bMax, deadline, category: cat, tier, skills, deliverables });
      showToast('Project berhasil dipasang! 🚀', 'success');
      if (typeof invalidateMyProjectsCache === 'function') invalidateMyProjectsCache();
      // Langsung ke tab "Project Saya" + render ulang (force) supaya project
      // baru langsung tampil tanpa perlu refresh manual.
      setTimeout(() => {
        goTo('screen-business');
        if (typeof switchBizTab === 'function') {
          switchBizTab(1);
        } else if (typeof renderMyProjectsAPI === 'function') {
          renderMyProjectsAPI(true);
        }
      }, 600);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }, '⏳ Memposting...');
}

/* ================================================================
   MY PROJECTS (biz tab-1)
   ================================================================ */
let _myProjectsFilter = 'all';     // 'all' | 'open' | 'inProgress' | 'completed'
let _myProjectsCache = null;       // cache supaya tab switch tidak refetch
let _pendingReviewProjectIds = new Set();  // project yg punya deliverable menunggu review

async function renderMyProjectsAPI(forceRefresh = false) {
  const el = document.getElementById('my-projects-list');
  if (!el) return;

  // Skeleton hanya kalau belum ada cache
  if (!_myProjectsCache || forceRefresh) {
    el.innerHTML = skeletons.applicationCards(3);

    try {
      const res    = await ProjectsAPI.getMyProjects();
      let projects = res.data || [];
      // Deduplikasi
      const seen = new Set();
      projects = projects.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      _myProjectsCache = projects;

      // Cross-ref kontrak: tandai project yang punya deliverable menunggu
      // review (kontrak status 'pending_review') → tampilkan badge "Perlu Review".
      try {
        const cRes = await ContractsAPI.getMyContracts();
        _pendingReviewProjectIds = new Set(
          (cRes.data || [])
            .filter(c => c.status === 'pending_review')
            .map(c => c.project_id)
            .filter(Boolean),
        );
      } catch (_) {
        _pendingReviewProjectIds = new Set();
      }
    } catch (error) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p style="color:var(--rose)">${esc(error?.message || 'Gagal memuat project')}</p><button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="renderMyProjectsAPI(true)">Coba Lagi</button></div>`;
      return;
    }
  }

  _renderMyProjectsWithFilter();
}

function setMyProjectsFilter(filter) {
  _myProjectsFilter = filter;
  _renderMyProjectsWithFilter();
}

function _renderMyProjectsWithFilter() {
  const el = document.getElementById('my-projects-list');
  if (!el) return;

  const projects = _myProjectsCache || [];

  // Counts untuk badge filter
  const counts = {
    all:        projects.length,
    open:       projects.filter(p => p.status === 'open').length,
    inProgress: projects.filter(p => p.status === 'inProgress').length,
    completed:  projects.filter(p => p.status === 'completed').length,
  };

  // Filter chips bar
  const filterBar = `
    <div class="filter-chips" id="my-proj-filters" style="margin-bottom:16px;flex-wrap:wrap">
      <button class="filter-chip ${_myProjectsFilter === 'all' ? 'active' : ''}" onclick="setMyProjectsFilter('all')">📁 Semua (${counts.all})</button>
      <button class="filter-chip ${_myProjectsFilter === 'open' ? 'active' : ''}" onclick="setMyProjectsFilter('open')">🟢 Open (${counts.open})</button>
      <button class="filter-chip ${_myProjectsFilter === 'inProgress' ? 'active' : ''}" onclick="setMyProjectsFilter('inProgress')">🔵 Aktif (${counts.inProgress})</button>
      <button class="filter-chip ${_myProjectsFilter === 'completed' ? 'active' : ''}" onclick="setMyProjectsFilter('completed')">✅ Selesai (${counts.completed})</button>
    </div>
  `;

  // Filter applied
  let filtered = projects;
  if (_myProjectsFilter !== 'all') {
    filtered = projects.filter(p => p.status === _myProjectsFilter);
  }

  if (!projects.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Belum ada project</div><p class="empty-state-desc">Mulai pasang project pertama kamu!</p><button class="btn btn-primary" onclick="openPostProject()" style="margin-top:12px">Pasang Project</button></div>`;
    return;
  }

  if (!filtered.length) {
    const labelMap = { open: 'Open (belum ada pelamar)', inProgress: 'Aktif (sudah ada kontrak)', completed: 'Selesai' };
    el.innerHTML = filterBar + `<div class="empty-state" style="padding:32px"><div class="empty-state-icon">🔍</div><p style="color:var(--text-muted);font-size:14px">Tidak ada project ${esc(labelMap[_myProjectsFilter] || _myProjectsFilter)}</p></div>`;
    return;
  }

  el.innerHTML = filterBar + filtered.map(p => {
      const pid            = escAttr(p.id);
      const daysLeft       = Math.ceil((new Date(p.deadline) - new Date()) / 86400000);
      const daysLabel      = daysLeft > 0
        ? `${daysLeft} hari lagi`
        : daysLeft === 0
        ? 'Hari ini'
        : `${Math.abs(daysLeft)} hari lalu`;
      const daysColor      = daysLeft <= 3 ? 'var(--rose)' : 'var(--text-muted)';

      const needsReview = _pendingReviewProjectIds.has(p.id);

      // Status badge (+ penanda "Perlu Review" kalau ada deliverable menunggu)
      const statusBadgeHtml = (p.status === 'completed'
        ? `<span class="badge badge-teal">✅ Selesai</span>`
        : p.status === 'inProgress'
        ? `<span class="badge badge-accent">🔵 Aktif</span>`
        : `<span class="badge" style="background:var(--teal-light);color:var(--teal-dark)">🟢 Open</span>`)
        + (needsReview ? ` <span class="badge" style="background:var(--amber-light);color:var(--amber-dark)">🔔 Perlu Review</span>` : '');

      // Action buttons di card (level atas)
      // ── Logika tombol yang sudah dipikirkan ulang: ──
      // • open    : Edit budget/deadline + Hapus. Tombol kontrak TIDAK muncul
      //             karena kontrak belum ada. Bisnis masih bisa terima lamaran.
      // • inProgress: "⚙️ Kelola Kontrak" — action-oriented, jelas ada sesuatu
      //             yang perlu dilakukan (deliverable, approve, dll). Tombol Edit
      //             dihapus karena budget kontrak sudah terkunci (sudah escrow).
      // • completed : "📊 Lihat Riwayat" — bukan "Lihat Kontrak" karena kontrak
      //             sudah selesai dan yang relevan adalah riwayat & review.
      //             Edit tidak relevan karena sudah selesai.
      const actionBtns = [
        // Edit — hanya saat open (sebelum ada kontrak & escrow)
        p.status === 'open' ? `
          <button class="btn btn-ghost btn-sm" style="flex:1" onclick="event.stopPropagation();showEditProjectModal('${pid}',${Number(p.budget_min)||0},${Number(p.budget_max)||0},'${escAttr((p.deadline||'').split('T')[0])}')">
            ✏️ Edit
          </button>` : '',

        // Kelola Kontrak — project aktif (inProgress). Kalau ada deliverable
        // menunggu, ubah jadi ajakan review yang lebih menonjol.
        p.status === 'inProgress' ? `
          <button class="btn btn-primary btn-sm" style="flex:2${needsReview ? ';background:var(--amber-dark)' : ''}" onclick="event.stopPropagation();openBizContract('${pid}')">
            ${needsReview ? '🔔 Review Deliverable' : '⚙️ Kelola Kontrak'}
          </button>` : '',

        // Lihat Riwayat — project completed
        p.status === 'completed' ? `
          <button class="btn btn-primary btn-sm" style="flex:2" onclick="event.stopPropagation();openBizContract('${pid}')">
            📊 Lihat Riwayat
          </button>` : '',

        // Hapus — hanya saat open dan belum ada pelamar yg accepted
        p.status === 'open' ? `
          <button class="btn btn-danger btn-sm" style="padding:0 14px" onclick="event.stopPropagation();deleteProject('${pid}','${escAttr(p.title)}',this)">
            🗑️
          </button>` : '',
      ].filter(Boolean).join('');

      return `
  <div class="my-proj-card" style="cursor:pointer" onclick="toggleProjectApplicants('${pid}', this)">
    <div class="my-proj-header">
      <div class="my-proj-title">${esc(p.title)}</div>
      ${statusBadgeHtml}
    </div>
    <div class="my-proj-meta">${esc(p.category)}</div>
    <div class="my-proj-footer">
      <span style="font-size:14px;font-weight:700;color:var(--accent)">
        Rp ${((p.budget_min||0)/1000).toFixed(0)}K – ${((p.budget_max||0)/1000).toFixed(0)}K
      </span>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="applicant-count">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          ${esc(p.applicant_count||0)} pelamar
        </div>
        <span style="font-size:12px;color:${daysColor};font-weight:${daysLeft<=3?'600':'400'}">
          ${esc(daysLabel)}
        </span>
      </div>
    </div>
    ${actionBtns ? `
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap" onclick="event.stopPropagation()">
      ${actionBtns}
    </div>` : ''}
    ${p.status === 'open' ? `
    <div style="margin-top:10px;font-size:11.5px;color:var(--teal-dark);display:flex;align-items:center;gap:5px;opacity:.85">
      <span>✅</span>
      <span>Masih menerima lamaran baru — klik card untuk lihat pelamar</span>
    </div>` : ''}
    <div class="project-applicants-drawer" id="drawer-${pid}" style="display:none;margin-top:16px;border-top:1px solid var(--divider);padding-top:14px">
      <div style="font-size:13px;font-weight:700;color:var(--text-secondary);margin-bottom:10px">Pelamar Project</div>
      <div class="applicants-list-${pid}"><div style="text-align:center;color:var(--text-muted);font-size:13px">Memuat...</div></div>
    </div>
  </div>`;
    }).join('');
}

// Auto-invalidate cache saat project berubah (post/edit/delete)
function invalidateMyProjectsCache() {
  _myProjectsCache = null;
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
      const student   = a.users || {};
      const name      = student.full_name || 'Mahasiswa';
      const nameSafe  = esc(name);
      const nameAttr  = escAttr(name);
      const aidAttr   = escAttr(a.id);
      const pidAttr   = escAttr(projectId);
      // Pass student userId supaya inquiry chat persistent (pakai backend endpoint)
      const sUidAttr  = escAttr(student.id || '');
      const coverSafe = esc(a.cover_letter || '');
      const uniSafe   = esc(student.university || '-');
      const budgetFmt = a.offered_budget
        ? `Rp ${Number(a.offered_budget).toLocaleString('id-ID')}`
        : 'Sesuai budget';
      const estDate   = a.estimated_completion
        ? new Date(a.estimated_completion).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })
        : '-';

      let actionButtons = '';
      if (a.status === 'pending') {
        // Masih pending — bisnis belum ambil keputusan.
        // Bisa chat dulu sebelum terima (inquiry persistent), baru terima/tolak.
        actionButtons = `
          <button class="btn btn-ghost btn-sm"
            onclick="event.stopPropagation();openDirectChatWith('${nameAttr}','mahasiswa','${pidAttr}','${sUidAttr}')">
            💬 Chat
          </button>
          <button class="btn btn-sm btn-primary"
            onclick="event.stopPropagation();acceptApplicationFromProject('${aidAttr}','${Number(a.offered_budget)||0}','${escAttr(a.estimated_completion||'')}',this)">
            ✅ Terima
          </button>
          <button class="btn btn-sm btn-danger"
            onclick="event.stopPropagation();rejectApplication('${aidAttr}',this)">
            ❌ Tolak
          </button>`;
      } else if (a.status === 'approved') {
        // Sudah diterima & ada kontrak — tombol Lihat Kontrak cukup satu di sini.
        // Tidak perlu lagi tombol Accept/Reject karena sudah diputuskan.
        actionButtons = `
          <span class="badge badge-teal">✅ Diterima</span>
          <button class="btn btn-ghost btn-sm"
            onclick="event.stopPropagation();openDirectChatWith('${nameAttr}','mahasiswa','${pidAttr}','${sUidAttr}')">
            💬 Chat
          </button>
          <button class="btn btn-primary btn-sm"
            onclick="event.stopPropagation();openBizContract('${aidAttr}')">
            📄 Kontrak
          </button>`;
      } else if (a.status === 'rejected') {
        actionButtons = `<span class="badge badge-rose">❌ Ditolak</span>`;
      } else {
        actionButtons = statusBadge(a.status);
      }

      return `
      <div style="display:flex;align-items:flex-start;gap:12px;padding:14px;background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:8px;border:1px solid var(--border)">
        <!-- Avatar clickable ke profile (style social media) -->
        <div style="width:40px;height:40px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:var(--accent);flex-shrink:0;cursor:pointer;transition:transform .1s"
          onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"
          onclick="event.stopPropagation();openPublicProfile('${sUidAttr}','${nameAttr}')"
          title="Lihat profil ${nameAttr}">
          ${esc(initials(name))}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">
            <!-- Nama clickable ke profile (gaya .profile-link halus) -->
            <span class="profile-link subtle" style="font-size:14px;font-weight:700"
              onclick="event.stopPropagation();openPublicProfile('${sUidAttr}','${nameAttr}')">
              ${nameSafe}
            </span>
            ${tierBadge(student.tier || 'pemula')}
            ${student.is_verified ? '<span class="badge" style="background:var(--teal-light);color:var(--teal-dark);font-size:10px">✓ Terverifikasi</span>' : ''}
          </div>
          ${student.university ? `<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:6px">${uniSafe}</div>` : ''}
          <div style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;font-style:italic">
            "${coverSafe}"
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px">
            <div style="font-size:12px;background:var(--bg-card);padding:4px 10px;border-radius:8px;border:1px solid var(--border)">
              💰 <strong>${budgetFmt}</strong>
            </div>
            <div style="font-size:12px;background:var(--bg-card);padding:4px 10px;border-radius:8px;border:1px solid var(--border)">
              📅 Selesai ${estDate}
            </div>
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

/**
 * Buka kontrak untuk sebuah project atau application.
 *
 * Function ini dipanggil dari 2 tempat dengan ID berbeda:
 *  1. renderMyProjects (tab Project Saya) → pass project_id
 *  2. renderIncomingApps (tab Lamaran Masuk) → pass application_id
 *
 * BUG SEBELUMNYA: function hanya cari `c.application_id === id`, sehingga
 *   call dari tab Project Saya (yang pass project_id) selalu gagal dengan
 *   toast "Kontrak belum dibuat". Padahal kontraknya jelas ada (status
 *   project = inProgress/completed).
 *
 * Fix: cari kontrak yang match application_id ATAU project_id.
 *      Untuk project_id, kalau ada multiple kontrak (mis. project re-listed),
 *      ambil yang paling baru (sorted desc dari backend).
 */
async function openBizContract(id) {
  try {
    const res       = await ContractsAPI.getMyContracts();
    const contracts = res.data || [];

    // Cari kontrak yang match id sebagai application_id ATAU project_id.
    // Karena backend sort by created_at DESC, .find() mengambil yang terbaru
    // saat ada multiple kontrak untuk project yang sama.
    const contract = contracts.find(c =>
      c.application_id === id || c.project_id === id,
    );

    if (contract) {
      window._currentContract  = contract;
      window.currentContractId = contract.id;
      // goTo trigger router onEnter → loadContractDetail otomatis.
      // JANGAN panggil loadContractDetail manual — akan double-render.
      goTo('screen-contract-detail');
    } else {
      showToast('Kontrak belum dibuat. Buat kontrak dulu setelah accept lamaran.', 'info');
    }
  } catch (e) {
    showToast('Gagal membuka kontrak: ' + e.message, 'error');
  }
}

// Map applicationId → boolean; mencegah double-tap pada tombol terima yang
// sama, tapi tetap memperbolehkan accept beberapa lamaran berbeda paralel.
const _acceptAppInFlight = new Set();
async function acceptApplicationFromProject(applicationId, offeredBudget, estimatedCompletion, btn) {
  if (_acceptAppInFlight.has(applicationId)) return;
  _acceptAppInFlight.add(applicationId);
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

    // showEscrowModal sudah terima applicationId — submitEscrowAndContract
    // mengaksesnya via closure, jadi tidak perlu menyimpan di window.
    showEscrowModal(applicationId, application, projectTitle);

    btn.disabled    = false;
    btn.textContent = '✅ Terima';
    // (refresh list dilakukan SETELAH submitEscrowAndContract sukses,
    //  bukan sekarang — sekarang user belum bikin kontrak apa pun)
  } catch (error) {
    showToast(error.message, 'error');
    btn.disabled    = false;
    btn.textContent = '✅ Terima';
  } finally {
    _acceptAppInFlight.delete(applicationId);
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
            <input class="form-input" id="edit-budget-min" type="text" inputmode="numeric" value="${slFormatPrice(budgetMin)}" oninput="slPriceInput(this)">
          </div>
          <div class="form-group">
            <label class="form-label">Budget Max (Rp)</label>
            <input class="form-input" id="edit-budget-max" type="text" inputmode="numeric" value="${slFormatPrice(budgetMax)}" oninput="slPriceInput(this)">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Deadline</label>
          <input class="form-input" id="edit-deadline" type="date" value="${deadline}" min="${new Date().toISOString().split('T')[0]}" max="${new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0]}">
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

const _deleteProjectInFlight = new Set();
async function _confirmDeleteProject(projectId) {
  if (_deleteProjectInFlight.has(projectId)) return;
  _deleteProjectInFlight.add(projectId);
  const btn = document.getElementById('delete-project-confirm-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  try {
    await ProjectsAPI.delete(projectId);
    document.getElementById('delete-project-modal')?.remove();
    document.body.style.overflow = '';
    showToast('Project berhasil dihapus', 'success');
    invalidateMyProjectsCache();
    // onEnterBusiness sudah refresh semua termasuk project list
    await onEnterBusiness();
  } catch (e) {
    showToast(e.message || 'Gagal menghapus project', 'error');
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  } finally {
    _deleteProjectInFlight.delete(projectId);
  }
}

const _saveProjectEditInFlight = new Set();
async function saveProjectEdit(projectId) {
  if (_saveProjectEditInFlight.has(projectId)) return;
  const bMinRaw   = slParsePrice(document.getElementById('edit-budget-min')?.value);
  const bMaxRaw   = slParsePrice(document.getElementById('edit-budget-max')?.value);
  const budgetMin = bMinRaw ? Math.round(bMinRaw / 1000) * 1000 : 0;
  const budgetMax = bMaxRaw ? Math.round(bMaxRaw / 1000) * 1000 : 0;
  const deadline  = document.getElementById('edit-deadline')?.value;

  if (!budgetMin || !budgetMax)    { showToast('Budget wajib diisi', 'error'); return; }
  if (budgetMin < 10000)           { showToast('Budget minimum minimal Rp 10.000', 'error'); return; }
  if (budgetMax > 100000000)       { showToast('Budget maximum maksimal Rp 100.000.000', 'error'); return; }
  if (budgetMin > budgetMax)       { showToast('Budget Min tidak boleh lebih besar dari Budget Max', 'error'); return; }
  if (!deadline)                   { showToast('Deadline wajib diisi', 'error'); return; }

  const dlDate  = new Date(deadline);
  const todayD  = new Date(); todayD.setHours(0,0,0,0);
  const maxDate = new Date(Date.now() + 365*24*3600*1000);
  if (isNaN(dlDate.getTime())) { showToast('Format tanggal deadline tidak valid', 'error'); return; }
  if (dlDate < todayD)         { showToast('Deadline tidak boleh tanggal masa lalu', 'error'); return; }
  if (dlDate > maxDate)        { showToast('Deadline maksimal 1 tahun dari sekarang', 'error'); return; }

  const btn = document.querySelector('#edit-project-modal button.btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyimpan...'; }
  _saveProjectEditInFlight.add(projectId);

  try {
    await ProjectsAPI.update(projectId, { budget_min: budgetMin, budget_max: budgetMax, deadline });
    document.getElementById('edit-project-modal')?.remove();
    document.body.style.overflow = '';
    showToast('Project berhasil diperbarui ✅', 'success');
    await renderMyProjectsAPI(true);
  } catch (error) {
    showToast(error.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan Perubahan'; }
  } finally {
    _saveProjectEditInFlight.delete(projectId);
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
      const student   = a.users || {};
      const studentId = escAttr(student.id || '');
      const nameAttr  = escAttr(student.full_name || 'Mahasiswa');
      const nameSafe  = esc(student.full_name || 'Mahasiswa');
      return `
      <div class="incoming-card">
        <div class="applicant-row">
          <div class="applicant-avatar" style="cursor:pointer;overflow:hidden"
            onclick="event.stopPropagation();openPublicProfile('${studentId}','${nameAttr}')"
            title="Lihat profil ${nameAttr}">
            ${avatarHtml(student)}
          </div>
          <div style="flex:1">
            <div class="applicant-name profile-link subtle" style="cursor:pointer"
              onclick="event.stopPropagation();openPublicProfile('${studentId}','${nameAttr}')">
              ${nameSafe}
            </div>
            <div class="applicant-uni" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              ${tierBadge(student.tier || 'pemula')}
              ${student.is_verified ? '<span class="badge" style="background:var(--teal-light);color:var(--teal-dark);font-size:10px">✓ Terverifikasi</span>' : ''}
            </div>
          </div>
          ${statusBadge(a.status)}
        </div>
        <div class="cover-letter-text">"${esc(a.cover_letter || '')}"</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">
          Estimasi selesai: ${esc(new Date(a.estimated_completion).toLocaleDateString('id-ID'))}
          ${a.offered_budget ? ` · Budget tawaran: Rp ${esc(a.offered_budget.toLocaleString('id-ID'))}` : ''}
        </div>
        ${a.status === 'pending' ? `
        <div class="applicant-actions">
          <button class="btn btn-sm btn-primary" onclick="acceptApplication('${escAttr(a.id)}', this)">✅ Terima</button>
          <button class="btn btn-sm btn-danger" onclick="rejectApplication('${escAttr(a.id)}', this)">❌ Tolak</button>
        </div>` : ''}
      </div>`;
    }).join('');
  } catch (error) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat lamaran</div></div>`;
  }
}

async function acceptApplication(id, btn) {
  if (_acceptAppInFlight.has(id)) return;
  _acceptAppInFlight.add(id);
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

    // BUG FIX: jangan approve di sini — biarkan submitEscrowAndContract yang
    // approve setelah kontrak + escrow berhasil. Sebelumnya kalau user batal
    // di modal escrow, lamaran stuck di status 'approved' tanpa kontrak.
    showEscrowModal(id, application, projectTitle);
    btn.disabled    = false;
    btn.textContent = '✅ Terima';
  } catch (error) {
    showToast(error.message, 'error');
    btn.disabled    = false;
    btn.textContent = '✅ Terima';
  } finally {
    _acceptAppInFlight.delete(id);
  }
}

const _rejectAppInFlight = new Set();
async function rejectApplication(id, btn) {
  if (_rejectAppInFlight.has(id)) return;
  _rejectAppInFlight.add(id);
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
  } finally {
    _rejectAppInFlight.delete(id);
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
    if (!projects.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">📥</div>
        <div class="empty-state-title">Belum ada lamaran</div>
        <p class="empty-state-desc">Lamaran dari mahasiswa akan muncul di sini setelah kamu pasang project.</p>
      </div>`;
      return;
    }

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
      const studentId   = escAttr(student.id || '');
      const nameAttr    = escAttr(studentName);
      const nameSafe    = esc(studentName);
      const pTitleSafe  = esc(projectWithApps.title);
      const pTitleAttr  = escAttr(projectWithApps.title);
      return `
      <div class="incoming-card" style="cursor:pointer" onclick="switchBizTab(2)">
        <div class="applicant-row">
          <div class="applicant-avatar" style="cursor:pointer"
            onclick="event.stopPropagation();openPublicProfile('${studentId}','${nameAttr}')"
            title="Lihat profil ${nameAttr}">
            ${esc(studentName.charAt(0))}
          </div>
          <div style="flex:1">
            <div class="applicant-name profile-link subtle" style="cursor:pointer"
              onclick="event.stopPropagation();openPublicProfile('${studentId}','${nameAttr}')">
              ${nameSafe}
            </div>
            <div class="applicant-uni" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              ${tierBadge(student.tier || 'pemula')}
              ${student.is_verified ? '<span class="badge" style="background:var(--teal-light);color:var(--teal-dark);font-size:10px">✓ Terverifikasi</span>' : ''}
            </div>
          </div>
          ${statusBadge(a.status)}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px">Project: ${pTitleSafe}</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openDirectChatWith('${nameAttr}','mahasiswa','Project: ${pTitleAttr}','${studentId}')">💬 Chat</button>
          ${a.status === 'pending' ? `
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();acceptApplication('${escAttr(a.id)}', this)">✅ Terima</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();rejectApplication('${escAttr(a.id)}', this)">❌ Tolak</button>
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

  // Dedup by id (defensive — kalau ada double-fetch dari path lain,
  // tidak akan terlihat duplikat di dashboard).
  const seen = new Set();
  const unique = (projects || []).filter(p => {
    if (!p?.id) return true;
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // SECURITY: pakai esc() untuk semua field text dari DB karena meskipun
  // ini "milik sendiri", title bisa diisi attacker bila ada XSS di endpoint
  // lain. Pattern ini sama dengan renderMyProjectsAPI (di file ini) dan
  // konsisten dengan defense-in-depth di seluruh codebase.
  if (!unique.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <div class="empty-state-title">Belum ada project</div>
      <p class="empty-state-desc">Mulai pasang project pertamamu dan temukan mahasiswa terbaik.</p>
      <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="openPostProject()">+ Pasang Project</button>
    </div>`;
    return;
  }

  el.innerHTML = unique.slice(0, 3).map(p => `
    <div class="my-proj-card" style="cursor:pointer" onclick="switchBizTab(1)">
      <div class="my-proj-header">
        <div class="my-proj-title">${esc(p.title)}</div>
        ${statusBadge(p.status === 'inProgress' ? 'aktif' : p.status === 'completed' ? 'selesai' : 'open')}
      </div>
      <div class="my-proj-meta">${esc(p.category)}</div>
      <div class="my-proj-footer">
        <span style="font-size:14px;font-weight:700;color:var(--accent)">
          Rp ${((p.budget_min || 0) / 1000).toFixed(0)}K – ${((p.budget_max || 0) / 1000).toFixed(0)}K
        </span>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="applicant-count">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            ${esc(p.applicant_count || 0)} pelamar
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
window.setMyProjectsFilter           = setMyProjectsFilter;
window.invalidateMyProjectsCache     = invalidateMyProjectsCache;
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