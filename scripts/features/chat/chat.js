/**
 * StairsLife — features/chat/chat.js
 * openChatRoom, sendChatMessage, renderChatList, ensureSupportChat,
 * ensureMediationChat, openSupportChat, loadContractChatRoom.
 * Depends on: MessagesAPI, AuthAPI, CHATS, CHAT_MESSAGES, USER_PROFILES,
 *             DISPUTES, ADMIN_DISPUTES, showToast, goTo, fmtRelative.
 * Phase 3 — Modularisasi.
 */
'use strict';

/* ================================================================
   STATE
   ================================================================ */
let activeChatId = 'conv-1';

/* ================================================================
   TITLE / SUBTITLE HELPERS
   ================================================================ */
function getChatTitle(chat, role) {
  if (chat.type === 'mediation') return `Mediasi Dispute · ${chat.project || 'Project'}`;
  if (chat.type === 'support') return 'Live Support';
  if (role === 'student') return chat.participants?.biz || chat.name || 'Chat';
  if (role === 'biz') return chat.participants?.student || chat.name || 'Chat';
  return chat.biz || chat.name || 'Chat';
}

function getChatSubtitle(chat) {
  if (chat.type === 'mediation') return `Diajukan oleh: ${chat.openedBy || chat.student || 'Mahasiswa'} · ${chat.biz || 'Bisnis'} · Admin`;
  if (chat.type === 'support') return 'Admin Support · 09.00–18.00 WIB';
  return chat.biz || '';
}

/* ================================================================
   ENSURE CHAT ROOMS
   ================================================================ */
async function ensureMediationChat(disputeId, source = 'admin') {
  const role      = getCurrentRole();
  const fromAdmin = ADMIN_DISPUTES.find(x => x.id === disputeId);
  const fromUser  = DISPUTES.find(x => x.id === disputeId);
  const d         = fromAdmin || fromUser;
  if (!d) { showToast('Dispute tidak ditemukan', 'error'); return null; }

  const id = `med-${disputeId}`;

  // Coba ambil room dari backend terlebih dahulu
  try {
    const res  = await MessagesAPI.getMediationRoom(disputeId);
    const room = res.data || {};

    let chat = CHATS.find(c => c.id === id);
    if (!chat) {
      chat = {
        id, type: 'mediation', members: ['student', 'biz', 'admin'], disputeId,
        project: d.project || d.contracts?.projects?.title || 'Project',
        student: USER_PROFILES.student.name,
        biz: (fromAdmin ? d.biz : d.counterparty) || USER_PROFILES.biz.bizName,
        last: room.last_message || 'Chat mediasi dibuka',
        time: room.updated_at ? new Date(room.updated_at) : new Date(),
        unreadBy: { student: 0, biz: 0, admin: 0 }, online: false,
        backendRoomId: room.id || null,
      };
      CHATS.unshift(chat);
    }

    // Map pesan dari backend jika ada
    if (Array.isArray(room.messages) && room.messages.length) {
      CHAT_MESSAGES[id] = room.messages.map(m => ({
        text: m.content, content: m.content,
        senderRole: m.sender_role || 'system',
        senderName: m.sender_name || 'System',
        time: m.created_at ? new Date(m.created_at) : new Date(),
      }));
    } else if (!CHAT_MESSAGES[id]) {
      CHAT_MESSAGES[id] = [{
        text: `Ruang mediasi untuk dispute "${d.project || 'Project'}". Jelaskan kronologi + lampirkan bukti.`,
        senderRole: 'system', senderName: 'System', time: new Date(),
      }];
    }

    _updateMediationUnread(chat, source, role);
    return chat;
  } catch (err) {
    console.warn('[ensureMediationChat] backend fallback:', err.message);
    // Fallback ke local chat
    let chat = CHATS.find(c => c.id === id);
    if (!chat) {
      chat = {
        id, type: 'mediation', members: ['student', 'biz', 'admin'], disputeId,
        project: d.project,
        student: USER_PROFILES.student.name,
        biz: (fromAdmin ? d.biz : d.counterparty) || USER_PROFILES.biz.bizName,
        openedBy: d.student || d.opened_by_user?.full_name || USER_PROFILES.student.name,
        last: 'Chat mediasi dibuat oleh admin',
        time: new Date(), unreadBy: { student: 0, biz: 0, admin: 0 }, online: false,
      };
      CHATS.unshift(chat);
      CHAT_MESSAGES[id] = [{
        text: `Admin membuat ruang mediasi untuk dispute "${d.project}". Silakan jelaskan kronologi.`,
        senderRole: 'system', senderName: 'System', time: new Date(),
      }];
    }
    _updateMediationUnread(chat, source, role);
    return chat;
  }
}

