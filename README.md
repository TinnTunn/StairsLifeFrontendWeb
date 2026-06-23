# StairsLife Frontend — Design System Refresh

Frontend vanilla JS + Vite untuk StairsLife. Fungsionalitas penuh (project
asli + XSS patches + email verification/password reset + payment redirect
Xendit + upload utils) **dengan tampilan baru** mengikuti **StairsLife
Design System** — violet-family: electric violet × periwinkle spark ×
deep-indigo warm × ink-950 (light + dark theme-aware).

**Versi**: 3.0.0 (visual refresh)
**Stack**: Vanilla JS + Vite + Socket.io client

> Produk & alur tidak berubah — hanya identitas visual yang di-upgrade.
> Semua 32 screen, endpoint, dan wiring backend tetap sama persis.

---

## 🎨 Apa yang berubah di refresh ini

- **`styles/colors_and_type.css`** — token design system (warna, gradient,
  tipografi, radius, spacing, shadow, glass). Dimuat di `<head>` **sebelum**
  `main.css`, jadi seluruh aplikasi otomatis ikut tema baru.
- **`styles/main.css`** — blok `:root` di-rewire: nama variabel lama
  (`--accent`, `--teal`, dst.) menunjuk ke token design system
  (`--brand` #5B5BF5, `--mint-500`, dst.). Re-skin di satu tempat = semua screen.
- **Set-piece** sesuai design system: hero → *aurora mesh* ink-950 +
  highlight citron-lime di bawah judul; stats → flat brand violet;
  CTA → warm-wash deep-indigo; hero/profile/project-detail dark card →
  ink-950 → indigo; modal backdrop → ink overlay.
- **Tipografi display** → Schibsted Grotesk untuk headline;
  Manrope untuk body & wordmark.
- **Dark mode** → navy-blue elevation ladder (#0B1124 → #070C1B → #15203D → #1F2D50), theme-aware semua komponen.
- **Favicon + aset brand** → `assets/` (favicon, logo-mark, logo-wordmark).
- **Admin charts** (Chart.js) → palet warna design system.
- Semua warna lama (indigo #6366F1 / teal #14B8A6) sudah dikonversi penuh
  termasuk di inline style & chart.

---

## 🚀 Quick Start


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
