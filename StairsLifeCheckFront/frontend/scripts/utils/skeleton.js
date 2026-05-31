/**
 * StairsLife — utils/skeleton.js
 * Skeleton loading state templates.
 * Setiap fungsi mengembalikan HTML string yang cocok dengan
 * shape card aslinya, lalu diganti saat data tiba.
 *
 * Pola pemakaian:
 *   el.innerHTML = skeletons.projectCards(4);    // tampil
 *   el.innerHTML = realContent;                  // replace
 *
 * Phase 4 — Skeleton Loading States.
 */
'use strict';

/* ================================================================
   HELPER
   ================================================================ */
function _repeat(html, n) {
  return Array.from({ length: n }, () => html).join('');
}

/* ================================================================
   TEMPLATES
   ================================================================ */

/**
 * Kartu project (grid browse / home) — cocok dengan .project-card
 */
function skProjectCard() {
  return `
  <div class="sk-card" style="border-radius:var(--radius-md)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div class="sk-box sk-badge"></div>
      <div class="sk-box sk-badge" style="width:48px"></div>
    </div>
    <div class="sk-box sk-line sk-line-w80"></div>
    <div class="sk-box sk-line sk-line-w50" style="margin-bottom:14px"></div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <div class="sk-box sk-circle" style="width:28px;height:28px"></div>
      <div class="sk-box sk-line-sm sk-line-w50" style="margin:0;flex:1"></div>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:14px">
      <div class="sk-box sk-badge" style="width:60px"></div>
      <div class="sk-box sk-badge" style="width:72px"></div>
      <div class="sk-box sk-badge" style="width:54px"></div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div class="sk-box sk-line-sm sk-line-w30" style="margin:0"></div>
      <div class="sk-box sk-line-sm" style="width:80px;margin:0"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <div class="sk-box sk-btn" style="flex:2"></div>
      <div class="sk-box sk-btn" style="flex:1"></div>
    </div>
  </div>`;
}

/**
 * Lamaran masuk (bisnis incoming / student applications)
 * — cocok dengan .incoming-card / .application-card
 */
function skApplicationCard() {
  return `
  <div class="sk-card">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div class="sk-box sk-circle" style="width:44px;height:44px"></div>
      <div style="flex:1">
        <div class="sk-box sk-line sk-line-w50"></div>
        <div class="sk-box sk-line-sm sk-line-w30"></div>
      </div>
      <div class="sk-box sk-badge"></div>
    </div>
    <div class="sk-box sk-line sk-line-full"></div>
    <div class="sk-box sk-line sk-line-w80"></div>
    <div class="sk-box sk-line-sm sk-line-w40" style="width:40%;margin-bottom:12px"></div>
    <div style="display:flex;gap:8px">
      <div class="sk-box sk-btn" style="flex:1"></div>
      <div class="sk-box sk-btn" style="flex:1"></div>
    </div>
  </div>`;
}

/**
 * Notifikasi — cocok dengan .notif-item
 */
function skNotifItem() {
  return `
  <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid var(--divider)">
    <div class="sk-box sk-circle" style="width:40px;height:40px;flex-shrink:0"></div>
    <div style="flex:1">
      <div class="sk-box sk-line sk-line-w70"></div>
      <div class="sk-box sk-line-sm sk-line-w50"></div>
      <div class="sk-box sk-line-sm" style="width:60px;margin-top:6px"></div>
    </div>
  </div>`;
}

/**
 * Admin verifikasi card — cocok dengan .admin-verif-card
 */
function skVerifCard() {
  return `
  <div class="sk-card" style="border-left:4px solid var(--border)">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <div class="sk-box sk-circle" style="width:48px;height:48px"></div>
      <div style="flex:1">
        <div class="sk-box sk-line sk-line-w50"></div>
        <div class="sk-box sk-line-sm sk-line-w70"></div>
        <div class="sk-box sk-line-sm sk-line-w40" style="width:40%"></div>
      </div>
      <div class="sk-box sk-badge"></div>
    </div>
    <div class="sk-box sk-line sk-line-full" style="height:40px;border-radius:var(--radius-sm);margin-bottom:12px"></div>
    <div style="display:flex;gap:10px">
      <div class="sk-box sk-btn" style="flex:1"></div>
      <div class="sk-box sk-btn" style="flex:2"></div>
    </div>
  </div>`;
}