function _updateMediationUnread(chat, source, role) {
  if (source === 'admin') {
    chat.unreadBy.student = (chat.unreadBy.student || 0) + 1;
    chat.unreadBy.biz     = (chat.unreadBy.biz || 0) + 1;
    chat.unreadBy.admin   = 0;
  } else if (role === 'student') {
    chat.unreadBy.student = 0;
  } else if (role === 'biz') {
    chat.unreadBy.biz = 0;
  }
}

function ensureSupportChat(role) {
  const id = `support-${role}`;
  let chat = CHATS.find(c => c.id === id);
  if (!chat) {
    const sub      = role === 'student' ? 'Mahasiswa' : 'Bisnis';
    const peerName = role === 'student' ? USER_PROFILES.student.name : USER_PROFILES.biz.name;
    chat = {
      id, type: 'support', members: [role, 'admin'],
      participants: role === 'student'
        ? { student: peerName, admin: USER_PROFILES.admin.name }
        : { biz: peerName, admin: USER_PROFILES.admin.name },
      biz: `Support · ${sub}`, last: 'Halo! Ada yang bisa kami bantu?',
      time: new Date(), unreadBy: { student: 0, biz: 0, admin: 0 }, online: true,
    };
    CHATS.unshift(chat);
    CHAT_MESSAGES[id] = [
      { text: 'Halo! Saya Admin Support StairsLife. Silakan jelaskan kendala kamu ya 😊', senderRole: 'admin', senderName: USER_PROFILES.admin.name, time: new Date() },
    ];
  }
  return chat;
}

async function openSupportChat() {
  const role        = getCurrentRole();
  const currentUser = AuthAPI.getCurrentUser();
  if (role === 'admin') { goTo('screen-chat-list'); return; }

  try {
    const res  = await MessagesAPI.getSupportRoom();
    const room = res.data || {};
    const id   = `support-${currentUser?.id || role}`;

    let chat = CHATS.find(c => c.id === id);
    if (!chat) {
      chat = {
        id, type: 'support', members: [role, 'admin'],
        biz: 'Live Support',
        last: room.last_message || 'Halo! Ada yang bisa kami bantu?',
        time: new Date(), unreadBy: { student: 0, biz: 0, admin: 0 }, online: true,
        backendRoomId: room.room_id,
      };
      CHATS.unshift(chat);
    }

    // Map pesan dari backend
    if (Array.isArray(room.messages) && room.messages.length) {
      CHAT_MESSAGES[id] = room.messages.map(m => ({
        text:       m.content,
        senderRole: m.sender_role === 'admin' ? 'admin' : role,
        senderName: m.sender?.full_name || (m.sender_role === 'admin' ? 'Admin Support' : currentUser?.full_name),
        time:       new Date(m.created_at),
      }));
    } else if (!CHAT_MESSAGES[id]) {
      CHAT_MESSAGES[id] = [{
        text: 'Halo! Saya Admin Support StairsLife. Silakan jelaskan kendala kamu ya 😊',
        senderRole: 'admin', senderName: 'Admin Support', time: new Date(),
      }];
    }

    // Override send — pakai REST ke support/messages
    window._sendMessageOverride = async (text) => {
      const currentUser = AuthAPI.getCurrentUser();
      if (!CHAT_MESSAGES[id]) CHAT_MESSAGES[id] = [];
      CHAT_MESSAGES[id].push({
        text, senderRole: role,
        senderName: currentUser?.full_name || 'Kamu',
        time: new Date(),
      });
      chat.last = text; chat.time = new Date();
      renderChatMessages();

      try {
        await MessagesAPI.sendSupport(text);
      } catch (e) {
        console.warn('[support] kirim gagal:', e.message);
      }
    };

    openChatRoom(id);
  } catch (error) {
    console.warn('[support chat] fallback:', error.message);
    const chat = ensureSupportChat(role);
    openChatRoom(chat.id);
  }
}

/* ================================================================
   CHAT LIST
   ================================================================ */
