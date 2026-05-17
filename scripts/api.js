/* ============================================================
 * StairsLife — API Endpoints
 * ------------------------------------------------------------
 * All HTTP endpoints organized by domain. Uses the shared
 * apiFetch wrapper from core/api-core.js (timeout, 401, retry).
 *
 * Depends on: window.apiFetch, window.TokenManager
 * ============================================================ */
'use strict';

// =============================================================
// AUTH API
// =============================================================
const AuthAPI = {
  register: async (data) => {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.data?.token) {
      TokenManager.set(res.data.token);
      TokenManager.setUser(res.data.user);
    }
    if (res.data?.refresh_token) {
      TokenManager.setRefresh(res.data.refresh_token);
    }
    // Jadwalkan proactive refresh setelah login
    if (typeof _scheduleProactiveRefresh === 'function') _scheduleProactiveRefresh();
    return res;
  },

  login: async (data) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.data?.token) {
      TokenManager.set(res.data.token);
      TokenManager.setUser(res.data.user);
    }
    if (res.data?.refresh_token) {
      TokenManager.setRefresh(res.data.refresh_token);
    }
    // Jadwalkan proactive refresh setelah login
    if (typeof _scheduleProactiveRefresh === 'function') _scheduleProactiveRefresh();
    return res;
  },

  logout: () => {
    // Coba hit endpoint logout backend (best effort, tidak block)
    const token = TokenManager.getRefresh();
    if (token) {
      apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: token }),
      }).catch(() => {});
    }
    TokenManager.clear();
  },

  /**
   * Minta access token baru secara manual.
   * Biasanya dipanggil otomatis oleh api-core refresh engine.
   */
  refreshToken: () => apiFetch('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: TokenManager.getRefresh() }),
  }),

  // POST /auth/forgot-password — backend sudah ada, kirim email reset (best-effort)
  forgotPassword: (email) => apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),

  isLoggedIn: () => !!TokenManager.get(),
  getCurrentUser: () => TokenManager.getUser(),
};

// =============================================================
// USERS API
// =============================================================
const UsersAPI = {
  getMe: () => apiFetch('/users/me'),

  updateProfile: (data) => apiFetch('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  submitVerification: (data) => apiFetch('/users/me/verification', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getVerificationStatus: () => apiFetch('/users/me/verification'),

  // NOTE: Endpoint /users/me/bank-accounts BELUM ADA di backend.
  // Saat fitur pencairan saldo dibutuhkan, implementasikan endpoint
  // CRUD bank accounts di backend (table baru: bank_accounts).
  // Sampai itu, stub return data kosong / throw supaya UI bisa handle.
  getBankAccounts:    () => Promise.resolve({ data: [], message: 'Fitur rekening bank belum tersedia' }),
  saveBankAccount:    (_data) => Promise.reject(new Error('Fitur rekening bank belum tersedia')),
  deleteBankAccount:  (_id) => Promise.reject(new Error('Fitur rekening bank belum tersedia')),
};

// =============================================================
// PROJECTS API
// =============================================================
const ProjectsAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.tier) params.append('tier', filters.tier);
    if (filters.category) params.append('category', filters.category);
    const query = params.toString();
    return apiFetch(`/projects${query ? '?' + query : ''}`);
  },

  getById: (id) => apiFetch(`/projects/${id}`),

  getMyProjects: () => apiFetch('/projects/my'),

  create: (data) => apiFetch('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id, data) => apiFetch(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  delete: (id) => apiFetch(`/projects/${id}`, {
    method: 'DELETE',
  }),
};

