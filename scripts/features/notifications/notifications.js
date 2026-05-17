/**
 * StairsLife — features/notifications/notifications.js
 * renderNotifications, markNotifRead, markAllNotifRead, refreshNotifBadge.
 * Depends on: NotificationsAPI, showToast, timeAgo (api.js).
 * Phase 3 — Modularisasi.
 */
'use strict';

async function renderNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  list.innerHTML = skeletons.notifItems(5);

  try {
    const res   = await NotificationsAPI.getAll();
    const items = (res.data || []).slice();

    const markBtn = document.getElementById('mark-all-read-btn');
    const unread  = items.filter(n => !n.read_at && !n.is_read).length;
    if (markBtn) markBtn.style.display = unread > 0 ? '' : 'none';

    if (!items.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔔</div>
          <div class="empty-state-title">Belum ada notifikasi</div>
          <p class="empty-state-desc">Notifikasi akan muncul di sini saat ada aktivitas baru.</p>
        </div>`;
      return;
    }

    list.innerHTML = items.map(n => {
      const isRead = !!(n.read_at || n.is_read);
      const ts     = n.created_at || n.time || new Date();
      return `
        <div class="card card-p-md" style="margin-bottom:8px;border-left:3px solid ${isRead ? 'var(--border)' : 'var(--accent)'};${isRead ? 'opacity:.75' : ''}" onclick="markNotifRead('${n.id}')">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
            <span style="font-size:14px;font-weight:700">${n.title || 'Notifikasi'}</span>
            ${isRead ? '' : '<span class="badge badge-accent" style="font-size:10px">Baru</span>'}
          </div>
          <div style="font-size:13px;color:var(--text-secondary)">${n.body || n.message || ''}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px">${timeAgo(ts)}</div>
        </div>`;
    }).join('');
  } catch (error) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔔</div>
        <div class="empty-state-title">Belum ada notifikasi</div>
        <p class="empty-state-desc">Notifikasi akan muncul di sini saat ada aktivitas baru.</p>
      </div>`;
    const markBtn = document.getElementById('mark-all-read-btn');
    if (markBtn) markBtn.style.display = 'none';
  }
}

async function markNotifRead(id) {
  if (!id) return;
  try {
    await NotificationsAPI.markRead(id);
    await renderNotifications();
  } catch (error) {
    console.warn('[markNotifRead]', error.message);
  }
}

async function markAllNotifRead() {
  try {
    await NotificationsAPI.markAllRead();
    showToast('Semua notifikasi ditandai dibaca ✅', 'success');
    await renderNotifications();
  } catch (error) {
    showToast(error.message || 'Gagal menandai notifikasi', 'error');
  }
}

async function refreshNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  try {
    const res   = await NotificationsAPI.getUnreadCount();
    const count = res.data?.count ?? 0;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  } catch (_e) {
    badge.style.display = 'none';
  }
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.renderNotifications = renderNotifications;
window.markNotifRead       = markNotifRead;
window.markAllNotifRead    = markAllNotifRead;
window.refreshNotifBadge   = refreshNotifBadge;
