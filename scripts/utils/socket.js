/**
 * StairsLife — utils/socket.js
 * WebSocket connection manager menggunakan socket.io-client.
 *
 * Pola pemakaian:
 *   SocketManager.connect()          → sambung ke server
 *   SocketManager.joinRoom(id)       → masuk room kontrak
 *   SocketManager.sendMessage(id, t) → kirim pesan
 *   SocketManager.onMessage(fn)      → dengarkan pesan baru
 *   SocketManager.disconnect()       → putus koneksi
 *
 * Phase 4 — WebSocket (menggantikan polling 3 detik).
 */
'use strict';

const SocketManager = (() => {
  /* ----------------------------------------------------------------
     STATE
  ---------------------------------------------------------------- */
  let _socket          = null;
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
     CONNECT
  ---------------------------------------------------------------- */
  function connect() {
    if (_socket?.connected) return;

    const token = TokenManager.get();
    if (!token) {
      console.warn('[Socket] Tidak ada token — skip connect');
      return;
    }

    const url = _getWsUrl();
    console.debug(`[Socket] Connecting to ${url}/chat`);

    _socket = io(`${url}/chat`, {
      auth:              { token },
      transports:        ['websocket', 'polling'],
      reconnection:      true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout:           10000,
    });

    /* -- lifecycle events -- */
    _socket.on('connect', () => {
      console.debug('[Socket] Connected:', _socket.id);
      _emit('connected');

      // Re-join room jika ada active contract (misalnya setelah reconnect)
      if (_activeContractId) {
        joinRoom(_activeContractId);
      }
    });

    _socket.on('disconnect', (reason) => {
      console.debug('[Socket] Disconnected:', reason);
      _emit('disconnected', reason);
    });

    _socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
      _emit('error', err.message);
    });

    _socket.on('error', (err) => {
      console.warn('[Socket] Server error:', err);
      _emit('error', err?.message || 'WebSocket error');
    });

    /* -- chat events dari server -- */

    /**
     * message_history — dikirim server saat join_room berhasil
     * payload: { contractId, messages: [...] }
     */
    _socket.on('message_history', (data) => {
      console.debug('[Socket] message_history:', data.messages?.length, 'messages');
      _emit('message_history', data);
    });

    /**
     * new_message — dikirim server saat ada pesan baru di room
     * payload: { contractId, message: {...} }
     */
    _socket.on('new_message', (data) => {
      _emit('new_message', data);
    });

    /**
     * user_typing — dikirim server saat ada user mengetik
     * payload: { userId, userName, isTyping }
     */
    _socket.on('user_typing', (data) => {
      _emit('user_typing', data);
    });

    /**
     * user_joined — notifikasi user lain masuk room
     */
    _socket.on('user_joined', (data) => {
      _emit('user_joined', data);
    });
  }

  /* ----------------------------------------------------------------
     DISCONNECT
  ---------------------------------------------------------------- */
  function disconnect() {
    if (_socket) {
      _socket.disconnect();
      _socket = null;
    }
    _activeContractId = null;
  }

  /* ----------------------------------------------------------------
     JOIN ROOM
  ---------------------------------------------------------------- */
  function joinRoom(contractId) {
    if (!_socket?.connected) {
      connect();
      // Setelah connect, on('connect') akan auto-rejoin
      _activeContractId = contractId;
      return;
    }
    _activeContractId = contractId;
    _socket.emit('join_room', { contractId });
    console.debug('[Socket] Joining room:', contractId);
  }

  /* ----------------------------------------------------------------
     LEAVE ROOM
  ---------------------------------------------------------------- */
  function leaveRoom(contractId) {
    if (!_socket?.connected) return;
    _socket.emit('leave_room', { contractId: contractId || _activeContractId });
    if (_activeContractId === contractId) _activeContractId = null;
  }

  /* ----------------------------------------------------------------
     SEND MESSAGE
  ---------------------------------------------------------------- */
  function sendMessage(contractId, content) {
    if (!_socket?.connected) {
      console.warn('[Socket] Tidak terhubung — pesan tidak terkirim');
      return false;
    }
    _socket.emit('send_message', { contractId, content });
    return true;
  }

  /* ----------------------------------------------------------------
     TYPING INDICATOR
     Debounced: kirim isTyping=true segera, kirim false 2 detik setelah
     user berhenti mengetik.
  ---------------------------------------------------------------- */
  function sendTyping(contractId) {
    if (!_socket?.connected || !contractId) return;

    // Kirim "mulai mengetik"
    _socket.emit('typing', { contractId, isTyping: true });

    // Reset timer "berhenti mengetik"
    if (_typingTimer) clearTimeout(_typingTimer);
    _typingTimer = setTimeout(() => {
      if (_socket?.connected) {
        _socket.emit('typing', { contractId, isTyping: false });
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
     STATUS HELPERS
  ---------------------------------------------------------------- */
  function isConnected()    { return !!_socket?.connected; }
  function getActiveRoom()  { return _activeContractId; }

  /* ----------------------------------------------------------------
     PUBLIC API
  ---------------------------------------------------------------- */
  return {
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
    on,
    off,
    isConnected,
    getActiveRoom,
  };
})();

/* ================================================================
   EXPORTS
   ================================================================ */
window.SocketManager = SocketManager;
// Shortcut untuk oninput handler di HTML: SocketManager.sendTyping(id)
// Dipanggil langsung dari: oninput="if(window._activeChatContractId)SocketManager.sendTyping(...)"
// SocketManager sudah di-expose — tidak perlu export terpisah.
// Tapi sendTyping juga perlu accessible sebagai window.sendTyping untuk HTML checker:
window.sendTyping = (contractId) => SocketManager.sendTyping(contractId);
