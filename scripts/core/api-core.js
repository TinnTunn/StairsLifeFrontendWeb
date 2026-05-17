/* ============================================================
 * StairsLife — Core API Client
 * ------------------------------------------------------------
 * Centralized fetch wrapper with:
 *   - Environment-aware base URL (no more hardcoded localhost)
 *   - 401 interceptor (auto logout on expired token)
 *   - 15s timeout via AbortController
 *   - 1x retry on transient network failure
 *   - Token management
 * ============================================================ */
'use strict';

/* ------------------------------------------------------------
 * 1. ENVIRONMENT-AWARE BASE URL
 * ------------------------------------------------------------
 * Resolves automatically by hostname. Override with
 * window.__SL_API_BASE_URL__ before the script runs if needed.
 * ------------------------------------------------------------ */
const API_BASE_URL = (() => {
  if (typeof window !== 'undefined' && window.__SL_API_BASE_URL__) {
    return window.__SL_API_BASE_URL__;
  }
  const host = (typeof window !== 'undefined' && window.location)
    ? window.location.hostname
    : 'localhost';
  if (host === 'localhost' || host === '127.0.0.1' || host === '') {
    return 'http://localhost:3000/api/v1';
  }
  if (host.includes('staging')) {
    return 'https://staging-api.stairslife.id/api/v1';
  }
  return 'https://stairslifebackendweb-production.up.railway.app/api/v1';
})();

/* ------------------------------------------------------------
 * 2. TOKEN MANAGER
 * ------------------------------------------------------------ */