function renderChatList(query = '') {
  const container = document.getElementById('chat-list-container');
  if (!container) return;
  const role      = getCurrentRole();
  const roleChats = CHATS
    .filter(c => (c.members || []).includes(role))
    .filter(c => state.chatFilter === 'all' ? true : c.type === state.chatFilter);

  const filtered = query
    ? roleChats.filter(c => {
      const title = getChatTitle(c, role).toLowerCase();
      const sub   = (getChatSubtitle(c) || '').toLowerCase();
      return title.includes(query.toLowerCase()) || sub.includes(query.toLowerCase()) || (c.last || '').toLowerCase().includes(query.toLowerCase());
    })
    : roleChats;

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-title">Tidak ada percakapan</div><p class="empty-state-desc">Belum ada pesan ditemukan</p></div>`;
    return;
  }
  container.innerHTML = filtered.map(c => `
    <div class="chat-list-item" onclick="openChatRoom('${c.id}')">
      <div class="chat-avatar">${getChatTitle(c, role).charAt(0)}${c.online ? '<div class="chat-online-dot"></div>' : ''}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
          <span class="chat-name">${getChatTitle(c, role)}</span>
          <span class="chat-time">${fmtRelative(c.time)}</span>
        </div>
        <div class="chat-biz-name">${getChatSubtitle(c)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px">
          <span class="chat-preview${c.unread ? ' unread' : ''}">${c.last}</span>
          ${((c.unreadBy?.[role]) || 0) ? `<span class="chat-unread-badge">${c.unreadBy[role]}</span>` : ''}
        </div>
      </div>
    </div>`).join('');
}

function filterChats() {
  renderChatList(document.getElementById('chat-search')?.value || '');
}

