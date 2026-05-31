# StairsLife Frontend — Production Build v2

Frontend vanilla JS + Vite untuk StairsLife: project asli + 14 XSS patches
(v1) + Sprint Week 1 (email verification + password reset screens).

**Versi**: 2.0.0
**Stack**: Vanilla JS + Vite + Socket.io client

---

## 🚀 Quick Start

```bash
# 1. Install
npm install

# 2. Run dev
npm run dev
```

Frontend jalan di **http://localhost:5173**.

Backend API endpoint default ke `http://localhost:3000/api/v1`. Override
via console (untuk test prod backend lokal):

```js
window.__SL_API_BASE_URL__ = 'https://api.stairslife.id/api/v1';
location.reload();
```

---

## 🏗️ Yang sudah ada di versi ini

### Security (dari patches v1)
- ✅ `esc()` & `escAttr()` helper di `utils/helpers.js` untuk XSS prevention
- ✅ Semua data user (chat, project title, owner name, dll) di-escape di:
  - chat (pesan, support)
  - student/business project list
  - admin users, projects, finance, support panel
  - contracts (status bar, dispute reasons, deliverable notes)
  - settings (bank account)
  - notifications
  - payments
  - disputes
- ✅ Auth flow refresh token rolling + proactive refresh

### Sprint Week 1
- ✅ Email verification deep link handler (`/verify-email?token=...`)
- ✅ Password reset deep link handler (`/reset-password?token=...`)
- ✅ Screen "Cek email kamu" setelah register
- ✅ Screen resend verification link
- ✅ Screen form password baru (saat reset)
- ✅ `AuthAPI.verifyEmail`, `resendVerification`, `resetPassword` di `api.js`

---

## 🧪 Smoke Test

1. **Register baru**:
   - Email pakai alamat asli yang bisa kamu cek
   - Setelah klik "Daftar", harus muncul screen "📬 Cek Email Kamu"
   - Cek email — link verifikasi harus masuk

2. **Klik link verifikasi**:
   - URL akan jadi `http://localhost:5173/?token=...`
   - Atau: `http://localhost:5173/verify-email?token=...`
   - Harus muncul screen "🎉 Email Berhasil Diverifikasi"

3. **Lupa password**:
   - Login screen → klik "Lupa Password?"
   - Masukkan email → submit
   - Cek email → klik link reset
   - Harus muncul form password baru

---

## 📂 Struktur

```
frontend/
├── index.html                                         (+5 new auth screens)
├── package.json
├── vite.config.js
├── scripts/
│   ├── api.js                                         (+verifyEmail, +resendVerification, +resetPassword)
│   ├── app.js                                         (+deep link handlers di bootstrap)
│   ├── core/
│   │   ├── api-core.js                                (refresh engine)
│   │   ├── auth.js                                    (login/register, +route ke check-email after register)
│   │   ├── router.js
│   │   └── theme.js
│   ├── utils/
│   │   ├── helpers.js                                 (+esc, +escAttr — XSS protection)
│   │   ├── toast.js
│   │   ├── storage.js
│   │   ├── skeleton.js
│   │   └── socket.js
│   └── features/
│       ├── auth/                                      (NEW — sprint week 1)
│       │   ├── email-verification.js
│       │   └── password-reset.js
│       ├── admin/        (XSS-patched)
│       ├── business/     (XSS-patched)
│       ├── chat/         (XSS-patched)
│       ├── contracts/    (XSS-patched)
│       ├── disputes/     (XSS-patched)
│       ├── notifications/(XSS-patched)
│       ├── payments/     (XSS-patched)
│       ├── reviews/
│       ├── settings/     (XSS-patched)
│       ├── student/      (XSS-patched)
│       └── verification/
└── styles/
    └── main.css
```

---

## 🐛 Troubleshooting

### Deep link verify-email tidak trigger
Pastikan `scripts/features/auth/email-verification.js` ter-load **sebelum**
`scripts/app.js`. Cek `index.html` urutan `<script>` — sudah benar di
versi ini.

### Tombol "Login dengan Google" di register tidak ada
Itu fitur minggu 2 (Google OAuth). Belum ada di versi ini.

### `esc is not defined`
Pastikan `scripts/utils/helpers.js` di-load **sebelum** file feature.
Cek `index.html` — sudah benar di versi ini.
