/**
 * StairsLife — features/wallet/wallet.js
 *
 * UI saldo mahasiswa dengan tab navigation, filter transaksi, dan
 * custom confirm modal (tidak pakai native confirm() yang ugly).
 *
 * Konsumsi API:
 *   - WithdrawalsAPI.getWallet()
 *   - WithdrawalsAPI.create({ bank_account_id, amount })
 *   - WithdrawalsAPI.getMy()
 *   - BankAccountsAPI.list() / create() / setPrimary() / delete()
 *
 * Helper global yang dipakai: showToast, esc, escAttr, fmtRelative.
 */
'use strict';

const WALLET_FEE = 2500;
const WALLET_MIN = 50_000;

let _walletState = {
  activeTab: 'overview',         // 'overview' | 'transactions' | 'withdrawals' | 'banks'
  txFilter:  'all',              // 'all' | 'earn' | 'withdraw'
  wdFilter:  'all',              // 'all' | 'pending' | 'completed' | 'rejected'
  cache:     { wallet: null, banks: null, withdrawals: null },
};

/* ================================================================
   MAIN PAGE: WALLET — render shell + summary card + tab navigation
   ================================================================ */
async function renderWalletPage() {
  const root = document.getElementById('screen-wallet');
  if (!root) return;

  root.innerHTML = `
    <div class="auth-screen">
      <div class="auth-topbar">
        <button class="auth-back-btn" onclick="goBack()" aria-label="Back">
          <svg viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span style="font-size:16px;font-weight:700;flex:1">💰 Dompet Saya</span>
        <button class="auth-back-btn" onclick="refreshWalletPage()" aria-label="Refresh" title="Refresh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        </button>
      </div>

      <div class="auth-body" style="align-items:flex-start;padding:16px 16px 80px;display:block;max-width:900px;width:100%;margin:0 auto">
        <!-- Hero Card: Saldo + Tarik -->
        <div id="wallet-hero"></div>

        <!-- Stats Grid: pending, total earned, withdrawn -->
        <div id="wallet-stats"></div>

        <!-- Tab Navigation -->
        <div style="padding:14px 0 0;position:sticky;top:0;background:var(--bg-primary);z-index:5">
          <div class="filter-chips" id="wallet-tabs">
            <button class="filter-chip ${_walletState.activeTab === 'overview' ? 'active' : ''}" onclick="walletSwitchTab('overview')">📊 Ringkasan</button>
            <button class="filter-chip ${_walletState.activeTab === 'transactions' ? 'active' : ''}" onclick="walletSwitchTab('transactions')">📋 Transaksi</button>
            <button class="filter-chip ${_walletState.activeTab === 'withdrawals' ? 'active' : ''}" onclick="walletSwitchTab('withdrawals')">💸 Penarikan</button>
            <button class="filter-chip ${_walletState.activeTab === 'banks' ? 'active' : ''}" onclick="walletSwitchTab('banks')">🏦 Rekening</button>
          </div>
        </div>

        <!-- Tab Content Area -->
        <div id="wallet-content" style="padding:14px 0"></div>
      </div>
    </div>
  `;

  // Load wallet data dulu (hero + stats), lalu render tab aktif
  await _loadWalletData();
  _renderActiveTab();
}

async function refreshWalletPage() {
  showToast('🔄 Memuat ulang...', 'info');
  _walletState.cache = { wallet: null, banks: null, withdrawals: null };
  await _loadWalletData();
  _renderActiveTab();
}

async function walletSwitchTab(tab) {
  _walletState.activeTab = tab;
  document.querySelectorAll('#wallet-tabs .filter-chip').forEach(c => c.classList.remove('active'));
  document.querySelector(`#wallet-tabs .filter-chip:nth-child(${['overview','transactions','withdrawals','banks'].indexOf(tab)+1})`)?.classList.add('active');
  _renderActiveTab();
}

/* ================================================================
   LOAD DATA — fetch sekali, cache di state
   ================================================================ */