function setChatFilter(f, btn) {
  state.chatFilter = f;
  document.querySelectorAll('#chat-filter-chips .filter-chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  filterChats();
}

/* ================================================================
   CHAT ROOM
   ================================================================ */
function openChatRoom(id) {
  activeChatId         = id;
  window.activeChatId  = id;  // C2 FIX: sync ke window
  const chat   = CHATS.find(c => c.id === id);
  if (!chat) return;
  const role   = getCurrentRole();
  if (chat.unreadBy) chat.unreadBy[role] = 0;
  document.getElementById('chat-room-avatar').textContent = getChatTitle(chat, role).charAt(0);
  document.getElementById('chat-room-name').textContent   = getChatTitle(chat, role);
  document.getElementById('chat-room-status').innerHTML   = chat.type === 'mediation'
    ? `<span style="color:var(--text-muted)">${getChatSubtitle(chat)}</span>`
    : (chat.online ? '<span style="color:var(--green)">● Online</span>' : `<span style="color:var(--text-muted)">${getChatSubtitle(chat)}</span>`);
  renderChatContextBar();
  renderChatMessages();
  goTo('screen-chat-room');
}

function renderChatMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const role   = getCurrentRole();
  const chat   = CHATS.find(c => c.id === activeChatId);
  const isGroup = chat?.type === 'mediation';
  const msgs   = CHAT_MESSAGES[activeChatId] || [];
  container.innerHTML = msgs.map((m, i) => {
    const prev     = msgs[i - 1];
    // WhatsApp-style: divider muncul saat HARI berbeda, bukan tiap 5 menit
    const showDate = !prev || isDifferentDay(m.time, prev.time);

    if (m.senderRole === 'system') {
      return `
        ${showDate ? `<div class="chat-date-divider">${fmtChatDate(m.time)}</div>` : ''}
        <div style="display:flex;justify-content:center">
          <div style="max-width:520px;background:var(--bg-secondary);border:1px solid var(--border);padding:10px 12px;border-radius:14px;font-size:13px;color:var(--text-secondary);line-height:1.5">${m.text}</div>
        </div>`;
    }
    const me          = m.senderRole === role;
    const senderLabel = !me && (isGroup || chat?.type === 'support')
      ? `<div style="font-size:11px;font-weight:700;opacity:0.7;margin-bottom:4px">${m.senderName || m.senderRole}</div>`
      : '';
    const timeStr = m.time instanceof Date
      ? m.time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : new Date(m.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `
      ${showDate ? `<div class="chat-date-divider">${fmtChatDate(m.time)}</div>` : ''}
      <div class="msg-row" style="align-items:${me ? 'flex-end' : 'flex-start'}">
        <div class="msg-bubble${me ? ' me' : ' them'}">${senderLabel}${m.text}</div>
        <div class="msg-time${me ? '' : ' them'}">${timeStr}</div>
      </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function renderChatContextBar() {
  const el   = document.getElementById('chat-room-context');
  if (!el) return;
  const role = getCurrentRole();
  const chat = CHATS.find(c => c.id === activeChatId);
  if (!chat) { el.style.display = 'none'; el.innerHTML = ''; return; }

  if (chat.type === 'support') {
    el.style.display = '';
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.5">
          Kamu sedang terhubung dengan <b>Live Support</b>. Sertakan detail (project, bukti, waktu) agar cepat dibantu.
        </div>
        <button class="btn btn-ghost btn-sm" onclick="showToast('Tips: tulis kronologi singkat + apa yang kamu harapkan','info')">Tips</button>
      </div>`;
    return;
  }

    if (chat.type === 'mediation' && role === 'admin') {
    el.style.display = '';
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="font-size:13px;color:var(--text-secondary)"><b>Keputusan Admin</b> — pilih keputusan final untuk sengketa ini.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-danger btn-sm" onclick="adminDecision('${chat.disputeId}','refund')">💸 Refund ke Bisnis</button>
          <button class="btn btn-ghost btn-sm" onclick="adminDecision('${chat.disputeId}','partial')">⚖️ Partial 50:50</button>
          <button class="btn btn-primary btn-sm" onclick="adminDecision('${chat.disputeId}','continue')">✅ Lanjutkan Project</button>
        </div>
      </div>`;
    return;
  }

  el.style.display = 'none';
  el.innerHTML = '';
}

async function adminDecision(disputeId, decision) {
  const chat   = CHATS.find(c => c.id === `med-${disputeId}`);
  const dAdmin = ADMIN_DISPUTES.find(x => x.id === disputeId);
  const dUser  = DISPUTES.find(x => x.id === disputeId);
  const d      = dAdmin || dUser;
  if (!d || !chat) { showToast('Dispute/room mediasi tidak ditemukan', 'error'); return; }

  const decisionText = decision === 'refund'
    ? 'Keputusan Admin: Refund 100% ke pihak pembayar.'
    : decision === 'partial'
      ? 'Keputusan Admin: Pembayaran sebagian (partial) berdasarkan bukti yang ada.'
      : 'Keputusan Admin: Project dilanjutkan (continue) dengan scope yang dikunci ulang.';

  // 1. Simpan ke backend
  try {
    await AdminAPI.resolveDispute(disputeId, {
      resolution: decisionText,
      decision_type: decision,
    });
  } catch (apiErr) {
    console.warn('[adminDecision] resolveDispute API error:', apiErr.message);
    // Lanjut update UI meski API gagal — agar admin tidak stuck
  }

  // 2. Kirim pesan ke room mediasi via backend (jika tersedia)
  try {
    await MessagesAPI.sendMediation(disputeId, decisionText);
  } catch (msgErr) {
    console.warn('[adminDecision] sendMediation error:', msgErr.message);
  }

  // 3. Update local state untuk immediate UI feedback
  if (!CHAT_MESSAGES[chat.id]) CHAT_MESSAGES[chat.id] = [];
  CHAT_MESSAGES[chat.id].push({
    text: decisionText,
    senderRole: 'system',
    senderName: 'Admin StairsLife',
    time: new Date(),
  });
  chat.last = decisionText; chat.time = new Date();
  if (dAdmin) dAdmin.status = 'resolved';
  if (dUser)  { dUser.status = 'resolved'; dUser.adminNote = decisionText; }
  chat.unreadBy.student = (chat.unreadBy.student || 0) + 1;
  chat.unreadBy.biz     = (chat.unreadBy.biz || 0) + 1;

  renderAdminDisputes();
  renderDisputeList();
  renderChatMessages();
  showToast('Keputusan berhasil disimpan & dikirim ke room mediasi ✅', 'success');
}

function showChatOptions() { showToast('Opsi chat: Lihat Profil, Mute, Laporkan', 'info'); }

/* ================================================================
   WEBSOCKET CHAT (menggantikan polling 3 detik)
   ================================================================ */

/**
 * leaveChatRoom — keluar dari room WebSocket aktif.
 */
function leaveChatRoom() {
  if (window._activeChatContractId) {
    SocketManager.leaveRoom(window._activeChatContractId);
  }
}

/**
 * joinChatRoom — masuk ke room WebSocket untuk kontrak.
 */
function joinChatRoom(contractId) {
  leaveChatRoom();
  SocketManager.joinRoom(contractId);
}

// Backward-compat alias (nama lama dari era polling).
// Kalau semua pemanggil sudah migrasi ke join/leaveChatRoom, hapus alias ini.
const stopChatPolling  = leaveChatRoom;
const startChatPolling = joinChatRoom;

/**
 * refreshChatMessages — fallback HTTP jika WebSocket tidak tersambung.
 */
async function refreshChatMessages(contractId) {
  try {
    const res         = await MessagesAPI.getOrCreateRoom(contractId);
    const messages    = res.data || [];
    const currentUser = AuthAPI.getCurrentUser();
    const messagesEl  = document.getElementById('chat-messages');
    if (!messagesEl || !messages.length) return;
    const newHtml = renderMessageBubbles(messages, currentUser);
    if (messagesEl.dataset.lastHash === newHtml.length.toString()) return;
    const wasAtBottom = messagesEl.scrollHeight - messagesEl.scrollTop <= messagesEl.clientHeight + 80;
    messagesEl.innerHTML        = newHtml;
    messagesEl.dataset.lastHash = newHtml.length.toString();
    if (wasAtBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  } catch (e) { console.warn('[chat] refreshChatMessages error:', e.message); }
}

function renderMessageBubbles(messages, currentUser) {
  return messages.map((m, i) => {
    const isMe     = m.sender_id === currentUser?.id;
    const sender   = m.sender || {};
    const prev     = messages[i - 1];
    // WhatsApp-style: divider muncul saat HARI berbeda
    const showDate = !prev || isDifferentDay(m.created_at, prev.created_at);
    const timeStr  = new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (m.senderRole === 'system' || m.sender_role === 'system') {
      return `
        ${showDate ? `<div class="chat-date-divider">${fmtChatDate(m.created_at)}</div>` : ''}
        <div style="display:flex;justify-content:center;margin:8px 0">
          <div style="max-width:90%;background:var(--bg-secondary);border:1px solid var(--border);padding:8px 14px;border-radius:14px;font-size:12px;color:var(--text-secondary);text-align:center">${m.content || m.text}</div>
        </div>`;
    }

    return `
      ${showDate ? `<div class="chat-date-divider">${fmtChatDate(m.created_at)}</div>` : ''}
      <div class="msg-row" style="align-items:${isMe ? 'flex-end' : 'flex-start'}">
        <div class="msg-bubble${isMe ? ' me' : ' them'}">
          ${!isMe ? `<div style="font-size:11px;font-weight:700;opacity:0.7;margin-bottom:4px">${sender.full_name || 'User'}</div>` : ''}
          ${m.content || m.text}
        </div>
        <div class="msg-time${isMe ? '' : ' them'}">${timeStr}</div>
      </div>`;
  }).join('');
}

/* ----------------------------------------------------------------
   WebSocket event handlers — dipasang satu kali saat module load
---------------------------------------------------------------- */
function _initSocketListeners() {
  // Riwayat pesan saat join room berhasil
  SocketManager.on('message_history', ({ contractId, messages }) => {
    if (contractId !== window._activeChatContractId) return;
    const currentUser = AuthAPI.getCurrentUser();
    const messagesEl  = document.getElementById('chat-messages');
    if (!messagesEl) return;

    if (!messages.length) {
      const targetName = document.getElementById('chat-room-name')?.textContent || '';
      messagesEl.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:36px;margin-bottom:12px">💬</div>
          <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:6px">Mulai Percakapan</div>
          <div style="font-size:13px;color:var(--text-secondary)">Terhubung dengan <b>${targetName}</b></div>
        </div>`;
    } else {
      messagesEl.innerHTML = renderMessageBubbles(messages, currentUser);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });

  // Pesan baru real-time
  SocketManager.on('new_message', ({ contractId, message }) => {
    if (contractId !== window._activeChatContractId) return;
    const currentUser = AuthAPI.getCurrentUser();
    const messagesEl  = document.getElementById('chat-messages');
    if (!messagesEl) return;

    const wasAtBottom = messagesEl.scrollHeight - messagesEl.scrollTop <= messagesEl.clientHeight + 80;

    // Hapus empty state jika ada
    if (messagesEl.querySelector('[style*="padding:40px"]')) {
      messagesEl.innerHTML = '';
    }

    // Append bubble pesan baru
    const isMe     = message.sender_id === currentUser?.id;
    const sender   = message.sender || {};
    const bubble   = document.createElement('div');
    bubble.className = 'msg-row';
    bubble.style.alignItems = isMe ? 'flex-end' : 'flex-start';
    bubble.innerHTML = `
      <div class="msg-bubble${isMe ? ' me' : ' them'}">
        ${!isMe ? `<div style="font-size:11px;font-weight:700;opacity:0.7;margin-bottom:4px">${sender.full_name || 'User'}</div>` : ''}
        ${message.content}
      </div>
      <div class="msg-time${isMe ? '' : ' them'}">${new Date(message.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>`;

    messagesEl.appendChild(bubble);
    if (wasAtBottom) messagesEl.scrollTop = messagesEl.scrollHeight;

    // Update last message di chat list
    const chat = CHATS.find(c => c.id === activeChatId);
    if (chat) { chat.last = message.content; chat.time = new Date(message.created_at); }
  });

  // Typing indicator
  SocketManager.on('user_typing', ({ userName, isTyping }) => {
    const typingEl = document.getElementById('chat-typing-indicator');
    if (!typingEl) return;
    typingEl.textContent = isTyping ? `${userName} sedang mengetik...` : '';
    typingEl.style.display = isTyping ? 'block' : 'none';
  });

  // Error dari server
  SocketManager.on('error', (msg) => {
    console.warn('[Socket] Error:', msg);
  });
}

// Inisialisasi sekali saat module load
_initSocketListeners();

async function loadContractChatRoom(contractId, targetName, contextLabel) {
  window._activeChatContractId = contractId;

  const avatarEl = document.getElementById('chat-room-avatar');
  const nameEl   = document.getElementById('chat-room-name');
  const statusEl = document.getElementById('chat-room-status');
  if (avatarEl) avatarEl.textContent = targetName.charAt(0);
  if (nameEl)   nameEl.textContent   = targetName;

  // Tampilkan status koneksi WebSocket
  const wsConnected = SocketManager.isConnected();
  if (statusEl) {
    statusEl.innerHTML = wsConnected
      ? `<span style="color:var(--teal)">● Online</span>`
      : `<span style="color:var(--text-muted)">● Menyambungkan...</span>`;
  }

  const messagesEl = document.getElementById('chat-messages');
  if (messagesEl) messagesEl.innerHTML = skeletons.notifItems(4);

  // Override send handler → pakai WebSocket
  window._sendMessageOverride = async (text) => {
    const sent = SocketManager.sendMessage(contractId, text);
    if (!sent) {
      // Fallback ke REST jika WebSocket terputus
      try {
        await MessagesAPI.send(contractId, text);
        await refreshChatMessages(contractId);
      } catch (e) {
        showToast('Gagal kirim pesan: ' + e.message, 'error');
      }
    }
  };

  // Sambung WebSocket dan join room
  // (message_history akan diterima via event listener di atas)
  if (!SocketManager.isConnected()) {
    SocketManager.connect();
  }
  SocketManager.joinRoom(contractId);

  // L6 FIX: bersihkan listeners lama sebelum tambah baru
  SocketManager.off('connected');
  SocketManager.off('disconnected');
  SocketManager.on('connected', () => {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--teal)">● Online</span>`;
  });
  SocketManager.on('disconnected', () => {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--rose)">● Terputus — mencoba ulang...</span>`;
  });
}

