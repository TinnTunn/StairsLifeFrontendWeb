/**
 * StairsLife — features/admin/support.js
 * FIXED: unsuspend, lihat chat support per user, admin reply
 */
'use strict';

const getAdminSupportView = () =>
  (typeof adminSupportView !== 'undefined' ? adminSupportView : { status: 'all', q: '' });

function adminSetSupportFilter(status, btn) {
  getAdminSupportView().status = status;
  document.querySelectorAll('#admin-support-chips .filter-chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  renderAdminSupportInbox();
}

function adminFilterSupportTickets() {
  getAdminSupportView().q = (document.getElementById('admin-support-search')?.value || '').trim().toLowerCase();
  renderAdminSupportInbox();
}

async function renderAdminSupportInbox() {
  const listEl = document.getElementById('admin-support-list');
  if (!listEl) return;

  listEl.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted)">Memuat...</div>`;

  try {
    const [mhsRes, bizRes] = await Promise.all([
      AdminAPI.getUsers('mahasiswa'),
      AdminAPI.getUsers('bisnis'),
    ]);

    let allUsers = [
      ...(mhsRes.data || []),
      ...(bizRes.data || []),
    ];

    const q            = getAdminSupportView().q.toLowerCase();
    const statusFilter = getAdminSupportView().status;

    if (q) {
      allUsers = allUsers.filter(u =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }

    const suspendedUsers = allUsers.filter(u => u.is_suspended);
    const activeUsers    = allUsers.filter(u => !u.is_suspended);

    let displayUsers = allUsers;
    if (statusFilter === 'suspended' || statusFilter === 'open') {
      displayUsers = suspendedUsers;
    } else if (statusFilter === 'resolved' || statusFilter === 'inProgress') {
      displayUsers = activeUsers;
    }

    if (!displayUsers.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-title">Tidak ada user ditemukan</div></div>`;
      return;
    }

    let html = '';

    if (suspendedUsers.length && statusFilter === 'all') {
      html += `
        <div style="font-size:13px;font-weight:700;color:var(--rose);margin-bottom:10px;display:flex;align-items:center;gap:6px;padding:10px 12px;background:var(--rose-light,#fef2f2);border-radius:var(--radius-md)">
          🚫 User Suspended (${suspendedUsers.length}) — Perlu perhatian admin
        </div>
        ${suspendedUsers.map(u => renderSupportUserCard(u)).join('')}
        <div style="height:1px;background:var(--divider);margin:16px 0"></div>
        <div style="font-size:13px;font-weight:700;color:var(--text-secondary);margin-bottom:10px">
          👥 Semua Pengguna Aktif
        </div>
        ${activeUsers.map(u => renderSupportUserCard(u)).join('')}`;
    } else {
      html = displayUsers.map(u => renderSupportUserCard(u)).join('');
    }

    listEl.innerHTML = html;

  } catch (e) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat</div><p class="empty-state-desc">${esc(e.message)}</p></div>`;
  }
}

function renderSupportUserCard(u) {
  const name      = u.full_name || '-';
  const role      = u.role === 'mahasiswa' ? '🎓 Mahasiswa' : '🏢 Bisnis';
  const avatar    = name.charAt(0).toUpperCase();
  const suspended = !!u.is_suspended;
  const roomId    = `support-${u.id}`;

  return `
  <div class="card card-p-md" style="margin-bottom:10px;display:flex;align-items:flex-start;gap:14px;${suspended ? 'border-left:3px solid var(--rose)' : ''}">
    <div style="width:44px;height:44px;border-radius:50%;background:${suspended ? 'var(--rose-light,#fef2f2)' : 'var(--accent-light)'};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:${suspended ? 'var(--rose)' : 'var(--accent)'};flex-shrink:0">${esc(avatar)}</div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
        <span style="font-size:14px;font-weight:700">${esc(name)}</span>
        ${suspended ? `<span class="badge badge-rose" style="font-size:11px">🚫 Suspended</span>` : `<span class="badge badge-teal" style="font-size:11px">✅ Aktif</span>`}
        <span class="badge badge-gray" style="font-size:11px">${role}</span>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:2px">${esc(u.email || '')}</div>
      ${suspended && u.suspension_reason ? `
      <div style="font-size:11px;color:var(--rose);padding:4px 8px;background:var(--rose-light,#fef2f2);border-radius:6px;margin-top:4px;display:inline-block">
        ⚠️ Alasan: ${esc(u.suspension_reason)}
      </div>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
      <button class="btn btn-ghost btn-sm"
        onclick="openAdminSupportChat('${escAttr(roomId)}', '${escAttr(name)}')">
        💬 Lihat Chat
      </button>
      ${suspended ? `
      <button class="btn btn-primary btn-sm" id="unsuspend-btn-${escAttr(u.id)}"
        onclick="adminUnsuspendUser('${escAttr(u.id)}', this)">
        🔓 Aktifkan
      </button>` : `
      <button class="btn btn-danger btn-sm"
        onclick="adminToggleSuspendUser('${escAttr(u.id)}', false)">
        🚫 Suspend
      </button>`}
    </div>
  </div>`;
}

const _adminUnsuspendInFlight = new Set();
async function adminUnsuspendUser(userId, btn) {
  if (_adminUnsuspendInFlight.has(userId)) return;
  _adminUnsuspendInFlight.add(userId);
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  try {
    await AdminAPI.suspendUser(userId);
    showToast('Akun berhasil diaktifkan ✅', 'success');
    await renderAdminSupportInbox();
  } catch (e) {
    showToast(e.message || 'Gagal mengaktifkan akun', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🔓 Aktifkan'; }
  } finally {
    _adminUnsuspendInFlight.delete(userId);
  }
}

async function openAdminSupportChat(roomId, userName) {
  try {
    window._activeChatContractId = roomId;

    // Setup header
    const avatarEl = document.getElementById('chat-room-avatar');
    const nameEl   = document.getElementById('chat-room-name');
    const statusEl = document.getElementById('chat-room-status');
    const msgsEl   = document.getElementById('chat-messages');
    if (avatarEl) avatarEl.textContent = userName.charAt(0);
    if (nameEl)   nameEl.textContent   = `Support: ${userName}`;
    if (statusEl) statusEl.innerHTML   = `<span style="color:var(--teal)">● Support Chat</span>`;
    if (msgsEl)   msgsEl.innerHTML     = `<div style="text-align:center;padding:20px;color:var(--text-muted)">Memuat pesan...</div>`;

    goTo('screen-chat-room');

    // Load history dari backend
    let messages = [];
    try {
      const res = await apiFetch(`/chat/support-history/${roomId}`);
      messages  = res?.data || [];
    } catch (_) {}

    // Render pesan
    const currentUser = AuthAPI.getCurrentUser();
    if (msgsEl) {
      if (!messages.length) {
        msgsEl.innerHTML = `
          <div style="text-align:center;padding:40px 20px">
            <div style="font-size:36px;margin-bottom:12px">💬</div>
            <div style="font-size:14px;color:var(--text-secondary)">Belum ada pesan dari ${esc(userName)}</div>
          </div>`;
      } else {
        msgsEl.innerHTML = messages.map(m => {
          const isAdmin = m.sender_role === 'admin';
          const name    = m.sender?.full_name || (isAdmin ? 'Admin' : userName);
          const time    = new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          return `
            <div class="msg-row" style="align-items:${isAdmin ? 'flex-end' : 'flex-start'}">
              <div class="msg-bubble${isAdmin ? ' me' : ' them'}">
                ${!isAdmin ? `<div style="font-size:11px;font-weight:700;opacity:0.7;margin-bottom:4px">${esc(name)}</div>` : ''}
                ${esc(m.content)}
              </div>
              <div class="msg-time${isAdmin ? '' : ' them'}">${esc(time)}</div>
            </div>`;
        }).join('');
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
    }

    // Override send — admin reply via REST
    window._sendMessageOverride = async (text) => {
      const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      if (msgsEl) {
        // Hapus empty state jika ada
        if (msgsEl.querySelector('[style*="padding:40px"]')) msgsEl.innerHTML = '';
        const bubble = document.createElement('div');
        bubble.className = 'msg-row';
        bubble.style.alignItems = 'flex-end';
        // Pakai textContent untuk content user supaya tidak ada risiko XSS.
        const bubbleInner = document.createElement('div');
        bubbleInner.className = 'msg-bubble me';
        bubbleInner.textContent = text;
        const timeEl = document.createElement('div');
        timeEl.className = 'msg-time';
        timeEl.textContent = time;
        bubble.appendChild(bubbleInner);
        bubble.appendChild(timeEl);
        msgsEl.appendChild(bubble);
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
      try {
        await apiFetch(`/chat/support/${roomId}/reply`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ content: text }),
        });
      } catch (e) { console.warn('[admin reply]', e.message); }
    };

  } catch (e) {
    showToast('Gagal membuka chat: ' + e.message, 'error');
  }
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.adminSetSupportFilter     = adminSetSupportFilter;
window.adminFilterSupportTickets = adminFilterSupportTickets;
window.renderAdminSupportInbox   = renderAdminSupportInbox;
window.renderSupportUserCard     = renderSupportUserCard;
window.adminUnsuspendUser        = adminUnsuspendUser;
window.openAdminSupportChat      = openAdminSupportChat;