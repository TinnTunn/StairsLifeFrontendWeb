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

  // POST /auth/verify-email — konsumsi token dari email, set email_verified_at
  verifyEmail: (token) => apiFetch('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  }),

  // POST /auth/resend-verification — minta link verifikasi baru
  resendVerification: (email) => apiFetch('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),

  // POST /auth/reset-password — set password baru dengan token dari email
  resetPassword: (token, new_password) => apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password }),
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

  // GET /users/:id — public profile termasuk reviews & rating distribution.
  // Dipakai saat klik nama bisnis/mahasiswa dari project detail / kontrak.
  getPublicProfile: (userId) => apiFetch(`/users/${userId}`),

  // GET /users/:id/portfolio — auto-portfolio dari completed contracts.
  // Bukan upload manual: berisi semua project yang sudah mahasiswa selesaikan,
  // dengan info klien, kategori, budget, rating. Auto-update setiap kali ada
  // contract baru completed (tidak ada caching, jadi selalu fresh).
  getPortfolio: (userId) => apiFetch(`/users/${userId}/portfolio`),
  getMyPortfolio: () => {
    const me = (typeof TokenManager !== 'undefined') ? TokenManager.getUser() : null;
    if (!me?.id) return Promise.reject(new Error('Tidak login'));
    return apiFetch(`/users/${me.id}/portfolio`);
  },

  // Bank accounts — delegasi ke BankAccountsAPI (endpoint /bank-accounts).
  // Dulu stub "belum tersedia"; sekarang backend sudah ada & dipakai wallet.
  getBankAccounts:    ()     => BankAccountsAPI.list(),
  saveBankAccount:    (data) => BankAccountsAPI.create(data),
  deleteBankAccount:  (id)   => BankAccountsAPI.delete(id),
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

  // Mahasiswa batalkan lamaran sendiri (hanya pending/shortlisted)
  withdraw: (id) => apiFetch(`/applications/${id}`, { method: 'DELETE' }),
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
  // ─── XENDIT FLOW (primary) ──────────────────────────────
  /**
   * Bisnis trigger pembayaran via Xendit.
   * Backend create invoice & return { invoice_url, payment_id, ... }.
   * FE redirect / buka tab ke invoice_url.
   *
   * @param data { contract_id, amount, invoice_duration? }
   */
  createInvoice: (data) => apiFetch('/payments/invoice', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  /**
   * Cek status payment ke Xendit (fallback kalau webhook miss).
   * Dipanggil setelah user balik dari Xendit redirect.
   */
  syncPayment: (id) => apiFetch(`/payments/${id}/sync`),

  // ─── LEGACY MANUAL ESCROW (fallback / admin override) ──
  holdEscrow: (data) => apiFetch('/payments/escrow', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  releaseEscrow: (id) => apiFetch(`/payments/escrow/${id}/release`, {
    method: 'PATCH',
  }),

  // ─── QUERIES ────────────────────────────────────────────
  getMyPayments: () => apiFetch('/payments/my'),

  getByContract: (contractId) =>
    apiFetch(`/payments/contract/${contractId}`),
};

// =============================================================
// BANK ACCOUNTS API (mahasiswa)
// =============================================================
const BankAccountsAPI = {
  create: (data) => apiFetch('/bank-accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  list:        ()   => apiFetch('/bank-accounts'),
  detail:      (id) => apiFetch(`/bank-accounts/${id}`),
  setPrimary:  (id) => apiFetch(`/bank-accounts/${id}/primary`, { method: 'PATCH' }),
  delete:      (id) => apiFetch(`/bank-accounts/${id}`, { method: 'DELETE' }),
};

// =============================================================
// WITHDRAWALS API
// =============================================================
const WithdrawalsAPI = {
  // Mahasiswa
  getWallet:   ()       => apiFetch('/withdrawals/wallet'),
  create:      (data)   => apiFetch('/withdrawals', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getMy:       ()       => apiFetch('/withdrawals/my'),

  // Admin
  listAll: (status, page = 1, limit = 20) => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    qs.set('page', String(page));
    qs.set('limit', String(limit));
    return apiFetch(`/withdrawals?${qs.toString()}`);
  },
  process: (id, payload) => apiFetch(`/withdrawals/${id}/process`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
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
  getAuditLogs:      (limit=50) => apiFetch(`/admin/audit-logs?limit=${limit}`),
  // Access Control (admin roles registry)
  getRoles:    ()        => apiFetch('/admin/roles'),
  createRole:  (data)    => apiFetch('/admin/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole:  (id, data)=> apiFetch(`/admin/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRole:  (id)      => apiFetch(`/admin/roles/${id}`, { method: 'DELETE' }),
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
  // INQUIRY CHAT (pre-contract chat — mahasiswa ↔ bisnis sebelum apply)
  // Backend endpoint: /chat/inquiry/:otherUserId/messages
  // Storage: tabel support_messages dengan room_id = inquiry-{a}-{b}
  // ---------------------------------------------------------------

  /**
   * Ambil semua pesan inquiry dengan user tertentu.
   * Return: { data: { room_id, other_user, messages: [...] } }
   */
  getInquiryMessages: (otherUserId) =>
    apiFetch(`/chat/inquiry/${otherUserId}/messages`),

  /**
   * Kirim pesan inquiry ke user.
   * Return: { data: { ...message, sender: {...} } }
   */
  sendInquiry: (otherUserId, content) =>
    apiFetch(`/chat/inquiry/${otherUserId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  /**
   * List semua room inquiry user — untuk inbox.
   * Return: { data: [{ room_id, other_user, last_message, ... }] }
   */
  getInquiryRooms: () => apiFetch('/chat/inquiry-rooms'),
  // Alias — beberapa pemanggil (business.js) memakai nama getInquiries.
  getInquiries: () => apiFetch('/chat/inquiry-rooms'),

  // Support chat (mahasiswa/bisnis ↔ admin)
  getSupportRoom: () => apiFetch('/chat/support'),

  sendSupport: (content) => apiFetch('/chat/support/messages', {
    method: 'POST',
    body: JSON.stringify({ content }),
  }),

  // Mediation chat (dispute) — persisten via /chat/mediation/:disputeId/messages.
  // Peserta: student & business dari kontrak + admin (otorisasi di backend).
  getMediationRoom: (disputeId) =>
    apiFetch(`/chat/mediation/${disputeId}/messages`),

  sendMediation: (disputeId, content) =>
    apiFetch(`/chat/mediation/${disputeId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
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

  delete: (id) => apiFetch(`/notifications/${id}`, {
    method: 'DELETE',
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
  // Tipe yang diterima backend — HARUS sinkron dengan VALID_TYPES di
  // upload.controller.ts (avatar|ktm|selfie|deliverable|evidence). Tipe di
  // luar daftar ini ditolak backend (400), jadi kita validasi di sini supaya
  // gagal cepat dengan pesan jelas tanpa bolak-balik network.
  ALLOWED_TYPES: ['avatar', 'ktm', 'selfie', 'deliverable', 'evidence'],

  /**
   * Upload a file. type: 'avatar' | 'ktm' | 'selfie' | 'deliverable' | 'evidence'
   * Returns { data: { url, file_name, ... } }
   */
  uploadFile: async (file, type) => {
    if (!file) throw new Error('Tidak ada file dipilih');

    if (!UploadAPI.ALLOWED_TYPES.includes(type)) {
      throw new Error(
        `Tipe upload "${type ?? '(kosong)'}" tidak didukung. ` +
        `Gunakan salah satu: ${UploadAPI.ALLOWED_TYPES.join(', ')}.`
      );
    }

    // Limit ukuran per tipe — FE sengaja lebih konservatif dari backend
    // (deliverable 50MB, bukti dispute 10MB, sisanya 5MB; selaras teks di
    // settings.js/verification.js). Backend membatasi 10MB untuk non-deliverable.
    const limits = {
      deliverable: 50,  // 50MB untuk deliverable
      evidence:    10,  // 10MB untuk bukti dispute
      ktm:          5,  // 5MB untuk KTM
      selfie:       5,
      avatar:       5,  // 5MB — selaras dgn cek & teks di settings.js (foto kamera HP umumnya >2MB)
    };
    const maxMB = limits[type] || 5;
    if (file.size > maxMB * 1024 * 1024) {
      throw new Error(`Ukuran file maksimal ${maxMB}MB untuk tipe ${type}`);
    }

    const fd = new FormData();
    // Append 'type' DULU sebelum 'file' — multer fileFilter di backend
    // membaca req.body.type untuk menentukan format yang diizinkan
    // (deliverable bisa zip/docx/mp4 dst, lainnya hanya jpg/png/pdf).
    // Field text yang datang sebelum file akan tersedia di fileFilter.
    fd.append('type', type);
    fd.append('file', file);

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
    bizName: user.company_name || user.business_name || user.bizName,
    avatar: user.avatar_url,
  };
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
window.BankAccountsAPI = BankAccountsAPI;
window.WithdrawalsAPI  = WithdrawalsAPI;
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