/* ================================================================
   INQUIRY CHAT — pre-contract, mahasiswa tanya ke bisnis
   ================================================================ */

/**
 * Buka chat inquiry untuk project tertentu.
 * Dipakai dari tombol "💬 Tanya" di project cards.
 * Jika sudah ada kontrak → buka contract chat biasa.
 * Jika belum → buka inquiry room.
 */
async function openProjectInquiry(projectId, bizName, bizUserId, projectTitle) {
  const currentUser = AuthAPI.getCurrentUser();
  if (!currentUser) { showToast('Login dulu untuk mengirim pesan', 'error'); goTo('screen-login'); return; }

  // Cek apakah sudah ada kontrak dengan bisnis ini
  let contractId = null;
  try {
    const res       = await ContractsAPI.getMyContracts();
    const contracts = res.data || [];
    const contract  = contracts.find(c => {
      const biz = c.users_contracts_business_idTousers || {};
      return (bizUserId && biz.id === bizUserId) || biz.full_name === bizName;
    });
    if (contract) contractId = contract.id;
  } catch (_) {}

  // Sudah ada kontrak → buka contract chat
  if (contractId) {
    document.getElementById('chat-room-avatar').textContent = bizName.charAt(0);
    document.getElementById('chat-room-name').textContent   = bizName;
    document.getElementById('chat-room-status').innerHTML   = `<span style="color:var(--teal)">● Online</span>`;
    goTo('screen-chat-room');
    await loadContractChatRoom(contractId, bizName, `Kontrak: ${projectTitle}`);
    return;
  }

  // Belum ada kontrak → buka inquiry room
  const inquiryId = `inquiry-${projectId}-${currentUser.id}`;
  let chat = CHATS.find(c => c.id === inquiryId);
  if (!chat) {
    chat = {
      id: inquiryId, type: 'inquiry', projectId, bizUserId,
      members: ['student', 'biz'],
      biz: bizName, last: '', time: new Date(),
      unreadBy: { student: 0, biz: 0 }, online: true,
      projectTitle,
      // Simpan info pengirim agar bisnis bisa tampilkan nama yg benar
      senderName:  currentUser.full_name || 'Mahasiswa',
      senderId:    currentUser.id,
      sender: { id: currentUser.id, full_name: currentUser.full_name || 'Mahasiswa' },
    };
    CHATS.unshift(chat);
    CHAT_MESSAGES[inquiryId] = [{
      text: `💬 Chat dengan ${bizName} tentang project "${projectTitle}". Tanyakan apapun tentang project ini.`,
      senderRole: 'system', senderName: 'System', time: new Date(),
    }];
  }

  activeChatId = inquiryId;

  document.getElementById('chat-room-avatar').textContent = bizName.charAt(0);
  document.getElementById('chat-room-name').textContent   = bizName;
  document.getElementById('chat-room-status').innerHTML   = `<span style="color:var(--text-muted)">Project: ${projectTitle}</span>`;

  // Override send untuk inquiry: coba kirim ke backend, fallback lokal
  window._sendMessageOverride = async (text) => {
    // Tambah ke local state dulu (optimistic)
    if (!CHAT_MESSAGES[inquiryId]) CHAT_MESSAGES[inquiryId] = [];
    CHAT_MESSAGES[inquiryId].push({
      text, content: text, senderRole: 'student',
      senderName: currentUser.full_name,
      sender_id: currentUser.id,
      created_at: new Date().toISOString(), time: new Date(),
    });
    chat.last = text; chat.time = new Date();
    renderChatMessages();

    // Kirim ke backend jika bizUserId tersedia
    if (bizUserId) {
      try {
        await MessagesAPI.sendInquiry(projectId, bizUserId, text, currentUser.full_name);
      } catch (err) {
        console.warn('[inquiry] backend fallback:', err.message);
        // Pesan tetap tersimpan lokal
      }
    }
  };

  goTo('screen-chat-room');
  renderChatMessages();
}

