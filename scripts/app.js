/**
 * StairsLife Web — app.js  v3.0
 * Entry point: global state, bootstrap, route hooks.
 */
'use strict';

/* ================================================================
   GLOBAL DATA ARRAYS
   Hanya berisi state yang masih dipakai aktif oleh feature modules.
   Array yang sebelumnya tidak pernah di-populate sudah dihapus.
   ================================================================ */

// Core marketplace state (dipakai oleh student/business/payments/disputes/chat features)
const PROJECTS        = [];
const APPLICATIONS    = [];
const PAYMENTS        = [];
const NOTIFICATIONS   = [];
const DISPUTES        = [];
const CHATS           = [];
const CHAT_MESSAGES   = {};

// Admin state (dipakai oleh features/admin/*)
const ADMIN_DISPUTES      = [];
const ADMIN_ANNOUNCEMENTS = [];
const ADMIN_AUDIT_LOGS    = [];

const ADMIN_ROLES = [
  { id: 'ra1', name: 'Super Admin', user: 'Super Admin', members: ['Super Admin'],
    permissions: ['Overview','Projects','Users','Verification','Disputes','Support','Announcement','Settings'] },
  { id: 'ra2', name: 'Admin', user: 'Ops Admin', members: ['Ops Admin'],
    permissions: ['Overview','Projects','Users','Verification','Disputes','Support'] },
];

const ADMIN_SETTINGS = { fee: 10, verifSla: 2 };

/* ================================================================
   ADMIN VIEW STATE — shared with admin/* modules
   ================================================================ */
const adminUsersView   = { type: 'mhs', status: 'all', q: '', tab: 'mhs' };
const adminVerifView   = { status: 'pending' };
const adminDisputeView = { status: 'all' };
const adminSupportView = { status: 'all', q: '' };

const ADMIN_USER_VIEW    = adminUsersView;
const ADMIN_VERIF_VIEW   = adminVerifView;
const ADMIN_DISPUTE_VIEW = adminDisputeView;

/* ================================================================
   NAVIGATION HISTORY (used by router.js)
   ================================================================ */
const screenHistory = [];

/* ================================================================
   MAIN APP STATE
   ================================================================ */
const state = {
  theme:            localStorage.getItem('sl-theme') || 'light',
  currentScreen:    'screen-landing',
  prevScreen:       null,
  obPage:           0,
  loginRole:        0,
  regStep:          1,
  regRole:          null,
  regSkipKtm:       false,
  browseFilter:     'semua',
  appFilter:        'semua',
  chatFilter:       'all',
  searchQuery:      '',
  currentProjectId: null,
  appliedProjects:  new Set(),
};

/* ================================================================
   USER_PROFILES — compat shim
   ================================================================ */
const USER_PROFILES = {
  get student() {
    const p = (typeof getCurrentUserProfile === 'function' ? getCurrentUserProfile() : null) || {};
    return { id: p.id || 's1', name: p.role === 'student' ? p.name : (p.name || 'Mahasiswa') };
  },
  get biz() {
    const p = (typeof getCurrentUserProfile === 'function' ? getCurrentUserProfile() : null) || {};
    return { id: p.id || 'b1', name: p.role === 'biz' ? p.name : (p.name || 'Bisnis'), bizName: p.bizName || p.name || 'Bisnis' };
  },
  get admin() {
    const p = (typeof getCurrentUserProfile === 'function' ? getCurrentUserProfile() : null) || {};
    return { id: p.id || 'a1', name: p.role === 'admin' ? p.name : 'Admin StairsLife' };
  },
};

/* ================================================================
   ADMIN SETTINGS
   ================================================================ */
