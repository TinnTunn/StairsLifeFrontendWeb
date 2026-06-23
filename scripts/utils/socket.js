/**
 * StairsLife — utils/socket.js
 * WebSocket connection manager menggunakan socket.io-client.
 *
 * Mendukung DUA namespace:
 *  - /chat          → ChatGateway   (per-contract room, messages & typing)
 *  - /notifications → NotificationsGateway (per-user push)
 *
 * Pola pemakaian:
 *   SocketManager.connect()                  → sambung ke /chat + /notifications
 *   SocketManager.joinRoom(id)               → join room kontrak di /chat
 *   SocketManager.sendMessage(id, t)         → kirim pesan
 *   SocketManager.onMessage(fn)              → dengarkan pesan baru
 *   SocketManager.onNotification(fn)         → dengarkan notif baru
 *   SocketManager.disconnect()               → putus semua koneksi
 */
'use strict';

const SocketManager = (() => {
  /* ----------------------------------------------------------------
     STATE
  ---------------------------------------------------------------- */
  let _chatSocket      = null;
  let _notifSocket     = null;
  let _activeContractId = null;
  let _typingTimer     = null;
  const _listeners     = {};   // { event: [fn, fn, ...] }

  /* ----------------------------------------------------------------
     INTERNAL HELPERS
  ---------------------------------------------------------------- */
  function _getWsUrl() {
    // Derive dari API_BASE_URL: http://localhost:3000/api/v1 → http://localhost:3000
    const base = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:3000/api/v1');
    return base.replace(/\/api\/v1\/?$/, '');
  }

  function _emit(event, ...args) {
    const fns = _listeners[event] || [];
    fns.forEach(fn => { try { fn(...args); } catch (e) { console.warn(`[Socket] listener error (${event}):`, e); } });
  }

  /* ----------------------------------------------------------------
     CONNECT — sambung ke kedua namespace sekaligus
  ---------------------------------------------------------------- */
  function connect() {
    const token = TokenManager.get();
    if (!token) {
      console.warn('[Socket] Tidak ada token — skip connect');
      return;
    }

    const url = _getWsUrl();
    _connectChat(url, token);
    _connectNotifications(url, token);
  }

  function _connectChat(url, token) {
    // Guard: sudah connected ATAU sedang dalam proses connecting.
    // Race condition sebelumnya: guard hanya cek .connected, tapi saat
    // connect() dipanggil 2x cepat (dari handleLogin + initNotifWebsocket),
    // socket ke-1 belum selesai handshake sehingga .connected masih false
    // → socket ke-2 dibuat → dua koneksi paralel di backend.
    if (_chatSocket && (_chatSocket.connected || _chatSocket.active)) return;
    if (_chatSocket) {
      // Ada socket lama yang disconnect — cleanup dulu
      _chatSocket.removeAllListeners();
      _chatSocket = null;
    }
    console.debug(`[Socket] Connecting to ${url}/chat`);

    _chatSocket = io(`${url}/chat`, {
      auth:              { token },
      transports:        ['websocket', 'polling'],
      reconnection:      true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout:           10000,
    });

    /* -- lifecycle -- */
    _chatSocket.on('connect', () => {
      console.debug('[Socket/chat] Connected:', _chatSocket.id);
      _emit('connected');
      if (_activeContractId) joinRoom(_activeContractId);
    });

    _chatSocket.on('disconnect', (reason) => {
      console.debug('[Socket/chat] Disconnected:', reason);
      _emit('disconnected', reason);
    });

    _chatSocket.on('connect_error', (err) => {
      console.warn('[Socket/chat] Connection error:', err.message);
      _emit('error', err.message);
    });

    _chatSocket.on('error', (err) => {
      console.warn('[Socket/chat] Server error:', err);
      _emit('error', err?.message || 'WebSocket error');
    });

    /* -- chat events -- */
    _chatSocket.on('message_history', (data) => {
      console.debug('[Socket/chat] message_history:', data.messages?.length, 'messages');
      _emit('message_history', data);
    });

    _chatSocket.on('new_message',  (data) => _emit('new_message',  data));
    _chatSocket.on('user_typing',  (data) => _emit('user_typing',  data));
    _chatSocket.on('user_joined',  (data) => _emit('user_joined',  data));
  }

  function _connectNotifications(url, token) {
    // Guard: sama seperti _connectChat — cek connected ATAU active (connecting)
    if (_notifSocket && (_notifSocket.connected || _notifSocket.active)) return;
    if (_notifSocket) {
      _notifSocket.removeAllListeners();
      _notifSocket = null;
    }
    console.debug(`[Socket] Connecting to ${url}/notifications`);

    _notifSocket = io(`${url}/notifications`, {
      auth:              { token },
      transports:        ['websocket', 'polling'],
      reconnection:      true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout:           10000,
    });

    _notifSocket.on('connect', () => {
      console.debug('[Socket/notif] Connected:', _notifSocket.id);
      _emit('notif_connected');
    });

    _notifSocket.on('disconnect', (reason) => {
      console.debug('[Socket/notif] Disconnected:', reason);
    });

    _notifSocket.on('connect_error', (err) => {
      console.warn('[Socket/notif] Connection error:', err.message);
    });

    /**
     * new_notification — dikirim server saat ada notif baru untuk user ini.
     * payload: { id, type, title, body, ref_id, action_url, is_read, created_at, ... }
     */
    _notifSocket.on('new_notification', (notif) => {
      console.debug('[Socket/notif] new_notification:', notif);
      _emit('new_notification', notif);
    });

    /**
     * unread_count — dikirim server saat count berubah (markRead, dll).
     * payload: { count }
     */
    _notifSocket.on('unread_count', (data) => {
      _emit('unread_count', data);
    });
  }

  /* ----------------------------------------------------------------
     DISCONNECT — putus kedua namespace
  ---------------------------------------------------------------- */
  function disconnect() {
    if (_chatSocket)  { _chatSocket.disconnect();  _chatSocket  = null; }
    if (_notifSocket) { _notifSocket.disconnect(); _notifSocket = null; }
    _activeContractId = null;
  }

  /* ----------------------------------------------------------------
     RECONNECT — paksa koneksi baru dgn token terkini.
     WAJIB dipanggil saat ganti akun / login: connect() biasa ada guard
     yang skip kalau socket lama masih hidup, sehingga socket tetap pakai
     identitas user lama → pesan tersimpan atas nama user yang salah.
  ---------------------------------------------------------------- */
  function reconnect() {
    disconnect();
    connect();
  }

  /* ----------------------------------------------------------------
     CHAT API
  ---------------------------------------------------------------- */
  function joinRoom(contractId) {
    if (!_chatSocket?.connected) {
      // Kalau belum connect, set activeContractId — on('connect') auto rejoin
      _activeContractId = contractId;
      connect();
      return;
    }
    _activeContractId = contractId;
    _chatSocket.emit('join_room', { contractId });
    console.debug('[Socket/chat] Joining room:', contractId);
  }

  function leaveRoom(contractId) {
    if (!_chatSocket?.connected) return;
    _chatSocket.emit('leave_room', { contractId: contractId || _activeContractId });
    if (_activeContractId === contractId) _activeContractId = null;
  }

  function sendMessage(contractId, content) {
    if (!_chatSocket?.connected) {
      console.warn('[Socket/chat] Tidak terhubung — pesan tidak terkirim');
      return false;
    }
    _chatSocket.emit('send_message', { contractId, content });
    return true;
  }

  function markRead(contractId) {
    if (!_chatSocket?.connected || !contractId) return;
    _chatSocket.emit('mark_read', { contractId });
  }

  function sendTyping(contractId) {
    if (!_chatSocket?.connected || !contractId) return;
    _chatSocket.emit('typing', { contractId, isTyping: true });
    if (_typingTimer) clearTimeout(_typingTimer);
    _typingTimer = setTimeout(() => {
      if (_chatSocket?.connected) {
        _chatSocket.emit('typing', { contractId, isTyping: false });
      }
    }, 2000);
  }

  /* ----------------------------------------------------------------
     EVENT LISTENER API
  ---------------------------------------------------------------- */
  function on(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
  }

  function off(event, fn) {
    if (!_listeners[event]) return;
    if (fn) {
      _listeners[event] = _listeners[event].filter(f => f !== fn);
    } else {
      delete _listeners[event];
    }
  }

  /* ----------------------------------------------------------------
     CONVENIENCE: subscribe helpers
  ---------------------------------------------------------------- */
  function onMessage(fn)         { on('new_message',      fn); }
  function onNotification(fn)    { on('new_notification', fn); }
  function onUnreadCount(fn)     { on('unread_count',     fn); }

  /* ----------------------------------------------------------------
     STATUS HELPERS
  ---------------------------------------------------------------- */
  function isConnected()      { return !!_chatSocket?.connected; }
  function isNotifConnected() { return !!_notifSocket?.connected; }
  function getActiveRoom()    { return _activeContractId; }

  /* ----------------------------------------------------------------
     PUBLIC API
  ---------------------------------------------------------------- */
  return {
    connect,
    disconnect,
    reconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
    markRead,
    on,
    off,
    onMessage,
    onNotification,
    onUnreadCount,
    isConnected,
    isNotifConnected,
    getActiveRoom,
  };
})();

/* ================================================================
   EXPORTS
   ================================================================ */
window.SocketManager = SocketManager;
window.sendTyping = (contractId) => SocketManager.sendTyping(contractId);
