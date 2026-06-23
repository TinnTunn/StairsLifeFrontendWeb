# StairsLife Frontend — Changelog Audit (Anti Double-Submit + Render Fix)

Tanggal: 24 Mei 2026
Scope: Frontend Vanilla JS

## Akar Masalah Yang Diatasi

User melaporkan project duplikat setelah post project. Audit menemukan: tombol
submit `🚀 Pasang Project Sekarang` tidak punya proteksi double-tap. Saat user
tap dua kali cepat (umum di mobile + jaringan lambat), `handlePostProject`
jalan 2x → 2 POST → 2 row di DB.

Pola IDENTIK ditemukan di 16+ handler lain di seluruh codebase. Sekarang
semua handler kritis sudah dilindungi dengan in-flight lock.

## File Baru/Modifikasi

### 1. `scripts/utils/helpers.js` — UTILITY BARU

`withSubmitLock(btn, asyncFn, loadingLabel)`:

- Reusable wrapper anti double-submit.
- WeakSet-based flag per-element (tidak leak memory).
- Auto-disable tombol + ganti label ke loading state.
- Auto-restore di `finally`, aman walau elemen sudah unmount.

Diekspor ke `window.withSubmitLock`.

### 2. `index.html`

Tombol "🚀 Pasang Project Sekarang":

```html
<!-- BEFORE -->
<button onclick="handlePostProject()">

<!-- AFTER -->
<button onclick="handlePostProject(this)">
```

### 3. Handler Migrasi (per-file)

Tiga pola lock dipakai sesuai kebutuhan:

- **Module-scope flag** (`let _xxxInFlight = false`) — untuk handler yang
  dipanggil tanpa konteks id (mis. submit form global, login, register).
- **Set per-id** (`const _xxxInFlight = new Set()`) — untuk handler yang
  beroperasi per resource id (mis. accept lamaran X, delete project Y); user
  tetap boleh trigger handler yang sama untuk resource berbeda secara paralel.
- **`withSubmitLock` utility** — untuk handler dengan tombol HTML statis
  (mis. password reset form).

#### Files modified:

| File | Handler | Pattern |
|------|---------|---------|
| `core/auth.js` | `handleLogin`, `handleForgotPassword`, `finishRegistration` | Module flag |
| `features/auth/password-reset.js` | `handleResetPasswordSubmit`, `handleForgotPasswordSubmit` | `withSubmitLock` |
| `features/verification/verification.js` | `submitVerification` | Module flag |
| `features/settings/settings.js` | `saveEditProfile`, `saveBankAccount` | Module flag |
| `features/student/projects.js` | `submitApply` | Module flag |
| `features/payments/payments.js` | `submitEscrowAndContract`, `approveDeliverableAndRelease` | Mix |
| `features/contracts/contracts.js` | `submitDeliverable`, `_confirmRejectDeliverable` | Module flag |
| `features/reviews/reviews.js` | `submitReview` | Module flag |
| `features/disputes/disputes.js` | `submitNewDispute` | Module flag |
| `features/business/projects.js` | `handlePostProject` + 5 handler lain | Mix |
| `features/admin/verif.js` | `adminApproveVerifAPI`, `_confirmRejectVerif` | Set per-id |
| `features/admin/disputes.js` | `_confirmResolveDispute` | Set per-id |
| `features/admin/users.js` | `_confirmAdminDeleteUser`, `_confirmSuspendUser`, `adminToggleSuspendUser` | Set per-id |
| `features/admin/support.js` | `adminUnsuspendUser` | Set per-id |
| `features/admin/announcements.js` | `adminSendAnnouncement` | Module flag |

### 4. Bonus: Security Fix di `renderBizRecentProjectsFromAPI`

File `features/business/projects.js`:

- Sebelumnya tidak pakai `esc()` untuk `p.title` dan `p.category` → bisa XSS
  kalau title disisipi `<script>` (low impact karena self-XSS, tapi
  inconsistent dengan rest of codebase).
- Sekarang pakai `esc()` untuk semua field text.
- Plus dedup by `id` sama dengan `renderMyProjectsAPI`.

## Yang TIDAK Berubah

- Tidak ada perubahan API contract / signature.
- Tidak ada perubahan struktur file/folder.
- Existing handler tetap callable dengan signature lama (lock guard ada di
  awal function, sebelum logic).

## Test Skenario

### Skenario 1: Double-tap post project (KASUS UTAMA USER)

1. Login sebagai bisnis
2. Buka "Pasang Project Baru"
3. Isi form lengkap
4. **Tap "Pasang Project Sekarang" 5x cepat dalam 1 detik**

Expected:
- Tombol langsung disable + label berubah ke "⏳ Memposting..." setelah tap
  pertama
