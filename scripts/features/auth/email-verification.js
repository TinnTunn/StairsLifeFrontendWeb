/**
 * StairsLife — features/auth/email-verification.js
 *
 * Tiga fungsi utama:
 * 1. handleEmailVerifyDeepLink() — dipanggil saat load app dari URL /verify-email?token=...
 * 2. showCheckYourEmailScreen() — screen setelah register, "cek inbox kamu"
 * 3. resendVerificationEmail() — tombol "Kirim ulang"
 *
 * Depends on: AuthAPI, goTo, showToast, esc
 */
'use strict';

/**
 * Cek URL saat app load — kalau ada ?token=...&action=verify-email,
 * trigger verifikasi otomatis.
 *
 * Panggil ini di app.js bootstrap, SEBELUM auth check.
 */
async function handleEmailVerifyDeepLink() {
  const url = new URL(window.location.href);

  // Match path /verify-email atau query ?action=verify-email
  const isVerifyPath = url.pathname.endsWith('/verify-email');
  const action = url.searchParams.get('action');
  const token = url.searchParams.get('token');

  if (!token) return false;
  if (!isVerifyPath && action !== 'verify-email') return false;

  goTo('screen-email-verifying');

  try {
    const res = await AuthAPI.verifyEmail(token);
    showEmailVerifySuccess(res.message);
  } catch (e) {
    showEmailVerifyError(e.message || 'Gagal verifikasi email');
  }

  // Bersihkan query string dari URL biar tidak ke-share/ke-bookmark
  if (window.history?.replaceState) {
    window.history.replaceState({}, '', '/');
  }
  return true;
}

function showEmailVerifySuccess(message) {
  const el = document.getElementById('email-verify-content');
  if (!el) return;
  el.innerHTML = `
    <div style="text-align:center;padding:32px 16px">
      <div style="font-size:56px;margin-bottom:16px">🎉</div>
      <h2 style="font-size:20px;font-weight:800;margin-bottom:8px;color:var(--teal-dark)">
        Email Berhasil Diverifikasi!
      </h2>
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:24px;line-height:1.6">
        ${esc(message || 'Akun kamu sudah aktif. Silakan login untuk mulai.')}
      </p>
      <button class="btn btn-primary" style="min-width:200px" onclick="goTo('screen-login')">
        Lanjut ke Login →
      </button>
    </div>`;
}

function showEmailVerifyError(message) {
  const el = document.getElementById('email-verify-content');
  if (!el) return;
  el.innerHTML = `
    <div style="text-align:center;padding:32px 16px">
      <div style="font-size:56px;margin-bottom:16px">⚠️</div>
      <h2 style="font-size:20px;font-weight:800;margin-bottom:8px;color:var(--rose)">
        Verifikasi Gagal
      </h2>
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:24px;line-height:1.6">
        ${esc(message)}
      </p>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:24px">
        Link mungkin sudah kedaluwarsa (lewat 24 jam) atau sudah dipakai. Minta link baru di bawah.
      </p>
      <button class="btn btn-primary" style="min-width:200px;margin-bottom:8px"
        onclick="goTo('screen-resend-verification')">
        Kirim Ulang Link
      </button>
      <button class="btn btn-ghost" style="min-width:200px" onclick="goTo('screen-login')">
        Kembali ke Login
      </button>
    </div>`;
}

/**
 * Screen "cek email kamu" — ditampilkan setelah register sukses.
 * Email dipassing dari register form supaya bisa di-display.
 */
function showCheckYourEmailScreen(email) {
  // Simpan di sessionStorage supaya tetap available kalau user reload
  sessionStorage.setItem('sl_pending_verify_email', email);

  goTo('screen-check-email');
  const el = document.getElementById('check-email-content');
  if (!el) return;

  el.innerHTML = `
    <div style="text-align:center;padding:32px 16px">
      <div style="font-size:56px;margin-bottom:16px">📬</div>
      <h2 style="font-size:20px;font-weight:800;margin-bottom:8px">
        Cek Email Kamu!
      </h2>
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:20px;line-height:1.6">
        Kami sudah kirim link verifikasi ke<br>
        <strong style="color:var(--accent)">${esc(email)}</strong>
      </p>

      <div style="background:var(--bg-secondary);border-radius:12px;padding:16px;margin-bottom:24px;text-align:left">
        <p style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--text-primary)">
          📌 Langkah selanjutnya:
        </p>
        <ol style="font-size:13px;color:var(--text-secondary);padding-left:20px;line-height:1.8">
          <li>Buka email kamu (jangan lupa folder spam!)</li>
          <li>Klik tombol "Verifikasi Email Saya"</li>
          <li>Otomatis terlogin & bisa mulai eksplor</li>
        </ol>
      </div>

      <button class="btn btn-ghost" style="min-width:200px;margin-bottom:8px"
        id="resend-verify-btn"
        onclick="resendVerificationEmail()">
        🔄 Kirim Ulang Link
      </button>
      <br>
      <button class="btn btn-ghost btn-sm" onclick="goTo('screen-login')">
        Sudah verify? Login →
      </button>
    </div>`;
}

async function resendVerificationEmail() {
  const email =
    sessionStorage.getItem('sl_pending_verify_email') ||
    document.getElementById('login-email')?.value;

  if (!email) {
    showToast('Email tidak ditemukan. Coba login lagi.', 'error');
    return;
  }

  const btn = document.getElementById('resend-verify-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Mengirim...';
  }

  try {
    const res = await AuthAPI.resendVerification(email);
    showToast(res.message || 'Link verifikasi sudah dikirim ulang', 'success');

    // Disable button untuk 30 detik supaya tidak spam click
    if (btn) {
      let counter = 30;
      const interval = setInterval(() => {
        counter--;
        if (counter <= 0) {
          clearInterval(interval);
          btn.disabled = false;
          btn.textContent = '🔄 Kirim Ulang Link';
        } else {
          btn.textContent = `🔄 Kirim ulang dalam ${counter}s`;
        }
      }, 1000);
    }
  } catch (e) {
    showToast(e.message || 'Gagal kirim ulang', 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 Kirim Ulang Link';
    }
  }
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.handleEmailVerifyDeepLink   = handleEmailVerifyDeepLink;
window.showCheckYourEmailScreen    = showCheckYourEmailScreen;
window.resendVerificationEmail     = resendVerificationEmail;
