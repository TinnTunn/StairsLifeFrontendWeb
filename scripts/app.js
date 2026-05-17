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
  if (roleEl) {
    roleEl.innerHTML = ADMIN_ROLES.map(r => `
      <div class="card card-p-md" style="margin-bottom:8px;border:1px solid var(--border)">
        <div style="font-size:14px;font-weight:700">${r.name}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Anggota: ${r.members.join(', ')}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px">${r.permissions.join(' • ')}</div>
      </div>`).join('');
  }
  if (auditEl) {
    auditEl.innerHTML = ADMIN_AUDIT_LOGS.slice(0, 20).map(l => `
      <div class="admin-feed-item">
        <div class="admin-feed-dot"></div>
        <div style="flex:1">
          <div class="admin-feed-title">${l.who}</div>
          <div class="admin-feed-sub">${l.action}</div>
          <div class="admin-feed-time">${fmtRelative(l.at)}</div>
        </div>
      </div>`).join('');
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

    const nameEl = document.querySelector('#screen-portfolio [style*="font-size:22px"]');
    if (nameEl) nameEl.textContent = user.full_name || 'Mahasiswa';

    const uniEl = document.querySelector('#screen-portfolio [style*="rgba(255,255,255,0.7)"]');
    if (uniEl) uniEl.textContent = `${user.university || ''} · ${user.major || ''}`;

    const avatarEl = document.querySelector('#screen-portfolio [style*="border-radius:50%"][style*="font-size:32px"]');
    if (avatarEl) avatarEl.textContent = (user.full_name || 'M').charAt(0).toUpperCase();

    const tier      = user.tier || 'pemula';
    const tierLabel = tier === 'mahir' ? '🔥 Mahir' : tier === 'menengah' ? '⚡ Menengah' : '🌱 Pemula';
    const tierClass = tier === 'mahir' ? 'badge-accent' : tier === 'menengah' ? 'badge-amber' : 'badge-teal';

    const badgesEl = document.querySelector('#screen-portfolio .flex-wrap');
    if (badgesEl) {
      badgesEl.innerHTML = `
        <span class="badge ${tierClass}">${tierLabel}</span>
        <span class="badge badge-accent">⭐ ${user.rating_avg ? parseFloat(user.rating_avg).toFixed(1) : '0.0'} Rating</span>
        <span class="badge badge-gray" style="background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.8)">${user.total_projects || 0} Project Selesai</span>`;
    }

    // Fetch payments DULU sebelum forEach — await tidak boleh di dalam forEach
    let totalEarned = 0;
    try {
      const payRes   = await PaymentsAPI.getMyPayments();
      const payments = payRes.data || [];
      totalEarned    = payments
        .filter(p => p.status === 'released')
        .reduce((s, p) => s + (p.net_amount || p.amount || 0), 0);
    } catch (_) {}

    const statCards = document.querySelectorAll('#screen-portfolio .stat-card');
    statCards.forEach(card => {
      const label = card.querySelector('.stat-card-label')?.textContent || '';
      const valEl = card.querySelector('.stat-card-value');
      if (!valEl) return;
      if (label.includes('Project Selesai')) valEl.textContent = user.total_projects || 0;
      if (label.includes('Rating'))          valEl.textContent = user.rating_avg ? `${parseFloat(user.rating_avg).toFixed(1)}★` : '0.0★';
      if (label.includes('Earned') || label.includes('Total Earned')) {
        valEl.textContent = `Rp ${totalEarned.toLocaleString('id-ID')}`;
      }
    });

    if (user.skills?.length) {
      const skillsEl = document.querySelector('#screen-portfolio .card [style*="gap:8px"]');
      if (skillsEl) {
        skillsEl.innerHTML = user.skills.map(s =>
          `<span class="skill-tag" style="padding:6px 14px;font-size:13px">${s}</span>`
        ).join('');
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
  'screen-admin':              () => onEnterAdmin(),
  'screen-portfolio':          () => { renderPortfolio(); _updatePortfolioHero(); },
  'screen-payment-history':    () => { renderPaymentHistory(); _updatePaymentSummary(); },
  'screen-dispute-list':       () => renderDisputeList(),
  'screen-help':               () => renderFAQ(),
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
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(state.theme);

  if (TokenManager.get() && TokenManager.getRefresh()) {
    _scheduleProactiveRefresh();
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
window.renderPortfolio         = renderPortfolio;
window.openDisputeMediation    = openDisputeMediation;
window._updatePortfolioHero    = _updatePortfolioHero;
window._updatePaymentSummary   = _updatePaymentSummary;