function renderAdminSettings() {
  const roleEl  = document.getElementById('admin-role-list');
  const auditEl = document.getElementById('admin-audit-list');
  // Access Control — data NYATA dari backend (/admin/roles).
  // Catatan: ini registri role/permission (dikelola), bukan enforcement —
  // pengecekan akses tetap role='admin' di backend.
  if (roleEl) {
    renderAdminRoles();
  }
  // Audit Log — data NYATA dari backend (/admin/audit-logs).
  if (auditEl) {
    const labelMap = {
      'user.suspend_toggle': 'Suspend / aktifkan user',
      'user.delete':         'Hapus user',
      'verification.review': 'Review verifikasi',
      'dispute.resolve':     'Resolve dispute',
      'announcement.send':   'Kirim announcement',
      'settings.update':     'Ubah pengaturan platform',
    };
    auditEl.innerHTML = `<div style="font-size:13px;color:var(--text-muted);padding:8px 0">Memuat aktivitas...</div>`;
    AdminAPI.getAuditLogs(20).then(res => {
      const logs = res?.data || [];
      if (!logs.length) {
        auditEl.innerHTML = `<div style="font-size:13px;color:var(--text-muted);padding:8px 0">Belum ada aktivitas tercatat.</div>`;
        return;
      }
      // SECURITY: actor_name & action dari server → esc() sebelum innerHTML.
      auditEl.innerHTML = logs.map(l => {
        const label = labelMap[l.action] || l.action || 'Aksi admin';
        const tgt   = l.target_id ? ` (${String(l.target_id).slice(0, 8)})` : '';
        return `
      <div class="admin-feed-item">
        <div class="admin-feed-dot"></div>
        <div style="flex:1">
          <div class="admin-feed-title">${esc(l.actor_name || 'Admin')}</div>
          <div class="admin-feed-sub">${esc(label + tgt)}</div>
          <div class="admin-feed-time">${esc(fmtRelative(new Date(l.created_at)))}</div>
        </div>
      </div>`;
      }).join('');
    }).catch(() => {
      auditEl.innerHTML = `<div style="font-size:13px;color:var(--text-muted);padding:8px 0">Gagal memuat aktivitas.</div>`;
    });
  }

  AdminAPI.getSettings().then(res => {
    const s = res?.data || {};
    const feeEl = document.getElementById('admin-fee');
    const slaEl = document.getElementById('admin-verif-sla');
    if (feeEl && s.platform_fee        != null) feeEl.value = s.platform_fee;
    if (slaEl && s.verification_sla_days != null) slaEl.value = s.verification_sla_days;
    if (s.platform_fee)          ADMIN_SETTINGS.fee      = s.platform_fee;
    if (s.verification_sla_days) ADMIN_SETTINGS.verifSla = s.verification_sla_days;
  }).catch(() => {
    const feeEl = document.getElementById('admin-fee');
    const slaEl = document.getElementById('admin-verif-sla');
    if (feeEl) feeEl.value = ADMIN_SETTINGS.fee;
    if (slaEl) slaEl.value = ADMIN_SETTINGS.verifSla;
  });
}

