/**
 * StairsLife — features/notifications/notifications.js
 *
 * renderNotifications, markNotifRead, markAllNotifRead, refreshNotifBadge,
 * initNotifWebsocket.
 *
 * Notifikasi sekarang DB-persistent dengan push WebSocket real-time.
 * Saat ada `new_notification` dari server: badge update + toast popup.
 * Saat user di screen notif, list otomatis re-render.
 *
 * Depends on: NotificationsAPI, showToast, timeAgo (api.js), SocketManager.
 */
'use strict';

let _notifWsInitialized = false;

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
        <div class="card card-p-md" style="margin-bottom:8px;border-left:3px solid ${isRead ? 'var(--border)' : 'var(--accent)'};${isRead ? 'opacity:.75' : ''};cursor:pointer" onclick="onNotifClick('${escAttr(n.id)}', ${n.action_url ? `'${escAttr(n.action_url)}'` : 'null'})">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
            <span style="font-size:14px;font-weight:700">${esc(n.title || 'Notifikasi')}</span>
            ${isRead ? '' : '<span class="badge badge-accent" style="font-size:10px">Baru</span>'}
          </div>
          <div style="font-size:13px;color:var(--text-secondary);white-space:pre-wrap">${esc(n.body || n.message || '')}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px">${esc(timeAgo(ts))}</div>
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

/**
 * Klik notif: mark read + navigate ke action_url kalau ada.
 * action_url di FE adalah path internal (mis. "/contracts/abc-123").
 * Tidak semua action_url match route FE saat ini — fallback: tetap mark read
 * tapi tidak navigate.
 */
async function onNotifClick(id, actionUrl) {
  await markNotifRead(id);
  if (!actionUrl || typeof goTo !== 'function') return;

  // Navigasi role-aware ke screen/tab yang BENAR-BENAR ADA.
  // (Sebelumnya menuju screen-contracts/applications/profile/disputes yang
  //  tidak ada → klik notif tidak ke mana-mana.)
  const role = (typeof getCurrentRole === 'function') ? getCurrentRole() : 'student';
  const dash = role === 'biz' ? 'screen-business' : role === 'admin' ? 'screen-admin' : 'screen-student';
  const tab  = (i) => {
    if (role === 'student' && typeof switchStudentTab === 'function') switchStudentTab(i.student);
    else if (role === 'biz' && typeof switchBizTab === 'function') switchBizTab(i.biz);
  };

  if (actionUrl.startsWith('/contracts')) {
    goTo(dash); tab({ student: 3, biz: 1 });
  } else if (actionUrl.startsWith('/applications')) {
    goTo(dash); tab({ student: 2, biz: 2 });
  } else if (actionUrl.startsWith('/profile') || actionUrl.startsWith('/verification')) {
    if (role === 'student') { goTo('screen-student'); if (typeof switchStudentTab === 'function') switchStudentTab(4); }
    else if (role === 'biz') { goTo('screen-business'); if (typeof switchBizTab === 'function') switchBizTab(5); }
    else goTo('screen-settings');
  } else if (actionUrl.startsWith('/disputes')) {
    goTo('screen-dispute-list');
  } else if (actionUrl.startsWith('/wallet')) {
    goTo('screen-wallet');
  } else if (actionUrl.startsWith('/admin')) {
    goTo('screen-admin');
  } else {
    goTo(dash);
  }
}

async function markNotifRead(id) {
  if (!id) return;
  try {
    await NotificationsAPI.markRead(id);
    await renderNotifications();
    await refreshNotifBadge();
  } catch (error) {
    console.warn('[markNotifRead]', error.message);
  }
}

async function markAllNotifRead() {
  try {
    await NotificationsAPI.markAllRead();
    showToast('Semua notifikasi ditandai dibaca ✅', 'success');
    await renderNotifications();
    await refreshNotifBadge();
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
    _setBadge(count);
  } catch (_e) {
    badge.style.display = 'none';
  }
}

function _setBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

/**
 * Hook WebSocket listener supaya notif baru langsung update UI.
 * Dipanggil sekali setelah login berhasil (di auth.js / app.js).
 *
 * Idempotent — kalau dipanggil dua kali, listener tidak akan double.
 */
function initNotifWebsocket() {
  if (_notifWsInitialized) return;
  if (typeof SocketManager === 'undefined') {
    console.warn('[notif] SocketManager belum tersedia');
    return;
  }
  _notifWsInitialized = true;

  // Socket sudah di-connect oleh caller (handleLogin / app.js init).
  // JANGAN panggil SocketManager.connect() di sini — akan buat koneksi
  // kedua sebelum koneksi pertama selesai handshake (race condition).
  // Kalau karena suatu alasan socket belum connect, cukup pastikan connect
  // setelah delay singkat supaya tidak override koneksi yang sedang berjalan.
  if (!SocketManager.isConnected()) {
    setTimeout(() => SocketManager.connect(), 100);
  }

  // Listener: notif baru masuk
  SocketManager.onNotification((notif) => {
    // 1. Toast popup ringkas (tap tidak ada — biar tidak ganggu)
    const title = notif.title || 'Notifikasi baru';
    const body  = notif.body  || '';
    showToast(`${title}${body ? ' — ' + body.slice(0, 60) : ''}`, 'info');

    // 2. Update badge: increment 1 (atau ambil count terbaru)
    refreshNotifBadge();

    // 3. Kalau user sedang lihat screen notif, re-render list
    const notifScreen = document.getElementById('screen-notifications');
    if (notifScreen && notifScreen.classList.contains('active')) {
      renderNotifications();
    }
  });

  // Listener: count update (mis. setelah markAllRead di device lain)
  SocketManager.onUnreadCount((data) => {
    _setBadge(data?.count ?? 0);
  });

  console.debug('[notif] WebSocket listener terpasang');
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.renderNotifications = renderNotifications;
window.markNotifRead       = markNotifRead;
window.markAllNotifRead    = markAllNotifRead;
window.refreshNotifBadge   = refreshNotifBadge;
window.initNotifWebsocket  = initNotifWebsocket;
window.onNotifClick        = onNotifClick;