/* ================================================================
   DIRECT CHAT
   ================================================================ */
async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text  = input?.value.trim();
  if (!text) return;
  input.value = '';
  input.focus();

  if (window._sendMessageOverride) { window._sendMessageOverride(text); return; }
  const chat        = CHATS.find(c => c.id === activeChatId);
  const role        = getCurrentRole();
  const currentUser = AuthAPI.getCurrentUser();

  if (!CHAT_MESSAGES[activeChatId]) CHAT_MESSAGES[activeChatId] = [];
  CHAT_MESSAGES[activeChatId].push({
    text, content: text, senderRole: role, senderName: currentUser?.full_name || role,
    sender_id: currentUser?.id, created_at: new Date().toISOString(), time: new Date(),
  });
  if (chat) { chat.last = text; chat.time = new Date(); }
  renderChatMessages();

  try {
  if (chat?.type === 'support') {
    await MessagesAPI.sendSupport(text);
  } else if (chat?.type === 'mediation' && chat.disputeId) {
    await MessagesAPI.sendMediation(chat.disputeId, text);
  }
    } catch (error) {
      console.warn('[chat send] backend error:', error.message);
    }
}

/* ================================================================
   DIRECT CHAT
   ================================================================ */
async function openDirectChatWith(targetName, targetRole, contextLabel, targetUserId = null) {
  const currentUser = AuthAPI.getCurrentUser();
  const myRole      = currentUser?.role;

  let contractId = null;
  try {
    const res       = await ContractsAPI.getMyContracts();
    const contracts = res.data || [];
    const contract  = contracts.find(c => {
      const biz     = c.users_contracts_business_idTousers || {};
      const student = c.users_contracts_student_idTousers || {};
      if (targetUserId) { return biz.id === targetUserId || student.id === targetUserId; }
      return biz.full_name === targetName || student.full_name === targetName;
    });
    if (contract) contractId = contract.id;
  } catch (e) {}

  if (contractId) {
    window._activeChatContractId = contractId;
    window._activeChatTarget     = { name: targetName, role: targetRole, label: contextLabel, contractId };
    document.getElementById('chat-room-avatar').textContent = targetName.charAt(0);
    document.getElementById('chat-room-name').textContent   = targetName;
    document.getElementById('chat-room-status').innerHTML   = `<span style="color:var(--teal)">● Online</span>`;
    goTo('screen-chat-room');
    await loadContractChatRoom(contractId, targetName, contextLabel);
    return;
  }

  const myRoleKey     = myRole === 'bisnis' ? 'biz' : 'student';
  const targetRoleKey = targetRole === 'mahasiswa' ? 'student' : 'biz';
  const chatId        = `pre-${myRoleKey}-${targetRoleKey}-${targetName.replace(/\s/g, '')}`;

  let existing = CHATS.find(c => c.id === chatId);
  if (!existing) {
    existing = {
      id: chatId, type: 'direct', members: [myRoleKey, targetRoleKey],
      participants: { [myRoleKey]: currentUser?.full_name || 'Saya', [targetRoleKey]: targetName },
      biz: myRole === 'bisnis' ? (currentUser?.full_name || '') : targetName,
      last: '', time: new Date(), unreadBy: { student: 0, biz: 0, admin: 0 }, online: true, contextLabel,
    };
    CHATS.unshift(existing);
    CHAT_MESSAGES[chatId] = [
      { text: `💬 Chat dengan ${targetName}${contextLabel ? ` · ${contextLabel}` : ''}`, senderRole: 'system', senderName: 'System', time: new Date() },
      { text: myRole === 'bisnis' ? 'ℹ️ Chat ini bersifat lokal. Setelah kontrak dibuat, chat akan tersimpan permanen.' : '✅ Chat aktif! Pesan akan tersimpan permanen setelah kontrak dibuat.', senderRole: 'system', senderName: 'System', time: new Date() },
    ];
  }

  document.getElementById('chat-room-avatar').textContent = targetName.charAt(0);
  document.getElementById('chat-room-name').textContent   = targetName;
  document.getElementById('chat-room-status').innerHTML   = `<span style="color:var(--text-muted)">● Lokal</span>`;

  window._sendMessageOverride = null;
  stopChatPolling();
  activeChatId = chatId;
  goTo('screen-chat-room');
  renderChatMessages();
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.activeChatId          = activeChatId;
window.getChatTitle          = getChatTitle;
window.getChatSubtitle       = getChatSubtitle;
window.ensureMediationChat   = ensureMediationChat;
window.ensureSupportChat     = ensureSupportChat;
window.openSupportChat       = openSupportChat;
window.openProjectInquiry    = openProjectInquiry;
window.renderChatList        = renderChatList;
window.filterChats           = filterChats;
window.setChatFilter         = setChatFilter;
window.openChatRoom          = openChatRoom;
window.renderChatMessages    = renderChatMessages;
window.renderChatContextBar  = renderChatContextBar;
window.adminDecision         = adminDecision;
window.showChatOptions       = showChatOptions;
window.stopChatPolling       = stopChatPolling;
window.startChatPolling      = startChatPolling;
window.loadContractChatRoom  = loadContractChatRoom;
window.sendChatMessage       = sendChatMessage;
window.openDirectChatWith    = openDirectChatWith;
window.renderMessageBubbles  = renderMessageBubbles;