/* ── Access Control: render + CRUD role dari backend (/admin/roles) ── */
async function renderAdminRoles() {
  const roleEl = document.getElementById('admin-role-list');
  if (!roleEl) return;
  roleEl.innerHTML = `<div style="font-size:13px;color:var(--text-muted);padding:8px 0">Memuat role...</div>`;
  try {
    const res   = await AdminAPI.getRoles();
    const roles = res?.data || [];
    // SECURITY: name/description/permissions/members dari server → esc().
    const list = roles.map((r, i) => {
      const perms   = Array.isArray(r.permissions) ? r.permissions : [];
      const members = Array.isArray(r.members) ? r.members : [];
      const initials = m => (m || '?').trim().charAt(0).toUpperCase();
      return `
      <div class="access-role-card sl-stagger" style="--i:${i}">
        <div class="access-role-head">
          <div class="access-role-name">
            ${esc(r.name)}
            ${r.is_system ? '<span class="access-role-tag">SYSTEM</span>' : ''}
          </div>
          ${r.is_system ? '' : `<button class="icon-btn icon-btn--danger" title="Hapus role" aria-label="Hapus role ${escAttr(r.name)}" onclick="adminDeleteRole('${escAttr(r.id)}','${escAttr(r.name)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>`}
        </div>
        ${r.description ? `<div class="access-role-desc">${esc(r.description)}</div>` : ''}
        ${members.length ? `<div class="access-role-members">
          ${members.slice(0, 5).map(m => `<span class="access-member-avatar" title="${escAttr(m)}">${esc(initials(m))}</span>`).join('')}
          <span class="access-role-members-label">${esc(members.join(', '))}</span>
        </div>` : ''}
        <div class="perm-chip-row">
          ${perms.length ? perms.map(p => `<span class="perm-chip">${esc(p)}</span>`).join('') : '<span class="perm-chip perm-chip--empty">Tidak ada permission</span>'}
        </div>
      </div>`;
    }).join('');
    const addForm = `
      <div class="access-role-card access-role-card--add">
        <div class="access-role-add-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Tambah Role</div>
        <input class="form-input" id="new-role-name" placeholder="Nama role (mis. Finance Admin)" style="margin-bottom:8px">
        <input class="form-input" id="new-role-perms" placeholder="Permission, pisah koma (Overview,Finance)" style="margin-bottom:10px">
        <button class="btn btn-primary btn-sm" onclick="adminAddRole()">Tambah Role</button>
      </div>`;
    roleEl.innerHTML = list + addForm;
  } catch (e) {
    roleEl.innerHTML = `<div style="font-size:13px;color:var(--text-muted);padding:8px 0">Gagal memuat role: ${esc(e.message || '')}</div>`;
  }
}

async function adminAddRole() {
  const name  = document.getElementById('new-role-name')?.value.trim();
  const perms = (document.getElementById('new-role-perms')?.value || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!name) { showToast('Nama role wajib diisi', 'error'); return; }
  try {
    await AdminAPI.createRole({ name, permissions: perms });
    showToast('Role ditambahkan ✅', 'success');
    renderAdminRoles();
  } catch (e) { showToast(e.message || 'Gagal menambah role', 'error'); }
}

function adminDeleteRole(id, name) {
  showConfirmModal({
    title: 'Hapus Role',
    message: `Hapus role "${name}"? Tindakan ini tidak bisa dibatalkan.`,
    confirmText: 'Hapus',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await AdminAPI.deleteRole(id);
        showToast('Role dihapus ✅', 'success');
        renderAdminRoles();
      } catch (e) { showToast(e.message || 'Gagal menghapus role', 'error'); }
    },
  });
}

async function adminSaveSettings() {
  const fee = parseFloat(document.getElementById('admin-fee')?.value || '0');
  const sla = parseInt(document.getElementById('admin-verif-sla')?.value || '0', 10);
  if (Number.isNaN(fee) || Number.isNaN(sla) || fee < 0 || sla < 1) {
    showToast('Nilai settings tidak valid', 'error');
    return;
  }

  const btn = document.getElementById('admin-settings-save-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  try {
    await AdminAPI.updateSettings({ platform_fee: fee, verification_sla_days: sla });
    ADMIN_SETTINGS.fee      = fee;
    ADMIN_SETTINGS.verifSla = sla;
    ADMIN_AUDIT_LOGS.unshift({ who: 'Super Admin', action: `Ubah settings: fee ${fee}% / verifikasi ${sla} hari`, at: new Date() });
    renderAdminSettings();
    showToast('Pengaturan berhasil disimpan ke server ✅', 'success');
  } catch (error) {
    showToast(error.message || 'Gagal menyimpan settings', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

/* ================================================================
   PORTFOLIO HELPER
   ================================================================ */
async function renderPortfolio() {
  const grid = document.getElementById('portfolio-projects');
  if (!grid) return;

  try {
    const res       = await ContractsAPI.getMyContracts();
    const contracts = (res.data || []).filter(c => c.status === 'completed');

    if (!contracts.length) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-title">Belum ada portfolio</div><p class="empty-state-desc">Selesaikan project untuk menambah portfolio kamu!</p></div>`;
      return;
    }

    grid.innerHTML = contracts.map((c) => {
      const p = c.projects || {};
      return `
        <div class="project-card" style="cursor:default">
          <div class="pc-header">${tierBadge(p.tier || 'pemula')}<span class="badge badge-teal" style="font-size:10px">✅ Selesai</span></div>
          <div class="pc-title">${p.title || 'Project'}</div>
          <div class="pc-biz">${p.users?.full_name || 'Klien'}</div>
          <div class="pc-meta">${p.category || ''}</div>
          <div class="pc-budget">${fmtRange(p.budget_min || 0, p.budget_max || 0)}</div>
        </div>`;
    }).join('');
  } catch (e) {
    const cached = (window._cachedProjects || []).slice(0, 6);
    if (cached.length) {
      grid.innerHTML = cached.map((p, i) => buildProjectCard(p, i)).join('');
    } else {
      grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-title">Gagal memuat portfolio</div></div>`;
    }
  }
}

async function _updatePortfolioHero() {
  try {
    const res  = await UsersAPI.getMe();
    const user = res.data || {};

    // Nama, universitas, avatar
    const nameEl = document.getElementById('portfolio-name');
    if (nameEl) nameEl.textContent = user.full_name || 'Mahasiswa';

    const uniEl = document.getElementById('portfolio-uni');
    if (uniEl) {
      const parts = [user.university, user.major].filter(Boolean);
      uniEl.textContent = parts.length ? parts.join(' · ') : '—';
    }

    const avatarEl = document.getElementById('portfolio-avatar');
    if (avatarEl) {
      if (user.avatar_url) {
        avatarEl.innerHTML = `<img src="${escAttr(user.avatar_url)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover">`;
      } else {
        avatarEl.textContent = (user.full_name || 'M').charAt(0).toUpperCase();
      }
    }

    // Tier badge
    const tier      = user.tier || 'pemula';
    const tierLabel = tier === 'mahir' ? '🔥 Mahir' : tier === 'menengah' ? '⚡ Menengah' : '🌱 Pemula';
    const tierClass = tier === 'mahir' ? 'badge-accent' : tier === 'menengah' ? 'badge-amber' : 'badge-teal';
    const tierBadgeEl = document.getElementById('portfolio-tier-badge');
    if (tierBadgeEl) {
      tierBadgeEl.className = `badge ${tierClass}`;
      tierBadgeEl.textContent = tierLabel;
    }

    // Rating badge
    const ratingBadge = document.getElementById('portfolio-rating-badge');
    if (ratingBadge) {
      if (user.rating_avg && Number(user.rating_avg) > 0) {
        ratingBadge.textContent = `⭐ ${parseFloat(user.rating_avg).toFixed(1)} Rating`;
        ratingBadge.style.display = '';
      } else {
        ratingBadge.style.display = 'none';
      }
    }

    // Project selesai badge
    const projBadge = document.getElementById('portfolio-projects-badge');
    if (projBadge) {
      const total = user.total_projects || 0;
      if (total > 0) {
        projBadge.textContent = `${total} Project Selesai`;
        projBadge.style.display = '';
      } else {
        projBadge.style.display = 'none';
      }
    }

    // Fetch total earnings dari payments
    let totalEarned = 0;
    try {
      const payRes   = await PaymentsAPI.getMyPayments();
      const payments = payRes.data || [];
      totalEarned    = payments
        .filter(p => p.status === 'released')
        .reduce((s, p) => s + (p.net_amount || p.amount || 0), 0);
    } catch (_) {}

    // Stat cards
    const setStat = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setStat('portfolio-stat-projects', user.total_projects || 0);
    setStat('portfolio-stat-earned', `Rp ${Number(totalEarned).toLocaleString('id-ID')}`);
    setStat('portfolio-stat-rating', user.rating_avg ? `${parseFloat(user.rating_avg).toFixed(1)}★` : '—');

    // Completion rate (placeholder — backend belum ada field ini)
    setStat('portfolio-stat-completion', user.total_projects > 0 ? '100%' : '—');

    // Skills
    const skillsEl = document.getElementById('portfolio-skills');
    if (skillsEl) {
      if (user.skills?.length) {
        skillsEl.innerHTML = user.skills.map(s =>
          `<span class="skill-tag" style="padding:6px 14px;font-size:13px">${esc(s)}</span>`
        ).join('');
      } else {
        skillsEl.innerHTML = `<span style="font-size:12px;color:var(--text-muted)">Belum ada skill — tambahkan via Edit Profil</span>`;
      }
    }
  } catch (e) {
    console.warn('[portfolio hero]', e.message);
  }
}

async function _updatePaymentSummary() {
  try {
    const res      = await PaymentsAPI.getMyPayments();
    const payments = res.data || [];

    const released = payments.filter(p => p.status === 'released').reduce((s, p) => s + (p.net_amount || 0), 0);
    const held     = payments.filter(p => p.status === 'held').reduce((s, p) => s + (p.net_amount || 0), 0);
    const total    = released + held;

    const fmtRp = n => `Rp ${n.toLocaleString('id-ID')}`;

    const summaryEls = document.querySelectorAll('#screen-payment-history [style*="font-size:20px"]');
    if (summaryEls[0]) summaryEls[0].textContent = fmtRp(released);
    if (summaryEls[1]) summaryEls[1].textContent = fmtRp(held);
    if (summaryEls[2]) summaryEls[2].textContent = fmtRp(total);
  } catch (e) {
    console.warn('[payment summary]', e.message);
  }
}

/* ================================================================
   DISPUTE MEDIATION OPENER
   ================================================================ */
function openDisputeMediation(disputeId) {
  const chat = ensureMediationChat(disputeId, getCurrentRole());
  if (chat) openChatRoom(chat.id);
}

/* ================================================================
   ROUTE HOOKS
   ================================================================ */
const _routeHooks = {
  'screen-notifications':      () => renderNotifications(),
  'screen-verification':       () => onEnterVerification(),
  'screen-chat-list':          () => renderChatList(),
  'screen-admin':              () => { onEnterAdmin(); if (typeof refreshNotifBadge === 'function') refreshNotifBadge(); },
  'screen-student':            () => { if (typeof refreshNotifBadge === 'function') refreshNotifBadge(); },
  'screen-business':           () => { if (typeof refreshNotifBadge === 'function') refreshNotifBadge(); },
  'screen-portfolio':          () => { renderPortfolio(); _updatePortfolioHero(); },
  'screen-payment-history':    () => { renderPaymentHistory(); _updatePaymentSummary(); },
  'screen-dispute-list':       () => renderDisputeList(),
  'screen-help':               () => renderFAQ(),
  'screen-public-profile':     () => loadPublicProfile(window._publicProfileId || null),
  'screen-deliverable-upload': () => {
    delivFiles.length = 0;
    renderDelivFiles();
    if (!window._currentContract && window.currentContractId) {
      ContractsAPI.getMyContracts().then(res => {
        const c = (res.data || []).find(x => x.id === window.currentContractId);
        if (c) window._currentContract = c;
      }).catch(() => {});
    }
  },
  'screen-contract-detail':    () => loadContractDetail(window.currentContractId || null),
  'screen-bank-account':       () => renderBankAccounts(),
  'screen-edit-profile':       () => onEnterEditProfile(),
  'screen-new-dispute':        () => { /* populated by openNewDispute() */ },
};
window._routeHooks = _routeHooks;

/* ================================================================
   BOOTSTRAP
   ================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(state.theme);

  // ── Xendit payment redirect handler ────────────────────────
  // Xendit redirect ke /payment/result?status=success&payment_id=...
  // setelah user bayar. Kita render UI khusus + force sync.
  if (window.location.pathname === '/payment/result') {
    if (typeof renderPaymentResult === 'function') {
      // Pastikan ada container DOM untuk renderPaymentResult
      let container = document.getElementById('payment-result-content');
      if (!container) {
        container = document.createElement('div');
        container.id = 'payment-result-content';
        container.style.cssText =
          'position:fixed;inset:0;background:var(--bg-primary);z-index:99999;overflow-y:auto';
        document.body.appendChild(container);
      }
      try { await renderPaymentResult(); } catch (e) { console.error(e); }
      // Stop bootstrap supaya app screen lain tidak muncul di belakang
      return;
    }
  }

  // ── Deep link handlers: email verification & password reset ──
  // Dipanggil DULU sebelum auth check. Kalau URL berisi token verify
  // atau reset, langsung route ke screen yang sesuai dan stop bootstrap.
  if (typeof handleEmailVerifyDeepLink === 'function') {
    try {
      if (await handleEmailVerifyDeepLink()) return;
    } catch (_) {}
  }
  if (typeof handlePasswordResetDeepLink === 'function') {
    try {
      if (await handlePasswordResetDeepLink()) return;
    } catch (_) {}
  }

  if (TokenManager.get() && TokenManager.getRefresh()) {
    _scheduleProactiveRefresh();
    // User sudah login (refresh page) — connect WS + pasang notif listener
    if (typeof SocketManager !== 'undefined') {
      try { SocketManager.connect(); } catch (_) {}
    }
    if (typeof initNotifWebsocket === 'function') {
      try { initNotifWebsocket(); } catch (_) {}
    }
    if (typeof refreshNotifBadge === 'function') {
      try { refreshNotifBadge(); } catch (_) {}
    }
  }

  const initial = _screenFromLocation();
  if (initial) {
    _showScreen(initial, { fromHistory: true });
    try { history.replaceState({ screen: initial }, '', `#${initial}`); } catch {}
  } else {
    try { history.replaceState({ screen: 'screen-landing' }, '', '#screen-landing'); } catch {}
  }

  const minDate   = new Date().toISOString().split('T')[0];
  const applyDate = document.getElementById('apply-date');
  if (applyDate) applyDate.min = minDate;
  const ppDeadline = document.getElementById('pp-deadline');
  if (ppDeadline) ppDeadline.min = minDate;

  document.querySelectorAll('#ob-dots .onboarding-dot').forEach(d => {
    d.addEventListener('click', () => obGo(parseInt(d.dataset.i)));
  });

  let tsX = 0;
  const obSlides = document.querySelector('.onboarding-slides');
  if (obSlides) {
    obSlides.addEventListener('touchstart', e => { tsX = e.touches[0].clientX; }, { passive: true });
    obSlides.addEventListener('touchend', e => {
      const dx    = tsX - e.changedTouches[0].clientX;
      const total = document.querySelectorAll('.onboarding-slide').length;
      if (Math.abs(dx) > 50) {
        if (dx > 0 && state.obPage < total - 1) obGo(state.obPage + 1);
        else if (dx < 0 && state.obPage > 0)   obGo(state.obPage - 1);
      }
    }, { passive: true });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (typeof closeApplyModal === 'function')      closeApplyModal();
      if (typeof closeUnverifiedModal === 'function') closeUnverifiedModal();
    }
  });

  // ── Auto-refresh setelah user balik dari tab pembayaran Xendit ──
  // Saat user bayar di tab baru lalu kembali ke tab aplikasi, kita
  // sync status payment ke backend + refresh dashboard otomatis,
  // jadi user tidak perlu reload manual.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const pending = window._pendingPaymentCheck;
    if (!pending) return;

    // Hanya proses kalau invoice dibuka < 30 menit lalu (hindari stale)
    if (Date.now() - pending.openedAt > 30 * 60 * 1000) {
      window._pendingPaymentCheck = null;
      return;
    }

    try {
      // Sync status payment ke backend (kalau punya payment_id)
      if (pending.paymentId && typeof PaymentsAPI?.syncPayment === 'function') {
        const sync = await PaymentsAPI.syncPayment(pending.paymentId);
        const status = sync?.data?.status;
        if (status === 'held') {
          showToast('✅ Pembayaran terkonfirmasi! Dana masuk escrow.', 'success');
          window._pendingPaymentCheck = null;
        } else if (status === 'expired' || status === 'failed') {
          showToast('⚠️ Pembayaran ' + status + '. Silakan coba lagi.', 'info');
          window._pendingPaymentCheck = null;
        }
        // kalau masih pending, biarkan flag supaya cek lagi saat balik tab
      }

      // Refresh dashboard sesuai role aktif
      const user = TokenManager.getUser();
      if (user?.role === 'bisnis' && typeof onEnterBusiness === 'function') {
        await onEnterBusiness();
      } else if (user?.role === 'mahasiswa' && typeof onEnterStudent === 'function') {
        await onEnterStudent();
      }
      // Refresh notif badge
      if (typeof refreshNotifBadge === 'function') refreshNotifBadge();
    } catch (e) {
      console.warn('[auto-refresh payment]', e?.message);
    }
  });
});

/* ================================================================
   GLOBAL EXPORTS
   ================================================================ */
window.showToast               = showToast;
window.goTo                    = goTo;
window.handleLogout            = handleLogout;
window.openReviewScreen        = openReviewScreen;
window.submitNewDispute        = submitNewDispute;
window.onDisputeEvidenceChange = onDisputeEvidenceChange;
window.refreshNotifBadge       = refreshNotifBadge;
window.renderAdminSettings     = renderAdminSettings;
window.adminSaveSettings       = adminSaveSettings;
window.renderAdminRoles        = renderAdminRoles;
window.adminAddRole            = adminAddRole;
window.adminDeleteRole         = adminDeleteRole;
window.renderPortfolio         = renderPortfolio;
window.openDisputeMediation    = openDisputeMediation;
window._updatePortfolioHero    = _updatePortfolioHero;
window._updatePaymentSummary   = _updatePaymentSummary;