async function _loadWalletData() {
  const heroEl = document.getElementById('wallet-hero');
  const statsEl = document.getElementById('wallet-stats');
  if (heroEl) heroEl.innerHTML = _heroSkeleton();
  if (statsEl) statsEl.innerHTML = '';

  try {
    const [wRes, bRes, wdRes] = await Promise.all([
      WithdrawalsAPI.getWallet(),
      BankAccountsAPI.list(),
      WithdrawalsAPI.getMy(),
    ]);
    _walletState.cache.wallet      = wRes.data || {};
    _walletState.cache.banks       = bRes.data || [];
    _walletState.cache.withdrawals = wdRes.data || [];
    _renderHero();
    _renderWalletStats();
  } catch (e) {
    if (heroEl) heroEl.innerHTML = `
      <div class="empty-state" style="padding:24px">
        <div class="empty-state-icon">⚠️</div>
        <p style="color:var(--rose)">${esc(e?.message || 'Gagal memuat saldo')}</p>
        <button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="refreshWalletPage()">Coba Lagi</button>
      </div>
    `;
  }
}

function _heroSkeleton() {
  return `<div style="background:linear-gradient(135deg,var(--accent),var(--accent-dark,var(--accent)));border-radius:16px;padding:24px;color:white;text-align:center">
    <div style="opacity:.6">⏳ Memuat saldo...</div>
  </div>`;
}

function _renderHero() {
  const el = document.getElementById('wallet-hero');
  if (!el) return;
  const w        = _walletState.cache.wallet || {};
  const balance  = Number(w.amount || 0);
  const canWd    = balance >= WALLET_MIN;

  el.innerHTML = `
    <div style="background:linear-gradient(135deg,var(--accent) 0%,#5b3fd6 100%);color:white;padding:22px;border-radius:18px;position:relative;overflow:hidden;box-shadow:0 8px 24px rgba(122,107,255,.25)">
      <!-- Decorative blob -->
      <div style="position:absolute;right:-30px;top:-30px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,0.08);pointer-events:none"></div>
      <div style="position:absolute;right:30px;bottom:-50px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.05);pointer-events:none"></div>

      <div style="position:relative;z-index:1">
        <div style="font-size:11px;opacity:.8;text-transform:uppercase;letter-spacing:.6px;font-weight:600;margin-bottom:4px">💰 Saldo Tersedia</div>
        <div style="font-size:30px;font-weight:800;margin-bottom:16px;line-height:1.1">Rp ${balance.toLocaleString('id-ID')}</div>

        <button
          class="btn"
          style="background:white;color:var(--accent);font-weight:700;width:100%;height:44px;border-radius:10px;${canWd ? '' : 'opacity:0.55;cursor:not-allowed'}"
          onclick="${canWd ? 'showWithdrawModal()' : 'showToast(\'Saldo minimal Rp '+ WALLET_MIN.toLocaleString('id-ID') +'\', \'info\')'}"
          ${canWd ? '' : 'disabled'}>
          ${canWd
            ? '💸 Tarik Saldo Sekarang'
            : `Minimal Rp ${WALLET_MIN.toLocaleString('id-ID')} untuk tarik`}
        </button>
      </div>
    </div>
  `;
}

