/**
 * StairsLife — features/auth/password-reset.js
 *
 * Flow:
 * 1. User klik "Lupa Password?" di login → showForgotPasswordScreen()
 * 2. User submit email → handleForgotPasswordSubmit() → toast sukses (always)
 * 3. User klik link di email → URL ?token=...&action=reset-password
 * 4. handlePasswordResetDeepLink() → show form password baru
 * 5. User submit → handleResetPasswordSubmit() → redirect ke login
 *
 * Depends on: AuthAPI, goTo, showToast, esc
 */
'use strict';

async function handlePasswordResetDeepLink() {
  const url = new URL(window.location.href);
  const isResetPath = url.pathname.endsWith('/reset-password');
  const action = url.searchParams.get('action');
  const token = url.searchParams.get('token');

  if (!token) return false;
  if (!isResetPath && action !== 'reset-password') return false;

  // Simpan token di memory (jangan di URL bar selanjutnya)
  window._pendingResetToken = token;

  // Bersihkan URL
  if (window.history?.replaceState) {
    window.history.replaceState({}, '', '/');
  }

  showPasswordResetForm();
  return true;
}

function showPasswordResetForm() {
  goTo('screen-reset-password');
  const el = document.getElementById('reset-password-content');
  if (!el) return;

  el.innerHTML = `
    <div style="padding:24px 16px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:48px;margin-bottom:12px">🔑</div>
        <h2 style="font-size:20px;font-weight:800;margin-bottom:6px">
          Buat Password Baru
        </h2>
        <p style="font-size:13px;color:var(--text-secondary)">
          Masukkan password baru untuk akun StairsLife kamu
        </p>
      </div>

      <div class="form-group">
        <label class="form-label">Password Baru <span class="req">*</span></label>
        <input type="password" id="reset-new-pwd" class="form-input"
          placeholder="Minimal 8 karakter" autocomplete="new-password">
      </div>

      <div class="form-group">
        <label class="form-label">Konfirmasi Password <span class="req">*</span></label>
        <input type="password" id="reset-confirm-pwd" class="form-input"
          placeholder="Ketik ulang password" autocomplete="new-password">
      </div>

      <div style="padding:12px;background:var(--bg-secondary);border-radius:8px;font-size:12px;color:var(--text-secondary);margin-bottom:16px;line-height:1.6">
        💡 <strong>Tips password kuat:</strong><br>
        Minimal 8 karakter, kombinasi huruf besar/kecil, angka, dan simbol.
      </div>

      <button class="btn btn-primary" style="width:100%;height:48px" id="reset-submit-btn"
        onclick="handleResetPasswordSubmit()">
        🔑 Reset Password
      </button>

      <div style="text-align:center;margin-top:16px">
        <button class="btn" style="padding:6px 12px;color:var(--text-muted);font-size:13px"
          onclick="goTo('screen-login')">
          ← Kembali ke Login
        </button>
      </div>
    </div>`;
}

async function handleResetPasswordSubmit() {
  const newPwd = document.getElementById('reset-new-pwd')?.value || '';
  const confirmPwd = document.getElementById('reset-confirm-pwd')?.value || '';

  if (newPwd.length < 8) {
    showToast('Password minimal 8 karakter', 'error');
    return;
  }
  if (newPwd !== confirmPwd) {
    showToast('Konfirmasi password tidak cocok', 'error');
    return;
  }

  const token = window._pendingResetToken;
  if (!token) {
    showToast('Token tidak ditemukan. Minta link baru.', 'error');
    return;
  }

  const btn = document.getElementById('reset-submit-btn');
  return withSubmitLock(btn, async () => {
    try {
      await AuthAPI.resetPassword(token, newPwd);
      showToast('Password berhasil direset. Silakan login.', 'success');
      window._pendingResetToken = null;
      setTimeout(() => goTo('screen-login'), 900);
    } catch (e) {
      showToast(e.message || 'Gagal reset password', 'error');
    }
  }, '⏳ Mereset...');
}

function showForgotPasswordScreen() {
  // Screen yang benar adalah 'screen-forgot' (form statis di index.html
  // yang submit-nya pakai handleForgotPassword di auth.js). 'screen-forgot-password'
  // tidak pernah ada — fungsi ini dead-code/legacy, tetap diarahkan benar.
  goTo('screen-forgot');
  const el = document.getElementById('forgot-password-content');
  if (!el) return;

  el.innerHTML = `
    <div style="padding:24px 16px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:48px;margin-bottom:12px">📧</div>
        <h2 style="font-size:20px;font-weight:800;margin-bottom:6px">
          Lupa Password?
        </h2>
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.6">
          Masukkan email akun kamu — kami kirim link untuk buat password baru.
        </p>
      </div>

      <div class="form-group">
        <label class="form-label">Email <span class="req">*</span></label>
        <input type="email" id="forgot-email" class="form-input"
          placeholder="nama@email.com" autocomplete="email">
      </div>

      <button class="btn btn-primary" style="width:100%;height:48px" id="forgot-submit-btn"
        onclick="handleForgotPasswordSubmit()">
        Kirim Link Reset
      </button>

      <button class="btn btn-ghost" style="width:100%;margin-top:12px"
        onclick="goTo('screen-login')">
        ← Kembali ke Login
      </button>
    </div>`;
}

async function handleForgotPasswordSubmit() {
  const email = document.getElementById('forgot-email')?.value.trim();

  if (!email || !email.includes('@')) {
    showToast('Masukkan email yang valid', 'error');
    return;
  }

  const btn = document.getElementById('forgot-submit-btn');
  return withSubmitLock(btn, async () => {
    try {
      const res = await AuthAPI.forgotPassword(email);
      // SECURITY: backend selalu return sukses (tidak bocorkan email exists).
      // FE juga selalu tampilkan pesan yang sama.
      showToast(
        res.message || 'Cek email kamu untuk link reset password',
        'success',
      );
      setTimeout(() => goTo('screen-login'), 1500);
    } catch (e) {
      showToast(e.message || 'Gagal mengirim email reset', 'error');
    }
  }, '⏳ Mengirim...');
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.handlePasswordResetDeepLink = handlePasswordResetDeepLink;
window.showPasswordResetForm       = showPasswordResetForm;
window.handleResetPasswordSubmit   = handleResetPasswordSubmit;
window.showForgotPasswordScreen    = showForgotPasswordScreen;
window.handleForgotPasswordSubmit  = handleForgotPasswordSubmit;