/**
 * Admin dispute / dispute list card
 */
function skDisputeCard() {
  return `
  <div class="sk-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div class="sk-box sk-line sk-line-w70" style="margin:0"></div>
      <div class="sk-box sk-badge"></div>
    </div>
    <div class="sk-box sk-line-sm sk-line-w50" style="margin-bottom:6px"></div>
    <div class="sk-box sk-line-sm sk-line-w30"></div>
  </div>`;
}

/**
 * Project aktif mahasiswa — cocok dengan .active-proj-card
 */
function skActiveProjectCard() {
  return `
  <div class="sk-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div class="sk-box sk-line sk-line-w60" style="width:60%;margin:0"></div>
      <div class="sk-box sk-badge"></div>
    </div>
    <div class="sk-box sk-line-sm sk-line-w50" style="margin-bottom:14px"></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
      <div class="sk-box sk-line-sm" style="width:120px;margin:0"></div>
      <div class="sk-box sk-line-sm" style="width:36px;margin:0"></div>
    </div>
    <div class="sk-box" style="height:6px;border-radius:4px;width:100%;margin-bottom:12px"></div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div class="sk-box sk-line-sm" style="width:140px;margin:0"></div>
      <div class="sk-box sk-btn" style="width:100px"></div>
    </div>
  </div>`;
}

/**
 * Admin user row — cocok dengan card di admin-users-list
 */
function skAdminUserRow() {
  return `
  <div class="sk-card" style="display:flex;align-items:center;gap:14px;padding:12px 16px">
    <div class="sk-box sk-circle" style="width:44px;height:44px"></div>
    <div style="flex:1">
      <div class="sk-box sk-line sk-line-w50"></div>
      <div class="sk-box sk-line-sm sk-line-w70"></div>
    </div>
    <div class="sk-box sk-badge"></div>
    <div class="sk-box sk-btn" style="width:72px"></div>
  </div>`;
}

/**
 * Admin announcement item
 */
function skAnnouncementItem() {
  return `
  <div class="sk-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div class="sk-box sk-line sk-line-w50" style="margin:0"></div>
      <div class="sk-box sk-badge"></div>
    </div>
    <div class="sk-box sk-line sk-line-full"></div>
    <div class="sk-box sk-line-sm sk-line-w30"></div>
  </div>`;
}

/**
 * Admin project row (tabel)
 */
function skAdminProjectRow() {
  return `
  <div style="display:flex;align-items:center;gap:16px;padding:12px 16px;border-bottom:1px solid var(--divider)">
    <div class="sk-box sk-line sk-line-w50" style="flex:3;margin:0"></div>
    <div class="sk-box sk-line-sm" style="flex:2;margin:0"></div>
    <div class="sk-box sk-badge" style="flex:1"></div>
    <div class="sk-box sk-line-sm" style="width:90px;margin:0"></div>
  </div>`;
}

/* ================================================================
   PUBLIC API — fungsi plural yang mengembalikan N skeleton cards
   ================================================================ */
const skeletons = {
  /** N project cards untuk grid browse / home */
  projectCards:     (n = 4) => _repeat(skProjectCard(), n),

  /** N application cards */
  applicationCards: (n = 3) => _repeat(skApplicationCard(), n),

  /** N notification items */
  notifItems:       (n = 5) => _repeat(skNotifItem(), n),

  /** N admin verifikasi cards */
  verifCards:       (n = 3) => _repeat(skVerifCard(), n),

  /** N dispute cards */
  disputeCards:     (n = 3) => _repeat(skDisputeCard(), n),

  /** N active project cards (mahasiswa) */
  activeProjectCards: (n = 2) => _repeat(skActiveProjectCard(), n),

  /** N admin user rows */
  adminUserRows:    (n = 5) => _repeat(skAdminUserRow(), n),

  /** N announcement items */
  announcementItems:(n = 3) => _repeat(skAnnouncementItem(), n),

  /** N admin project rows */
  adminProjectRows: (n = 6) => _repeat(skAdminProjectRow(), n),
};

/* ================================================================
   EXPORTS
   ================================================================ */
window.skeletons = skeletons;