// =============================================================
// APPLICATIONS API
// =============================================================
const ApplicationsAPI = {
  apply: (data) => apiFetch('/applications', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getMyApplications: () => apiFetch('/applications/my'),

  getById: (id) => apiFetch(`/applications/${id}`),

  getProjectApplications: (projectId) =>
    apiFetch(`/applications/project/${projectId}`),

  updateStatus: (id, status) => apiFetch(`/applications/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
};

// =============================================================
// CONTRACTS API
// =============================================================
const ContractsAPI = {
  create: (data) => apiFetch('/contracts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getMyContracts: () => apiFetch('/contracts/my'),

  getById: (id) => apiFetch(`/contracts/${id}`),

  uploadDeliverable: (id, data) => apiFetch(`/contracts/${id}/deliverable`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  approve: (id) => apiFetch(`/contracts/${id}/approve`, {
    method: 'PATCH',
  }),

  reject: (id, data) => apiFetch(`/contracts/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  getDeliverableHistory: (id) => apiFetch(`/contracts/${id}/deliverables`),
};

// =============================================================
// PAYMENTS API
// =============================================================
const PaymentsAPI = {
  holdEscrow: (data) => apiFetch('/payments/escrow', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  releaseEscrow: (id) => apiFetch(`/payments/escrow/${id}/release`, {
    method: 'PATCH',
  }),

  getMyPayments: () => apiFetch('/payments/my'),

  getByContract: (contractId) =>
    apiFetch(`/payments/contract/${contractId}`),
};

// =============================================================
// ADMIN API
// =============================================================
const AdminAPI = {
  getStats: () => apiFetch('/admin/stats'),
  getUsers:      (role) => apiFetch(`/admin/users${role ? '?role=' + role : ''}`),
  suspendUser:   (id, reason) => apiFetch(`/admin/users/${id}/suspend`, {
    method: 'PATCH',
    body: JSON.stringify({ reason: reason || null }),
  }),
  deleteUser:    (id) => apiFetch(`/admin/users/${id}`, { method: 'DELETE' }),
  getVerifications: (status) =>
    apiFetch(`/admin/verifications${status ? '?status=' + status : ''}`),
  reviewVerification: (id, data) => apiFetch(`/admin/verifications/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  getDisputes: (status) =>
    apiFetch(`/admin/disputes${status ? '?status=' + status : ''}`),
  resolveDispute: (id, data) => apiFetch(`/admin/disputes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  getProjects: (status) =>
    apiFetch(`/admin/projects${status ? '?status=' + status : ''}`),
  sendAnnouncement: (data) => apiFetch('/admin/announcements', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getAnnouncements: () => apiFetch('/admin/announcements'),
  getSettings:      () => apiFetch('/admin/settings'),
  updateSettings:   (data) => apiFetch('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  getFinances:       () => apiFetch('/admin/finances'),
  getFinancesDetail: (page=1, limit=15, status='') =>
  apiFetch(`/admin/finances/detail?page=${page}&limit=${limit}${status ? '&status=' + status : ''}`),
};

// =============================================================
// CHAT / MESSAGES API
// =============================================================
const MessagesAPI = {
  getOrCreateRoom: (contractId) => apiFetch(`/chat/${contractId}/messages`),

  send: (contractId, content) => apiFetch(`/chat/${contractId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  }),

  getRooms: () => apiFetch('/chat/rooms'),

  // ---------------------------------------------------------------
  // NOTE: Endpoint inquiry chat dan dispute mediation chat BELUM ADA
  // di backend. Stub di bawah throw / return data kosong supaya UI tahu
  // fitur ini belum siap (lebih jujur daripada diam-diam menelan error).
  //
  // Untuk implementasi backend, dibutuhkan:
  //   - tabel `chat_inquiries` (project_id, sender_id, receiver_id,
  //     content, parent_id untuk threading, created_at)
  //   - tabel `chat_dispute_messages` (dispute_id, sender_id, content,
  //     created_at) — di-link ke contract & dispute
  //   - Endpoint: POST/GET /chat/inquiry, POST /chat/inquiry/:id/reply,
  //     GET/POST /chat/dispute/:disputeId
  // ---------------------------------------------------------------

  sendInquiry: (_projectId, _receiverId, _content, _senderName = '') =>
    Promise.reject(new Error('Fitur tanya bisnis sebelum apply belum tersedia. Apply project langsung untuk membuka chat kontrak.')),

  getInquiries: () =>
    Promise.resolve({ data: [], message: 'Fitur inquiry belum tersedia' }),

  replyInquiry: (_inquiryId, _content) =>
    Promise.reject(new Error('Fitur balas inquiry belum tersedia')),

  // Support chat (mahasiswa/bisnis ↔ admin)
  getSupportRoom: () => apiFetch('/chat/support'),

  sendSupport: (content) => apiFetch('/chat/support/messages', {
    method: 'POST',
    body: JSON.stringify({ content }),
  }),

  // Mediation chat — stub: fallback ke chat kontrak biasa di UI
  getMediationRoom: (_disputeId) =>
    Promise.resolve({ data: [], message: 'Fitur chat mediasi belum tersedia, gunakan chat kontrak untuk komunikasi' }),

  sendMediation: (_disputeId, _content) =>
    Promise.reject(new Error('Fitur chat mediasi belum tersedia')),
};

const ChatAPI = {
  // Set context for direct chat (used by application accept flow)
  openDirectChat: (targetUserId, targetName, contextLabel) => {
    window._directChatTarget = {
      userId: targetUserId,
      name: targetName,
      label: contextLabel || '',
    };
    return true;
  },
};

// =============================================================
// NOTIFICATIONS API
// =============================================================
const NotificationsAPI = {
  getAll: () => apiFetch('/notifications'),

  getUnreadCount: () => apiFetch('/notifications/unread-count'),

  markRead: (id) => apiFetch(`/notifications/${id}/read`, {
    method: 'PATCH',
  }),

  markAllRead: () => apiFetch('/notifications/read-all', {
    method: 'PATCH',
  }),
};

// =============================================================
// REVIEWS API
// =============================================================
const ReviewsAPI = {
  create: (data) => apiFetch('/reviews', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getByContract: (contractId) => apiFetch(`/reviews/contract/${contractId}`),

  getByUser: (userId) => apiFetch(`/reviews/user/${userId}`),

  // Alias lama — tetap ada untuk backward compat
  submit:      (data)       => apiFetch('/reviews', { method: 'POST', body: JSON.stringify(data) }),
  getForUser:  (userId)     => apiFetch(`/reviews/user/${userId}`),
  getForContract: (cid)     => apiFetch(`/reviews/contract/${cid}`),
};

// =============================================================
// DISPUTES API
// =============================================================
const DisputesAPI = {
  getMy: () => apiFetch('/disputes/my'),

  getById: (id) => apiFetch(`/disputes/${id}`),

  create: (data) => apiFetch('/disputes', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  addEvidence: (id, data) => apiFetch(`/disputes/${id}/evidence`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// =============================================================
// UPLOAD API — file upload via multipart/form-data
// =============================================================
const UploadAPI = {
  /**
   * Upload a file. type: 'ktm' | 'selfie' | 'deliverable' | 'evidence' | 'avatar' | ...
   * Returns { data: { url, file_name, ... } }
   */
  uploadFile: async (file, type = 'misc') => {
    if (!file) throw new Error('Tidak ada file dipilih');

    // Limit berbeda per tipe file
    const limits = {
      deliverable:   50,  // 50MB untuk deliverable
      evidence:      10,  // 10MB untuk bukti dispute
      payment_proof:  5,  // 5MB untuk bukti transfer
      ktm:            5,  // 5MB untuk KTM
      selfie:         5,
      avatar:         2,
      misc:           5,
    };
    const maxMB = limits[type] || 5;
    if (file.size > maxMB * 1024 * 1024) {
      throw new Error(`Ukuran file maksimal ${maxMB}MB untuk tipe ${type}`);
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);

    return apiFetch('/upload', {
      method: 'POST',
      body: fd,
    });
  },
};

/* ============================================================
 * HELPER FUNCTIONS — formatters
 * formatRupiah dipindah ke utils/helpers.js sebagai fmtCurrency;
 * di-keep di sini untuk kode legacy yang masih panggil window.formatRupiah.
 * Lainnya (formatDate, timeAgo, getTierBadge, getStatusBadge) sudah punya
 * counterpart di utils/helpers.js (fmtDate, fmtRelative, tierBadge, statusBadge).
 * ============================================================ */
function formatRupiah(amount) {
  if (typeof window.fmtCurrency === 'function') return window.fmtCurrency(amount);
  // Fallback kalau helpers.js belum loaded
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount || 0);
}

/* ============================================================
 * AUTH HELPERS — replace hardcoded USER_PROFILES
 * ============================================================ */

/**
 * Returns the role of the currently logged-in user, derived from
 * the JWT/auth payload (NOT from the login tab the user clicked).
 * Returns 'student' | 'biz' | 'admin' | null
 */
function getCurrentRole() {
  const user = AuthAPI.getCurrentUser();
  if (!user) return null;
  const role = (user.role || '').toLowerCase();
  if (role === 'admin') return 'admin';
  if (role === 'bisnis' || role === 'business' || role === 'biz') return 'biz';
  return 'student';
}

/**
 * Returns full profile object of the current user (from auth, not hardcoded).
 */
function getCurrentUserProfile() {
  const user = AuthAPI.getCurrentUser();
  if (!user) return null;
  return {
    id: user.id || user.sub,
    name: user.full_name || user.name || 'Pengguna',
    email: user.email,
    role: getCurrentRole(),
    bizName: user.business_name || user.bizName,
    avatar: user.avatar_url,
  };
}

/**
 * Display name to show in chat for the current user.
 */
function getChatDisplayName() {
  const p = getCurrentUserProfile();
  return p?.name || 'Pengguna';
}



/* ============================================================
 * EXPORT to window — legacy app.js consumes via globals
 * ============================================================ */
window.AuthAPI         = AuthAPI;
window.UsersAPI        = UsersAPI;
window.ProjectsAPI     = ProjectsAPI;
window.ApplicationsAPI = ApplicationsAPI;
window.ContractsAPI    = ContractsAPI;
window.PaymentsAPI     = PaymentsAPI;
window.AdminAPI        = AdminAPI;
window.MessagesAPI     = MessagesAPI;
window.ChatAPI         = ChatAPI;
window.NotificationsAPI = NotificationsAPI;
window.ReviewsAPI      = ReviewsAPI;
window.DisputesAPI     = DisputesAPI;
window.UploadAPI       = UploadAPI;

window.formatRupiah    = formatRupiah;
// Backward-compat: timeAgo dipindah ke helpers.js sebagai fmtRelative.
// Sediakan alias supaya kode lama yang panggil timeAgo() tetap jalan.
window.timeAgo         = function(dateStr) {
  if (typeof window.fmtRelative === 'function') return window.fmtRelative(dateStr);
  return '-';
};

window.getCurrentRole       = getCurrentRole;
window.getCurrentUserProfile = getCurrentUserProfile;
window.getChatDisplayName    = getChatDisplayName;