const TokenManager = {
  // Access token
  get:        ()      => localStorage.getItem('sl_token'),
  set:        (token) => localStorage.setItem('sl_token', token),
  remove:     ()      => localStorage.removeItem('sl_token'),

  // Refresh token
  getRefresh: ()      => localStorage.getItem('sl_refresh_token'),
  setRefresh: (token) => localStorage.setItem('sl_refresh_token', token),
  removeRefresh: ()   => localStorage.removeItem('sl_refresh_token'),

  // User profile
  getUser: () => {
    try {
      const raw = localStorage.getItem('sl_user');
      return raw ? JSON.parse(raw) : null;
    } catch (_e) {
      return null;
    }
  },
  setUser:    (user)  => localStorage.setItem('sl_user', JSON.stringify(user)),
  removeUser: ()      => localStorage.removeItem('sl_user'),

  clear: () => {
    localStorage.removeItem('sl_token');
    localStorage.removeItem('sl_refresh_token');
    localStorage.removeItem('sl_user');
  },

  /**
   * Parse JWT payload tanpa library.
   * Kembalikan objek payload, atau null jika token invalid/kosong.
   */
  parseJwt: (token) => {
    try {
      if (!token) return null;
      const payload = token.split('.')[1];
      if (!payload) return null;
      // atob dengan URL-safe base64 fix
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (_e) {
      return null;
    }
  },

  /**
   * Kembalikan sisa waktu (ms) sampai token expired.
   * Negatif = sudah expired. null = tidak bisa dibaca.
   */
  msUntilExpiry: (token) => {
    const payload = TokenManager.parseJwt(token || TokenManager.get());
    if (!payload?.exp) return null;
    return payload.exp * 1000 - Date.now();
  },
};

/* ------------------------------------------------------------
 * 3. PROACTIVE TOKEN REFRESH ENGINE
 * ------------------------------------------------------------ */
const REFRESH_LEAD_MS   = 60_000;  // refresh 60 detik sebelum expire
const REFRESH_ENDPOINT  = '/auth/refresh';
let   _refreshTimer     = null;
let   _isRefreshing     = false;
let   _refreshPromise   = null;   // deduplicate concurrent refresh calls

/**
 * Minta access token baru menggunakan refresh token.
 * Kembalikan access token baru, atau throw jika gagal.
 */
async function _doRefresh() {
  const refreshToken = TokenManager.getRefresh();
  if (!refreshToken) throw new Error('No refresh token');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(`${API_BASE_URL}${REFRESH_ENDPOINT}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refreshToken }),
      signal:  controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) throw new Error(`Refresh failed: HTTP ${resp.status}`);
    const data = await resp.json();
    const newAccess  = data?.data?.token  || data?.access_token  || data?.token;
    const newRefresh = data?.data?.refresh_token || data?.refresh_token;

    if (!newAccess) throw new Error('Invalid refresh response');

    TokenManager.set(newAccess);
    if (newRefresh) TokenManager.setRefresh(newRefresh);
    _scheduleProactiveRefresh(); // reschedule untuk token baru
    return newAccess;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Jadwalkan refresh otomatis REFRESH_LEAD_MS sebelum token expire.
 * Aman dipanggil berkali-kali — hanya ada satu timer aktif.
 */
function _scheduleProactiveRefresh() {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = null;

  const token = TokenManager.get();
  if (!token || !TokenManager.getRefresh()) return;

  const msLeft = TokenManager.msUntilExpiry(token);
  if (msLeft === null) return; // token tidak ber-exp claim, skip

  const delay = Math.max(0, msLeft - REFRESH_LEAD_MS);
  if (msLeft <= 0) {
    // Sudah expired — coba refresh segera
    _triggerRefresh();
    return;
  }

  _refreshTimer = setTimeout(_triggerRefresh, delay);
  console.debug(`[TokenRefresh] Scheduled in ${Math.round(delay / 1000)}s`);
}

async function _triggerRefresh() {
  if (_isRefreshing) return; // sudah ada refresh berjalan
  _isRefreshing = true;
  try {
    await _doRefresh();
    console.debug('[TokenRefresh] Proactive refresh OK');
  } catch (err) {
    console.warn('[TokenRefresh] Proactive refresh failed:', err.message);
    // Jangan langsung logout — biar 401 interceptor yang tangani
  } finally {
    _isRefreshing = false;
  }
}

/* ------------------------------------------------------------
 * 4. 401 INTERCEPTOR (upgrade: coba refresh sebelum logout)
 * ------------------------------------------------------------ */
const REQUEST_TIMEOUT_MS = 15000;
let _unauthorizedHandled = false;

function _forceLogout() {
  if (_unauthorizedHandled) return;
  _unauthorizedHandled = true;
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
  TokenManager.clear();
  if (typeof window.showToast === 'function') {
    window.showToast('Sesi kamu telah berakhir. Silakan login kembali.', 'error');
  }
  setTimeout(() => {
    _unauthorizedHandled = false;
    if (typeof window.goTo === 'function') {
      window.goTo('screen-login');
    } else {
      window.location.hash = '#screen-login';
    }
  }, 1200);
}

/**
 * Dipanggil saat menerima HTTP 401.
 * Coba refresh token dulu. Jika berhasil kembalikan token baru.
 * Jika gagal → paksa logout.
 */
async function _onUnauthorized() {
  // Deduplication: jika sudah ada refresh berjalan, tunggu hasilnya
  if (_isRefreshing && _refreshPromise) {
    try {
      return await _refreshPromise; // token baru dari refresh concurrent
    } catch (_e) {
      _forceLogout();
      return null;
    }
  }

  if (!TokenManager.getRefresh()) {
  // Jika masih punya access token valid, jangan logout
    const currentToken = TokenManager.get();
    if (currentToken) {
      _forceLogout();
    }
  return null;
}

  _isRefreshing    = true;
  _refreshPromise  = _doRefresh();
  try {
    const newToken = await _refreshPromise;
    console.debug('[TokenRefresh] 401-triggered refresh OK');
    return newToken;
  } catch (err) {
    console.warn('[TokenRefresh] 401-triggered refresh failed:', err.message);
    _forceLogout();
    return null;
  } finally {
    _isRefreshing   = false;
    _refreshPromise = null;
  }
}

/* ------------------------------------------------------------
 * 5. CORE FETCH WRAPPER
 * ------------------------------------------------------------ */
async function _doFetch(endpoint, options, attempt = 0) {
  const token = TokenManager.get();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Endpoint auth tidak perlu intercept 401 (login/register gagal = kredensial salah)
  const isAuthEndpoint = endpoint.startsWith('/auth/login') ||
                         endpoint.startsWith('/auth/register') ||
                         endpoint.startsWith('/auth/refresh');

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    // 401 handling
    if (response.status === 401) {
      // Untuk auth endpoint: ambil pesan dari body backend (misal: "Email atau password salah")
      if (isAuthEndpoint) {
        let errMsg = 'Email atau password salah';
        try {
          const errData = await response.json();
          errMsg = errData.message || errData.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      // Untuk endpoint lain: coba refresh token dulu (attempt 0 saja)
      if (attempt === 0) {
        const newToken = await _onUnauthorized();
        if (newToken) {
          // Refresh berhasil → retry dengan token baru
          return _doFetch(endpoint, options, attempt + 1);
        }
      }
      // Refresh gagal
      throw new Error('Sesi tidak valid');
    }

    // 204 No Content
    if (response.status === 204) {
      return { success: true, data: null };
    }

    // HTTP error lain — ambil pesan dari body
    let data;
    try {
      data = await response.json();
    } catch (_e) {
      data = {};
    }

    if (!response.ok) {
      // Map status code ke pesan yang lebih jelas
      const statusMessages = {
        400: data.message || data.error || 'Data tidak valid',
        403: 'Akses ditolak',
        404: 'Data tidak ditemukan',
        409: data.message || 'Data sudah ada / konflik',
        422: data.message || 'Data tidak dapat diproses',
        429: 'Terlalu banyak permintaan, coba lagi sebentar',
        500: 'Server error, coba lagi nanti',
        503: 'Server sedang tidak tersedia',
      };
      throw new Error(
        statusMessages[response.status] ||
        data.message || data.error ||
        `HTTP ${response.status}`
      );
    }
    return data;
  } catch (error) {
    clearTimeout(timer);

    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Periksa koneksi internet kamu.');
    }

    // Retry sekali untuk GET/HEAD pada network failure
    const method = (options.method || 'GET').toUpperCase();
    const isIdempotent = method === 'GET' || method === 'HEAD';
    if (
      attempt === 0 &&
      isIdempotent &&
      (error.message === 'Failed to fetch' || error.message === 'Network request failed')
    ) {
      await new Promise((r) => setTimeout(r, 400));
      return _doFetch(endpoint, options, attempt + 1);
    }

    if (error.message === 'Failed to fetch') {
      throw new Error('Tidak dapat terhubung ke server. Pastikan server berjalan.');
    }
    throw error;
  }
}

async function apiFetch(endpoint, options = {}) {
  return _doFetch(endpoint, options, 0);
}

/* ------------------------------------------------------------
 * 6. EXPORT
 * ------------------------------------------------------------ */
window.API_BASE_URL             = API_BASE_URL;
window.TokenManager             = TokenManager;
window.apiFetch                 = apiFetch;
window._scheduleProactiveRefresh = _scheduleProactiveRefresh;
