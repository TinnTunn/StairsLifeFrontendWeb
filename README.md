# StairsLife — Frontend

Web app **Stairs Life** — platform freelance mahasiswa Indonesia.

Single-page application yang dibangun dengan **vanilla JavaScript** (tanpa framework), di-bundle dengan **Vite** menggunakan custom plugin untuk menggabungkan banyak file JS legacy menjadi satu bundle production.

---

## 📋 Daftar Isi

- [Tech Stack](#tech-stack)
- [Struktur Folder](#struktur-folder)
- [Quick Start](#quick-start)
- [Arsitektur](#arsitektur)
- [Konvensi Penulisan](#konvensi-penulisan)
- [Routing](#routing)
- [State Management](#state-management)
- [API Integration](#api-integration)
- [WebSocket](#websocket)
- [Styling](#styling)
- [Build & Deploy](#build--deploy)

---

## Tech Stack

| Layer | Tool | Catatan |
|---|---|---|
| Bundler | Vite 7 | Dengan custom plugin `legacyScriptsBundle` |
| Bahasa | Vanilla JavaScript | ES2018+ (target esbuild) |
| Routing | Custom (hash-less, screen-based) | `scripts/core/router.js` |
| State | Global `window.*` + module objects | Tanpa Redux/Vuex |
| Realtime | Socket.IO client | Via CDN |
| Styling | Plain CSS dengan CSS variables | Tema light/dark |
| Deploy | Vercel | Konfigurasi di `vercel.json` |

---

## Struktur Folder

```
.
├── index.html                       # Entry HTML (1800+ baris, berisi semua "screen")
├── package.json
├── vite.config.js                   # Custom bundler config
├── vercel.json                      # SPA rewrite untuk Vercel
│
├── scripts/                         # Semua JavaScript
│   ├── app.js                       # Entry point: global state, bootstrap, route hooks
│   ├── api.js                       # API service objects (AuthAPI, ProjectsAPI, dll)
│   ├── lint.js                      # Custom syntax checker (run via `npm run lint`)
│   │
│   ├── core/                        # Core infrastructure
│   │   ├── api-core.js              # Fetch wrapper, token mgmt, refresh engine
│   │   ├── auth.js                  # Login, register (multi-step), KTM upload, logout
│   │   ├── router.js                # Screen navigation (goTo, screenHistory)
│   │   └── theme.js                 # Dark/light theme toggle
│   │
│   ├── utils/                       # Pure helper functions (no DOM, no API)
│   │   ├── helpers.js               # fmtCurrency, fmtDate, tierBadge, statusBadge, dll
│   │   ├── skeleton.js              # Loading skeletons
│   │   ├── socket.js                # SocketManager (Socket.IO wrapper)
│   │   ├── storage.js               # localStorage helpers
│   │   └── toast.js                 # showToast() notifications
│   │
│   └── features/                    # Feature modules — per domain
│       ├── student/                 # student.js, projects.js, applications.js
│       ├── business/                # business.js, projects.js (bisnis side)
│       ├── admin/                   # admin.js + 6 sub-modules
│       ├── chat/                    # WebSocket chat + support + mediation
│       ├── contracts/               # Contract detail, deliverable flow
│       ├── payments/                # Escrow flow
│       ├── disputes/                # Sengketa
│       ├── reviews/                 # Submit review per kontrak
│       ├── notifications/           # Daftar notifikasi
│       ├── settings/                # Account settings
│       └── verification/            # KTM upload, status verifikasi
│
├── styles/
│   └── main.css                     # Global stylesheet (1600+ baris)
│
└── assets/                          # (kosong, untuk future static assets)
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm 10+

### 1. Install

```bash
npm install
```

### 2. Konfigurasi Backend URL

Edit `scripts/core/api-core.js` atau tambahkan `.env`:

```bash
# .env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

> 📝 Default sudah pointing ke `http://localhost:3000/api/v1`.

### 3. Run dev server

```bash
npm run dev
```

Dev server jalan di `http://localhost:5173`. Hot reload otomatis untuk file CSS dan HTML.

> ⚠️ **Catatan**: File `.js` saat ini di-load dengan `<script src=>` (non-module), jadi hot reload tidak bekerja untuk file JS — perlu refresh manual. Ini konsekuensi arsitektur legacy yang akan di-modernize ke ES modules di future iteration.

### 4. Build production

```bash
npm run build
```

Output di `dist/`. File JS digabung jadi satu bundle dengan hash cache busting.

### 5. Lint

```bash
npm run lint
```

Custom linter (`scripts/lint.js`) cek:
- Syntax error (via `node --check`)
- Duplicate function names
- Pemakaian native `prompt()` (yang harus diganti dengan custom modal)

---

## Arsitektur

### Single-Page Application

Tidak ada framework atau routing library. Setiap "halaman" adalah `<div id="screen-*">` di `index.html`. Hanya satu screen aktif pada satu waktu (CSS `.screen.active`).

```html
<div id="screen-landing" class="screen active">...</div>
<div id="screen-login" class="screen">...</div>
<div id="screen-student" class="screen">...</div>
<!-- 30+ screens total -->
```

Switch screen dengan `goTo('screen-id')` dari `core/router.js`.

### Custom Bundler

`vite.config.js` punya plugin `legacyScriptsBundle` yang:

1. **Saat build**: baca `<script src="...">` di `index.html`, concat semua dalam urutan yang sama, minify dengan esbuild, output `dist/assets/bundle.<hash>.js`, lalu replace semua tag script dengan satu tag pointing ke bundle.
2. **Saat dev**: tidak transform apa-apa — file di-serve as-is.

**Kenapa**: source codenya ditulis dengan pola `window.*` globals (bukan `import/export`). ES modules akan butuh refactor besar — jadi sementara di-handle di bundler.

### Loading Order

Urutan script tag di `index.html` itu **PENTING**:

```html
<!-- 1. Vendor (CDN) -->
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>

<!-- 2. Utils (no deps) -->
<script src="/scripts/utils/storage.js"></script>
<script src="/scripts/utils/toast.js"></script>
<script src="/scripts/utils/helpers.js"></script>
<script src="/scripts/utils/skeleton.js"></script>
<script src="/scripts/utils/socket.js"></script>

<!-- 3. Core (depends on utils) -->
<script src="/scripts/core/api-core.js"></script>
<script src="/scripts/api.js"></script>
<script src="/scripts/core/auth.js"></script>
<script src="/scripts/core/router.js"></script>
<script src="/scripts/core/theme.js"></script>

<!-- 4. Features (depends on core + utils) -->
<script src="/scripts/features/student/student.js"></script>
<!-- ... -->

<!-- 5. App entry (depends on everything) -->
<script src="/scripts/app.js"></script>
```

Kalau urutan salah, fungsi yang dipanggil belum ter-define → error.

---

## Konvensi Penulisan

### File baru harus:

1. **Mulai dengan `'use strict';`** (semua file kecuali HTML/CSS).
2. **Komentar JSDoc** di top describing what the file does.
3. **Expose fungsi ke `window.*`** di akhir file (supaya bisa dipanggil dari `onclick=` di HTML dan dari file lain):

```javascript
'use strict';

/**
 * StairsLife — feature/foo.js
 * Deskripsi fitur foo.
 */

function fooBar() { ... }
function fooBaz() { ... }

// Export ke window
window.fooBar = fooBar;
window.fooBaz = fooBaz;
```

### Naming

| Konvensi | Untuk |
|---|---|
| `camelCase` | Functions, variables |
| `UPPER_SNAKE` | Constants, global state arrays |
| `kebab-case` | File names, IDs HTML |
| `BEM-ish` | CSS classes (`block__element--modifier`) |

### Async / Error handling

Pakai `try/catch` di setiap call API yang affect UI:

```javascript
async function loadProjects() {
  try {
    const res = await ProjectsAPI.list();
    renderProjects(res.data);
  } catch (e) {
    showToast(e.message || 'Gagal memuat data', 'error');
    console.error('loadProjects:', e);
  }
}
```

Jangan pernah `catch (_) {}` (swallow error diam-diam) kecuali memang non-critical.

---

## Routing

`core/router.js` expose:

- `goTo(screenId)` — switch ke screen, push ke history
- `goBack()` — pop history, kembali ke screen sebelumnya
- `screenHistory` — array (mostly internal)

`goTo` juga trigger **route hook** kalau ada — misal `onEnterStudent()` di `student/student.js` akan dipanggil saat masuk ke `screen-student`.

### Tambah screen baru

1. Tambah `<div id="screen-foo" class="screen">...</div>` di `index.html`.
2. Buat file `scripts/features/foo/foo.js`.
3. Implement `onEnterFoo()` (optional) untuk load data saat screen aktif.
4. Tambah `<script src=>` di `index.html` dengan urutan yang benar.
5. Call `goTo('screen-foo')` dari tempat yang mau navigate ke sana.

---

## State Management

### Global state ada 2 layer:

**1. Auth state** — di `localStorage` via `TokenManager`:
```javascript
TokenManager.get()        // access token
TokenManager.getRefresh() // refresh token (currently unused — backend belum punya endpoint)
TokenManager.getUser()    // user object dari login response
TokenManager.clear()      // logout
```

**2. Data state** — di `window.*` globals (lihat `app.js`):
```javascript
const PROJECTS = [];      // dipakai oleh student/business pages
const APPLICATIONS = [];
const CHATS = [];
const CHAT_MESSAGES = {};
// dll
```

> 📝 State arrays ini sisa dari era pre-API. Banyak feature sudah migrate ke fetch langsung. State ini akan terus berkurang seiring waktu.

### Akses user info dengan benar

**JANGAN** baca role dari tab login yang user klik. **PAKAI** function dari `api.js`:

```javascript
const role = getCurrentRole();         // 'student' | 'biz' | 'admin'
const profile = getCurrentUserProfile(); // { id, name, email, role, ... }
```

---

## API Integration

Semua API call lewat service objects di `scripts/api.js`:

```javascript
AuthAPI         // login, register, logout, getCurrentUser
UsersAPI        // getMe, updateProfile, getBankAccounts (stub)
ProjectsAPI     // list, getById, create, update, delete
ApplicationsAPI // apply, getMyApplications, updateStatus
ContractsAPI    // getMyContracts, uploadDeliverable, approve, reject
PaymentsAPI     // hold, release, getMy
ReviewsAPI      // submit, getForContract, getForUser
DisputesAPI     // create, getMy, getById (stub)
MessagesAPI     // chat: getOrCreateRoom, sendMessage, inquiry (stub)
ChatAPI         // openDirectChat (UI state)
NotificationsAPI// list, markRead (no-op), markAllRead (no-op)
UploadAPI       // uploadFile
AdminAPI        // stats, users, suspend, finance, settings
```

Semua method return `Promise` yang resolve ke `{ data, message }` atau reject dengan `Error`.

### Method dengan stub (belum ada di backend)

| Method | Stub behavior |
|---|---|
| `AuthAPI.forgotPassword`, `AuthAPI.resetPassword` | Reject dengan "fitur belum tersedia" |
| `UsersAPI.getBankAccounts/saveBankAccount/deleteBankAccount` | Empty array / reject |
| `MessagesAPI.sendInquiry/getInquiries/replyInquiry` | Empty / reject |
| `MessagesAPI.getMediationRoom/sendMediation` | Empty / reject |
| `NotificationsAPI.markRead/markAllRead` | No-op (backend belum simpan state read) |

Semua stub diberi komentar di `api.js` yang menjelaskan apa yang perlu di-implement di backend.

### Refresh Token

`core/api-core.js` punya **proactive refresh engine** — sebelum token expired, otomatis hit `/auth/refresh`. **Sekarang ini no-op** karena backend belum punya endpoint refresh. Saat backend implement, mekanisme di frontend sudah siap.

---

## WebSocket

`utils/socket.js` expose `SocketManager`:

```javascript
SocketManager.connect()                  // Connect setelah login (otomatis dipanggil)
SocketManager.disconnect()
SocketManager.joinRoom(contractId)       // Join chat room kontrak
SocketManager.leaveRoom(contractId)
SocketManager.sendMessage(contractId, content)
SocketManager.onMessage(callback)        // Subscribe ke pesan masuk
```

Dipakai di `features/chat/chat.js`. Lihat juga `joinChatRoom`/`leaveChatRoom` aliases di sana.

---

## Styling

**File**: `styles/main.css` (single file, 1600+ baris).

### CSS Variables

Tema didefinisikan di `:root` dan `[data-theme="dark"]`:

```css
:root {
  --bg-primary:    #ffffff;
  --text-primary:  #0f172a;
  --accent:        #6366f1;
  /* ... */
}

[data-theme="dark"] {
  --bg-primary:    #0f172a;
  --text-primary:  #f1f5f9;
  /* ... */
}
```

Toggle dengan `toggleTheme()` di `core/theme.js`.

### Class konvensi

- `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-full` — buttons
- `.card`, `.card-p-lg` — cards
- `.badge`, `.badge-teal`, `.badge-rose`, dll — labels
- `.screen`, `.screen.active` — page containers
- `.modal-backdrop`, `.modal-sheet` — modals

---

## Build & Deploy

### Build

```bash
npm run build
```

Output struktur:
```
dist/
├── index.html              # Script tags sudah di-replace
└── assets/
    ├── bundle.<hash>.js    # Concat + minified semua JS
    ├── main.<hash>.css     # CSS
    └── ...
```

### Deploy ke Vercel

```bash
vercel --prod
```

`vercel.json` sudah set:
- SPA rewrite: semua URL → `/index.html`
- Cache header `no-cache` untuk `/scripts/*.js` (mencegah stale bundle)

### Environment variables di production

Set di Vercel dashboard:
- `VITE_API_BASE_URL=https://api.stairslife.id/api/v1`

### Cek pre-deploy

```bash
npm run lint          # Custom linter
npm run build         # Pastikan build sukses
npm run preview       # Test build output lokal di port 4173
```

---

## Roadmap & Known Limitations

### Limitasi saat ini

- **Tidak ada module system** — semua via `window.*` globals. Refactor ke ES modules akan butuh effort signifikan.
- **`index.html` monolitik** (1800+ baris) — semua screen dalam satu file. Bisa di-split dengan template literal atau migrate ke framework di future.
- **Hot reload terbatas** — hanya CSS yang full HMR. JS perlu manual refresh.
- **Beberapa fitur masih stub** (forgot password, bank account, inquiry chat, dispute mediation) — lihat komentar di `api.js`.

### Roadmap potensial

- [ ] Migrate ke ES modules (`import/export`) → bisa pakai Vite HMR proper
- [ ] Split `index.html` per screen
- [ ] Implementasi PWA (service worker, manifest)
- [ ] Skeleton loader yang lebih konsisten
- [ ] i18n (saat ini hardcoded Indonesia)
- [ ] Unit tests (Vitest) untuk service objects dan helpers

---

## License

Internal use — Stairs Life team.