- Tap berikutnya diabaikan (lock di WeakSet via `withSubmitLock`)
- Hanya 1 project muncul di "My Projects"
- Defense layer 2 (backend) — kalau ada race tetap aman karena
  `findRecentDuplicate` block insert kedua

### Skenario 2: Double-tap accept lamaran

1. Login sebagai bisnis dengan lamaran masuk
2. Tap "✅ Terima" 3x cepat di lamaran yang sama

Expected: hanya 1 escrow modal muncul, button text berubah ke "⏳"

### Skenario 3: Network slow + double-tap submit verification

1. Throttle network ke "Slow 3G" di DevTools
2. Sebagai mahasiswa, upload KTM + selfie
3. Tap "Submit Verifikasi" 2x

Expected: hanya 1 entry verifikasi muncul di admin panel

### Skenario 4: Admin announcement double-tap

1. Login admin
2. Tap "Kirim Broadcast" 2x cepat

Expected: 1 announcement tersimpan + 1 set notifikasi terkirim ke users
(bukan 2x notifikasi).

## Run

```bash
cd frontend
npm install
npm run dev
```

Auto hot-reload akan detect perubahan. Tidak perlu rebuild.

## Yang Masih Perlu Dikerjakan (Diluar Scope Audit Ini)

P0 yang belum diselesaikan dari roadmap awal Anda:
- Setup Resend API key + test email verification end-to-end
- Bank Account endpoint backend (sekarang fallback localStorage di FE
  sudah dilengkapi anti double-submit)
- Jalankan `prisma/migrations/sprint_full_schema.sql` untuk wallets,
  withdrawals, portfolios, skills
- KTM verification admin flow — perlu test E2E

P1:
- Google OAuth, Midtrans gateway, wallet + withdrawal, portfolio gallery,
  skill tags autocomplete

Setelah Anda apply ZIP ini, test bug duplikasi dulu — kalau sudah hilang, kita
lanjut salah satu P0.

---

# Patch — 28 Mei 2026 (Fix Payment Xendit + Render Collision)

Scope: Frontend. Hot-swap aman, tanpa perubahan API/struktur.

## 1. [CRITICAL] `features/payments/payments.js` — `submitEscrowAndContract`

Bug: baris penyetelan `window._pendingPaymentCheck` mereferensikan variabel
`res` yang TIDAK PERNAH dideklarasi (nama variabel sebenarnya `invoiceRes`).
Optional chaining `res?.data` tetap melempar `ReferenceError: res is not defined`
karena identifier-nya sendiri tak terdeklarasi.

Akibatnya, SETELAH approve application + create contract + create invoice
Xendit semuanya BERHASIL, baris ini crash sehingga:
- `window.open(invoiceUrl)` tidak pernah jalan → halaman pembayaran Xendit
  tidak terbuka ("payment tidak work").
- `onEnterBusiness()` tidak pernah jalan → tidak ada auto-refresh.
- Toast error muncul padahal kontrak & invoice sudah jadi.
- Saat user mengulang, backend menolak ("Kontrak sudah ada / Lamaran sudah
  disetujui") — inilah notif "project sudah di-accept" yang dilaporkan user.

Fix:
- `res?.data?.payment_id` → pakai `paymentId` (sudah di-resolve dari
  `invoiceRes` di atas) dengan fallback `invoiceRes?.data?.id`.
- Pindahkan `onEnterBusiness()` SEBELUM membuka tab Xendit (dibungkus
  try/catch agar non-fatal).
- Ganti `setTimeout(window.open)` dengan `window.open` langsung + fallback
  `window.location.assign(invoiceUrl)` bila popup diblokir browser (open di
  luar user-gesture langsung sering diblokir).

## 2. `features/wallet/wallet.js` & `features/admin/withdrawals.js` — collision `_renderStats`

Bug: kedua file mendeklarasi `function _renderStats()` di scope global. Karena
keduanya di-load via <script>, definisi yang dimuat belakangan (withdrawals.js)
menimpa yang lebih dulu (wallet.js). Akibatnya panggilan `_renderStats()` di
halaman dompet menjalankan versi admin (target `#admin-wd-stats`) → guard
`if(!el)return` → 3 kartu statistik dompet (Tertahan/Total Diterima/Dicairkan)
tidak pernah ter-render.

Fix: namespacing — `_renderWalletStats()` (dompet) & `_renderWithdrawalStats()`
(admin). Keduanya helper privat (prefiks `_`, tidak di-export), aman di-rename.

## 3. `features/contracts/contracts.js` — `approveDeliverableFromContract`

Hardening: `event?.target` (bare global `event`, deprecated) → `window.event?.target`
agar eksplisit. Perilaku identik di browser dari inline onclick.

## Verifikasi
- Scope-analysis (acorn, rule no-undef) seluruh 38 file FE: BERSIH.
- `node --check` seluruh file JS: lulus.