function _renderWalletStats() {
  const el = document.getElementById('wallet-stats');
  if (!el) return;
  const w         = _walletState.cache.wallet || {};
  const pending   = Number(w.pending_amount || 0);
  const earned    = Number(w.total_earned || 0);
  const withdrawn = Number(w.total_withdrawn || 0);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-top:12px">
      <div class="card" style="padding:12px;text-align:center;border-left:3px solid var(--amber-dark)">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Tertahan</div>
        <div style="font-weight:700;color:var(--amber-dark);font-size:13px">Rp ${pending.toLocaleString('id-ID')}</div>
      </div>
      <div class="card" style="padding:12px;text-align:center;border-left:3px solid var(--teal-dark)">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Total Diterima</div>
        <div style="font-weight:700;color:var(--teal-dark);font-size:13px">Rp ${earned.toLocaleString('id-ID')}</div>
      </div>
      <div class="card" style="padding:12px;text-align:center;border-left:3px solid var(--accent)">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Dicairkan</div>
        <div style="font-weight:700;color:var(--accent);font-size:13px">Rp ${withdrawn.toLocaleString('id-ID')}</div>
      </div>
    </div>
  `;
}

/* ================================================================
   TAB CONTENT RENDERERS
   ================================================================ */
function _renderActiveTab() {
  const el = document.getElementById('wallet-content');
  if (!el) return;

  switch (_walletState.activeTab) {
    case 'overview':     return _renderOverviewTab(el);
    case 'transactions': return _renderTransactionsTab(el);
    case 'withdrawals':  return _renderWithdrawalsTab(el);
    case 'banks':        return _renderBanksTab(el);
  }
}

function _renderOverviewTab(el) {
  const w     = _walletState.cache.wallet || {};
  const banks = _walletState.cache.banks || [];
  const wds   = _walletState.cache.withdrawals || [];
  const txs   = w.recent_transactions || [];

  // Quick info: berapa bank, berapa pending withdrawal
  const pendingWd = wds.filter(x => ['pending','processing'].includes(x.status)).length;
  const primary   = banks.find(b => b.is_primary);

  el.innerHTML = `
    <!-- Quick Info Cards -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
      <div class="card card-p-md" onclick="walletSwitchTab('banks')" style="cursor:pointer">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">🏦 Rekening</div>
        <div style="font-size:18px;font-weight:700">${banks.length}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${primary ? esc(primary.bank_name) + ' (utama)' : 'Belum ada utama'}</div>
      </div>
      <div class="card card-p-md" onclick="walletSwitchTab('withdrawals')" style="cursor:pointer">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">⏳ Pending</div>
        <div style="font-size:18px;font-weight:700">${pendingWd}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Penarikan diproses</div>
      </div>
    </div>

    <!-- Recent Transactions -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h3 style="font-size:14px;font-weight:700">Transaksi Terbaru</h3>
      ${txs.length ? `<button class="btn btn-ghost btn-sm" onclick="walletSwitchTab('transactions')">Lihat Semua →</button>` : ''}
    </div>
    <div id="overview-tx-list">${_renderTxItems(txs.slice(0, 5))}</div>
  `;
}

function _renderTransactionsTab(el) {
  const w   = _walletState.cache.wallet || {};
  const all = w.recent_transactions || [];

  // Filter
  let filtered = all;
  if (_walletState.txFilter === 'earn') {
    filtered = all.filter(t => ['earn_release','earn_split','withdrawal_refund'].includes(t.type));
  } else if (_walletState.txFilter === 'withdraw') {
    filtered = all.filter(t => ['withdrawal_lock','withdrawal_done'].includes(t.type));
  }

  el.innerHTML = `
    <div class="filter-chips" style="margin-bottom:14px">
      <button class="filter-chip ${_walletState.txFilter === 'all' ? 'active' : ''}" onclick="walletTxFilter('all')">Semua (${all.length})</button>
      <button class="filter-chip ${_walletState.txFilter === 'earn' ? 'active' : ''}" onclick="walletTxFilter('earn')">📈 Pemasukan</button>
      <button class="filter-chip ${_walletState.txFilter === 'withdraw' ? 'active' : ''}" onclick="walletTxFilter('withdraw')">📉 Penarikan</button>
    </div>
    <div>${_renderTxItems(filtered)}</div>
  `;
}

function walletTxFilter(f) {
  _walletState.txFilter = f;
  _renderActiveTab();
}

function _renderTxItems(items) {
  if (!items?.length) {
    return `<div class="empty-state" style="padding:24px"><div class="empty-state-icon">📋</div><p style="color:var(--text-muted);font-size:13px">Belum ada transaksi.</p></div>`;
  }

  const typeMap = {
    earn_release:      { icon: '💵', label: 'Pencairan project',     color: 'var(--teal-dark)', sign: '+' },
    earn_split:        { icon: '⚖️', label: 'Resolusi sengketa',     color: 'var(--teal-dark)', sign: '+' },
    withdrawal_lock:   { icon: '🔒', label: 'Penarikan diminta',     color: 'var(--amber-dark)', sign: '−' },
    withdrawal_done:   { icon: '✅', label: 'Penarikan selesai',     color: 'var(--text-muted)', sign: '' },
    withdrawal_refund: { icon: '↩️', label: 'Penarikan dibatalkan',  color: 'var(--teal-dark)', sign: '+' },
  };

  return items.map(t => {
    const tinfo = typeMap[t.type] || { icon: '•', label: t.type, color: 'var(--text-primary)', sign: '' };
    const dateStr = typeof fmtRelative === 'function' ? fmtRelative(t.created_at) : new Date(t.created_at).toLocaleDateString('id-ID');
    return `
      <div class="card card-p-md" style="margin-bottom:8px;display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;border-radius:10px;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${tinfo.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${esc(tinfo.label)}</div>
          <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.description || '-')}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${esc(dateStr)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:14px;font-weight:800;color:${tinfo.color}">${tinfo.sign}Rp ${Number(t.amount).toLocaleString('id-ID')}</div>
        </div>
      </div>
    `;
  }).join('');
}

function _renderWithdrawalsTab(el) {
  const all = _walletState.cache.withdrawals || [];

  let filtered = all;
  if (_walletState.wdFilter !== 'all') filtered = all.filter(w => w.status === _walletState.wdFilter);

  const counts = {
    all:       all.length,
    pending:   all.filter(w => w.status === 'pending').length,
    completed: all.filter(w => w.status === 'completed').length,
    rejected:  all.filter(w => w.status === 'rejected').length,
  };

  el.innerHTML = `
    <div class="filter-chips" style="margin-bottom:14px">
      <button class="filter-chip ${_walletState.wdFilter === 'all' ? 'active' : ''}" onclick="walletWdFilter('all')">Semua (${counts.all})</button>
      <button class="filter-chip ${_walletState.wdFilter === 'pending' ? 'active' : ''}" onclick="walletWdFilter('pending')">⏳ Pending (${counts.pending})</button>
      <button class="filter-chip ${_walletState.wdFilter === 'completed' ? 'active' : ''}" onclick="walletWdFilter('completed')">✅ Selesai (${counts.completed})</button>
      <button class="filter-chip ${_walletState.wdFilter === 'rejected' ? 'active' : ''}" onclick="walletWdFilter('rejected')">❌ Ditolak (${counts.rejected})</button>
    </div>
    <div>${_renderWithdrawalItems(filtered)}</div>
  `;
}

function walletWdFilter(f) {
  _walletState.wdFilter = f;
  _renderActiveTab();
}

function _renderWithdrawalItems(items) {
  if (!items?.length) {
    return `<div class="empty-state" style="padding:24px"><div class="empty-state-icon">💸</div><p style="color:var(--text-muted);font-size:13px">Belum ada penarikan.</p></div>`;
  }

  const statusMap = {
    pending:    { color: 'var(--amber-dark)', bg: 'var(--amber-light)', label: '⏳ Menunggu' },
    processing: { color: 'var(--accent)',     bg: 'var(--accent-light)', label: '🚚 Diproses' },
    completed:  { color: 'var(--teal-dark)',  bg: 'var(--teal-light)', label: '✅ Cair' },
    rejected:   { color: 'var(--rose)',       bg: 'var(--rose-light)', label: '❌ Ditolak' },
    failed:     { color: 'var(--rose)',       bg: 'var(--rose-light)', label: '⚠️ Gagal' },
  };

  return items.map(w => {
    const s = statusMap[w.status] || { color: 'var(--text-muted)', bg: 'var(--bg-secondary)', label: w.status };
    const reqAt = typeof fmtRelative === 'function' ? fmtRelative(w.requested_at) : new Date(w.requested_at).toLocaleString('id-ID');
    return `
      <div class="card card-p-md" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;margin-bottom:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:800;color:var(--teal-dark)">Rp ${Number(w.amount_net).toLocaleString('id-ID')}</div>
            <div style="font-size:11px;color:var(--text-muted)">Bruto Rp ${Number(w.amount_gross).toLocaleString('id-ID')} − Admin Rp ${Number(w.admin_fee).toLocaleString('id-ID')}</div>
          </div>
          <span style="background:${s.bg};color:${s.color};font-size:10px;padding:3px 8px;border-radius:6px;font-weight:700;white-space:nowrap">${s.label}</span>
        </div>
        <div style="background:var(--bg-secondary);border-radius:8px;padding:8px 10px;margin-bottom:8px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Rekening Tujuan</div>
          <div style="font-size:13px;font-weight:600">${esc(w.bank_account?.bank_name || '-')}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${esc(w.bank_account?.account_number || '-')} · ${esc(w.bank_account?.account_holder || '-')}</div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center">
          <span>📅 ${esc(reqAt)}</span>
          ${w.xendit_disbursement_id ? `<span style="font-family:monospace;font-size:10px">⚡ ${esc(w.xendit_disbursement_id.slice(0, 12))}...</span>` : ''}
        </div>
        ${w.rejection_reason ? `
          <div style="margin-top:8px;padding:8px 10px;background:var(--rose-light);border-radius:6px;font-size:12px;color:var(--rose)">
            <b>Alasan ditolak:</b> ${esc(w.rejection_reason)}
          </div>` : ''}
      </div>
    `;
  }).join('');
}

function _renderBanksTab(el) {
  const accounts = _walletState.cache.banks || [];

  if (!accounts.length) {
    el.innerHTML = `
      <div class="empty-state" style="padding:32px">
        <div class="empty-state-icon">🏦</div>
        <div class="empty-state-title">Belum ada rekening</div>
        <p class="empty-state-desc">Tambahkan rekening bank untuk menerima pencairan saldo.</p>
        <button class="btn btn-primary" style="margin-top:14px" onclick="showAddBankAccountModal()">+ Tambah Rekening</button>
      </div>
    `;
    return;
  }

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:13px;color:var(--text-muted)">${accounts.length} rekening terdaftar</div>
      <button class="btn btn-primary btn-sm" onclick="showAddBankAccountModal()">+ Tambah</button>
    </div>
    ${accounts.map(a => {
      const initials = a.bank_code.slice(0, 3);
      return `
      <div class="card card-p-md" style="margin-bottom:10px;display:flex;align-items:center;gap:12px">
        <div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,var(--accent),#5b3fd6);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:800;color:white">${esc(initials)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
            <span style="font-size:15px;font-weight:700">${esc(a.bank_name)}</span>
            ${a.is_primary ? '<span style="background:var(--accent-light);color:var(--accent);font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700">⭐ UTAMA</span>' : ''}
          </div>
          <div style="font-size:13px;color:var(--text-secondary);font-family:monospace">${esc(a.account_number)}</div>
          <div style="font-size:11px;color:var(--text-muted)">${esc(a.account_holder)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${!a.is_primary ? `<button class="btn btn-ghost" style="font-size:11px;padding:5px 8px" onclick="walletSetPrimary('${escAttr(a.id)}')" title="Jadikan rekening utama">⭐</button>` : ''}
          <button class="btn btn-ghost" style="font-size:11px;padding:5px 8px;color:var(--rose)" onclick="walletDeleteBank('${escAttr(a.id)}', '${escAttr(a.bank_name)}', '${escAttr(a.account_number)}')" title="Hapus">🗑️</button>
        </div>
      </div>
      `;
    }).join('')}
  `;
}

async function walletSetPrimary(id) {
  try {
    await BankAccountsAPI.setPrimary(id);
    showToast('Rekening utama diperbarui ⭐', 'success');
    _walletState.cache.banks = null;
    const b = await BankAccountsAPI.list();
    _walletState.cache.banks = b.data || [];
    _renderActiveTab();
    _renderHero();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function walletDeleteBank(id, bankName, accNumber) {
  // Custom modal (bukan native confirm)
  showConfirmModal({
    title: '🗑️ Hapus Rekening',
    message: `Hapus rekening <b>${esc(bankName)}</b> (${esc(accNumber)})?<br><span style="font-size:12px;color:var(--text-muted)">Rekening yang sedang dipakai withdrawal aktif tidak bisa dihapus.</span>`,
    confirmText: 'Ya, Hapus',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await BankAccountsAPI.delete(id);
        showToast('✅ Rekening dihapus', 'success');
        _walletState.cache.banks = null;
        const b = await BankAccountsAPI.list();
        _walletState.cache.banks = b.data || [];
        _renderActiveTab();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },
  });
}

/* ================================================================
   CUSTOM CONFIRM MODAL (bukan native confirm)
   ================================================================ */
function showConfirmModal({ title, message, confirmText = 'OK', cancelText = 'Batal', confirmClass = 'btn-primary', onConfirm }) {
  const existing = document.getElementById('confirm-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'confirm-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '10001';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:380px" role="dialog">
      <h2 style="font-size:17px;font-weight:800;margin-bottom:8px;text-align:center">${title}</h2>
      <p style="font-size:14px;color:var(--text-secondary);text-align:center;margin-bottom:18px;line-height:1.5">${message}</p>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="closeConfirmModal()">${esc(cancelText)}</button>
        <button class="btn ${confirmClass}" style="flex:1" id="confirm-modal-yes">${esc(confirmText)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  document.getElementById('confirm-modal-yes').addEventListener('click', async () => {
    closeConfirmModal();
    if (typeof onConfirm === 'function') await onConfirm();
  });
}

function closeConfirmModal() {
  const m = document.getElementById('confirm-modal');
  if (m) m.remove();
  document.body.style.overflow = '';
}

/* ================================================================
   ADD BANK ACCOUNT MODAL
   ================================================================ */
const BANK_OPTIONS = [
  { code: 'BCA',     name: 'BCA' },
  { code: 'BNI',     name: 'BNI' },
  { code: 'BRI',     name: 'BRI' },
  { code: 'MANDIRI', name: 'Mandiri' },
  { code: 'CIMB',    name: 'CIMB Niaga' },
  { code: 'PERMATA', name: 'Permata' },
  { code: 'BSI',     name: 'BSI' },
  { code: 'BTN',     name: 'BTN' },
  { code: 'DANAMON', name: 'Danamon' },
  { code: 'OCBC',    name: 'OCBC NISP' },
  { code: 'MAYBANK', name: 'Maybank' },
  { code: 'PANIN',   name: 'Panin Bank' },
];

function showAddBankAccountModal() {
  const existing = document.getElementById('bank-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'bank-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:480px" role="dialog">
      <div class="modal-drag-bar"></div>
      <h2 style="font-size:18px;font-weight:800;margin-bottom:6px;text-align:center">🏦 Tambah Rekening</h2>
      <p style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:18px">Rekening akan dipakai untuk pencairan saldo</p>

      <div style="display:grid;gap:14px;margin-bottom:20px">
        <div class="form-group">
          <label class="form-label">Bank <span class="req">*</span></label>
          <select class="form-input" id="bank-code">
            <option value="">— Pilih bank —</option>
            ${BANK_OPTIONS.map(b => `<option value="${b.code}">${esc(b.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Nomor Rekening <span class="req">*</span></label>
          <input class="form-input" id="bank-acc-number" type="text" inputmode="numeric" placeholder="cth: 1234567890" maxlength="30">
        </div>
        <div class="form-group">
          <label class="form-label">Nama Pemilik <span class="req">*</span></label>
          <input class="form-input" id="bank-acc-holder" type="text" placeholder="cth: BUDI SETIAWAN" style="text-transform:uppercase" maxlength="100">
          <div class="form-hint">⚠️ Wajib sama dengan buku tabungan (HURUF KAPITAL). Salah ketik = transfer gagal.</div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);cursor:pointer;padding:8px;background:var(--bg-secondary);border-radius:8px">
          <input type="checkbox" id="bank-is-primary" style="width:16px;height:16px"> Jadikan rekening utama
        </label>
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="closeBankModal()">Batal</button>
        <button class="btn btn-primary" style="flex:1" id="bank-submit-btn" onclick="submitNewBankAccount()">Simpan Rekening</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

function closeBankModal() {
  const m = document.getElementById('bank-modal');
  if (m) m.remove();
  document.body.style.overflow = '';
}

async function submitNewBankAccount() {
  const codeSelect = document.getElementById('bank-code');
  const bankCode   = codeSelect?.value;
  const bankName   = bankCode ? (BANK_OPTIONS.find(b => b.code === bankCode)?.name || bankCode) : '';
  const accNumber  = document.getElementById('bank-acc-number')?.value?.trim();
  const accHolder  = document.getElementById('bank-acc-holder')?.value?.trim()?.toUpperCase();
  const isPrimary  = document.getElementById('bank-is-primary')?.checked;

  if (!bankCode)                                 { showToast('Pilih bank dulu', 'error'); return; }
  if (!/^[0-9-]{6,30}$/.test(accNumber || ''))   { showToast('Nomor rekening minimal 6 angka', 'error'); return; }
  if (!accHolder || accHolder.length < 2)        { showToast('Nama pemilik minimal 2 karakter', 'error'); return; }
  if (!/^[A-Z\s.\-,']+$/.test(accHolder))        { showToast('Nama hanya boleh huruf kapital', 'error'); return; }

  const btn = document.getElementById('bank-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyimpan...'; }

  try {
    await BankAccountsAPI.create({
      bank_name:      bankName,
      bank_code:      bankCode,
      account_number: accNumber,
      account_holder: accHolder,
      is_primary:     !!isPrimary,
    });
    showToast('✅ Rekening berhasil ditambahkan', 'success');
    closeBankModal();
    // Refresh banks cache
    const b = await BankAccountsAPI.list();
    _walletState.cache.banks = b.data || [];
    _renderActiveTab();
  } catch (e) {
    showToast(e.message || 'Gagal menambah rekening', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan Rekening'; }
  }
}

/* ================================================================
   WITHDRAWAL MODAL
   ================================================================ */
async function showWithdrawModal() {
  // Pastikan data fresh
  let accounts = _walletState.cache.banks || [];
  let walletBalance = Number(_walletState.cache.wallet?.amount || 0);

  if (!accounts.length || !_walletState.cache.wallet) {
    try {
      const [bRes, wRes] = await Promise.all([BankAccountsAPI.list(), WithdrawalsAPI.getWallet()]);
      accounts = bRes.data || [];
      walletBalance = Number(wRes.data?.amount || 0);
      _walletState.cache.banks = accounts;
      _walletState.cache.wallet = wRes.data || {};
    } catch (e) {
      showToast(e.message, 'error');
      return;
    }
  }

  if (!accounts.length) {
    showToast('Tambahkan rekening dulu sebelum tarik saldo', 'info');
    showAddBankAccountModal();
    return;
  }

  if (walletBalance < WALLET_MIN) {
    showToast(`Saldo minimal Rp ${WALLET_MIN.toLocaleString('id-ID')}`, 'error');
    return;
  }

  const primary = accounts.find(a => a.is_primary) || accounts[0];

  const existing = document.getElementById('withdraw-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'withdraw-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:480px" role="dialog">
      <div class="modal-drag-bar"></div>
      <h2 style="font-size:18px;font-weight:800;margin-bottom:6px;text-align:center">💸 Tarik Saldo</h2>
      <p style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:18px">
        Saldo: <b style="color:var(--accent)">Rp ${walletBalance.toLocaleString('id-ID')}</b>
      </p>

      <div style="display:grid;gap:14px;margin-bottom:18px">
        <div class="form-group">
          <label class="form-label">Rekening Tujuan <span class="req">*</span></label>
          <select class="form-input" id="wd-bank-id">
            ${accounts.map(a => `<option value="${escAttr(a.id)}" ${a.id === primary.id ? 'selected' : ''}>${esc(a.bank_name)} · ${esc(a.account_number)} (${esc(a.account_holder)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Nominal (Rp) <span class="req">*</span></label>
          <input class="form-input" id="wd-amount" type="text" inputmode="numeric" placeholder="Min Rp ${WALLET_MIN.toLocaleString('id-ID')}" oninput="slPriceInput(this);_updateWithdrawPreview()">
          <div class="form-hint">Maks Rp ${walletBalance.toLocaleString('id-ID')} · Kelipatan Rp 1.000</div>
        </div>

        <!-- Quick amount buttons -->
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${[50000, 100000, 250000, 500000].filter(v => v <= walletBalance).map(v => `
            <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:6px 10px" onclick="_setWithdrawAmount(${v})">Rp ${(v/1000).toFixed(0)}K</button>
          `).join('')}
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:6px 10px;color:var(--accent);font-weight:700" onclick="_setWithdrawAmount(${walletBalance})">MAX</button>
        </div>

        <div id="wd-preview" style="background:var(--bg-secondary);border-radius:10px;padding:14px;font-size:13px;color:var(--text-secondary)">
          Masukkan nominal untuk preview perhitungan...
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="closeWithdrawModal()">Batal</button>
        <button class="btn btn-primary" style="flex:2" id="wd-submit-btn" onclick="submitWithdraw()">💸 Tarik Sekarang</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

function _setWithdrawAmount(amt) {
  const el = document.getElementById('wd-amount');
  if (el) { el.value = slFormatPrice(amt); _updateWithdrawPreview(); }
}

function _updateWithdrawPreview() {
  const amt = slParsePrice(document.getElementById('wd-amount')?.value);
  const previewEl = document.getElementById('wd-preview');
  if (!previewEl) return;

  if (!amt || amt < WALLET_MIN) {
    previewEl.innerHTML = `<div style="color:var(--text-muted);text-align:center">Masukkan nominal minimal Rp ${WALLET_MIN.toLocaleString('id-ID')}</div>`;
    return;
  }
  const net = amt - WALLET_FEE;
  if (net <= 0) {
    previewEl.innerHTML = `<div style="color:var(--rose)">⚠️ Nominal terlalu kecil setelah dipotong biaya admin</div>`;
    return;
  }
  previewEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Nominal tarik</span><span><b>Rp ${amt.toLocaleString('id-ID')}</b></span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Biaya admin</span><span style="color:var(--rose)">− Rp ${WALLET_FEE.toLocaleString('id-ID')}</span></div>
    <div style="border-top:1.5px solid var(--border);padding-top:8px;margin-top:8px;display:flex;justify-content:space-between;font-weight:700;color:var(--teal-dark);font-size:15px"><span>Diterima di rekening</span><span>Rp ${net.toLocaleString('id-ID')}</span></div>
  `;
}

function closeWithdrawModal() {
  const m = document.getElementById('withdraw-modal');
  if (m) m.remove();
  document.body.style.overflow = '';
}

async function submitWithdraw() {
  const bankId = document.getElementById('wd-bank-id')?.value;
  const amountRaw = slParsePrice(document.getElementById('wd-amount')?.value);
  const amount = amountRaw ? Math.round(amountRaw / 1000) * 1000 : 0;
  const walletBalance = Number(_walletState.cache.wallet?.amount || 0);

  if (!bankId)                          { showToast('Pilih rekening tujuan', 'error'); return; }
  if (!amount || amount < WALLET_MIN)   { showToast(`Minimal tarik Rp ${WALLET_MIN.toLocaleString('id-ID')}`, 'error'); return; }
  if (amount > walletBalance)           { showToast('Nominal melebihi saldo tersedia', 'error'); return; }
  if (amount <= WALLET_FEE)             { showToast('Nominal terlalu kecil dipotong biaya admin', 'error'); return; }

  const btn = document.getElementById('wd-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }

  try {
    await WithdrawalsAPI.create({ bank_account_id: bankId, amount });
    showToast('✅ Permintaan dikirim! Admin akan memproses dalam 1×24 jam.', 'success');
    closeWithdrawModal();
    // Refresh seluruh data
    await _loadWalletData();
    _renderActiveTab();
  } catch (e) {
    showToast(e.message || 'Gagal request withdrawal', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💸 Tarik Sekarang'; }
  }
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.renderWalletPage          = renderWalletPage;
window.refreshWalletPage         = refreshWalletPage;
window.walletSwitchTab           = walletSwitchTab;
window.walletTxFilter            = walletTxFilter;
window.walletWdFilter            = walletWdFilter;
window.walletSetPrimary          = walletSetPrimary;
window.walletDeleteBank          = walletDeleteBank;
window.showAddBankAccountModal   = showAddBankAccountModal;
window.closeBankModal            = closeBankModal;
window.submitNewBankAccount      = submitNewBankAccount;
window.showWithdrawModal         = showWithdrawModal;
window.closeWithdrawModal        = closeWithdrawModal;
window.submitWithdraw            = submitWithdraw;
window._updateWithdrawPreview    = _updateWithdrawPreview;
window._setWithdrawAmount        = _setWithdrawAmount;
window.showConfirmModal          = showConfirmModal;
window.closeConfirmModal         = closeConfirmModal;