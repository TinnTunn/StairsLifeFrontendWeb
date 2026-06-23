/**
 * StairsLife — features/admin/withdrawals.js
 *
 * Admin dashboard untuk approve/reject withdrawal mahasiswa.
 *
 * Konsumsi: WithdrawalsAPI.listAll, WithdrawalsAPI.process.
 * Helpers global: showToast, esc, escAttr, fmtRelative, showConfirmModal
 *                 (dari wallet.js — pastikan wallet.js di-load sebelum file ini).
 */
'use strict';

let _adminWdState = {
  status: 'pending',         // 'pending' | 'processing' | 'completed' | 'rejected' | 'failed' | '' (semua)
  page:   1,
  search: '',                // filter by user name (client-side)
  cache:  { items: [], pagination: null, statsAll: null },
};

const _adminWdInFlight = new Set();

/* ================================================================
   MAIN RENDER
   ================================================================ */
async function renderAdminWithdrawals() {
  const root = document.getElementById('screen-admin-withdrawals');
  if (!root) return;

  root.innerHTML = `
    <div class="auth-screen">
      <div class="auth-topbar">
        <button class="auth-back-btn" onclick="goBack()" aria-label="Back">
          <svg viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span style="font-size:16px;font-weight:700;flex:1">💸 Manajemen Penarikan</span>
        <button class="auth-back-btn" onclick="refreshAdminWithdrawals()" aria-label="Refresh" title="Refresh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        </button>
      </div>

      <div class="auth-body" style="align-items:flex-start;padding:16px 16px 80px;display:block;max-width:1100px;width:100%;margin:0 auto">
        <!-- Stats summary -->
        <div id="admin-wd-stats"></div>

        <!-- Filter & Search -->
        <div style="padding:14px 0 0;position:sticky;top:0;background:var(--bg-primary);z-index:5">
          <div class="filter-chips" id="admin-wd-filters" style="margin-bottom:10px">
            <button class="filter-chip ${_adminWdState.status === 'pending' ? 'active' : ''}" data-status="pending" onclick="adminWdFilter('pending')">⏳ Menunggu</button>
            <button class="filter-chip ${_adminWdState.status === 'processing' ? 'active' : ''}" data-status="processing" onclick="adminWdFilter('processing')">🚚 Diproses</button>
            <button class="filter-chip ${_adminWdState.status === 'completed' ? 'active' : ''}" data-status="completed" onclick="adminWdFilter('completed')">✅ Cair</button>
            <button class="filter-chip ${_adminWdState.status === 'rejected' ? 'active' : ''}" data-status="rejected" onclick="adminWdFilter('rejected')">❌ Ditolak</button>
            <button class="filter-chip ${_adminWdState.status === 'failed' ? 'active' : ''}" data-status="failed" onclick="adminWdFilter('failed')">⚠️ Gagal</button>
            <button class="filter-chip ${_adminWdState.status === '' ? 'active' : ''}" data-status="" onclick="adminWdFilter('')">Semua</button>
          </div>
          <div style="position:relative">
            <input type="text" class="form-input" id="admin-wd-search" placeholder="🔍 Cari nama/email mahasiswa..." value="${esc(_adminWdState.search)}" oninput="adminWdSearchInput(this.value)" style="font-size:13px;height:40px">
          </div>
        </div>

        <!-- List -->
        <div id="admin-wd-list" style="padding:14px 0"></div>
      </div>
    </div>
  `;

  await _loadAdminWithdrawals();
}

async function refreshAdminWithdrawals() {
  showToast('🔄 Memuat ulang...', 'info');
  await _loadAdminWithdrawals();
}

async function adminWdFilter(status) {
  _adminWdState.status = status;
  _adminWdState.page = 1;
  document.querySelectorAll('#admin-wd-filters .filter-chip').forEach(c => {
    c.classList.toggle('active', (c.dataset.status || '') === status);
  });
  await _loadAdminWithdrawals();
}

let _searchDebounce = null;
function adminWdSearchInput(val) {
  _adminWdState.search = (val || '').trim().toLowerCase();
  clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(() => _renderWithdrawalList(), 250);
}

async function _loadAdminWithdrawals() {
  const el = document.getElementById('admin-wd-list');
  const statsEl = document.getElementById('admin-wd-stats');
  if (el) el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted)">⏳ Memuat data...</div>`;
  if (statsEl) statsEl.innerHTML = '';

  try {
    // Untuk stats summary, kita perlu data semua status — fetch "all"
    // dalam 1 call besar (limit tinggi) supaya tidak banyak roundtrip.
    // Untuk produksi nanti bisa pakai endpoint /stats khusus.
    const [filteredRes, allRes] = await Promise.all([
      WithdrawalsAPI.listAll(_adminWdState.status || undefined, _adminWdState.page, 50),
      _adminWdState.cache.statsAll
        ? Promise.resolve({ data: { items: _adminWdState.cache.statsAll } })
        : WithdrawalsAPI.listAll(undefined, 1, 200),
    ]);

    _adminWdState.cache.items      = filteredRes.data?.items || [];
    _adminWdState.cache.pagination = filteredRes.data?.pagination || null;
    if (!_adminWdState.cache.statsAll) {
      _adminWdState.cache.statsAll = allRes.data?.items || [];
    }

    _renderWithdrawalStats();
    _renderWithdrawalList();
  } catch (e) {
    if (el) el.innerHTML = `
      <div class="empty-state" style="padding:32px">
        <div class="empty-state-icon">⚠️</div>
        <p style="color:var(--rose)">${esc(e?.message || 'Gagal memuat data')}</p>
        <button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="_loadAdminWithdrawals()">Coba Lagi</button>
      </div>
    `;
  }
}

function _renderWithdrawalStats() {
  const el = document.getElementById('admin-wd-stats');
  if (!el) return;
  const all = _adminWdState.cache.statsAll || [];

  const counts = {
    pending:    all.filter(w => w.status === 'pending').length,
    processing: all.filter(w => w.status === 'processing').length,
    completed:  all.filter(w => w.status === 'completed').length,
    rejected:   all.filter(w => w.status === 'rejected').length,
  };

  const totalPendingAmount = all
    .filter(w => w.status === 'pending')
    .reduce((sum, w) => sum + Number(w.amount_net || 0), 0);

  // Hari ini cair
  const today = new Date(); today.setHours(0,0,0,0);
  const completedToday = all.filter(w => {
    if (w.status !== 'completed' || !w.processed_at) return false;
    return new Date(w.processed_at) >= today;
  });
  const completedTodayAmount = completedToday.reduce((sum, w) => sum + Number(w.amount_net || 0), 0);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="card card-p-md" style="border-left:3px solid var(--amber-dark)">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">⏳ Menunggu Approval</div>
        <div style="font-size:22px;font-weight:800;color:var(--amber-dark);line-height:1">${counts.pending}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Total: <b>Rp ${totalPendingAmount.toLocaleString('id-ID')}</b></div>
      </div>
      <div class="card card-p-md" style="border-left:3px solid var(--teal-dark)">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">✅ Cair Hari Ini</div>
        <div style="font-size:22px;font-weight:800;color:var(--teal-dark);line-height:1">${completedToday.length}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Total: <b>Rp ${completedTodayAmount.toLocaleString('id-ID')}</b></div>
      </div>
    </div>
  `;
}

function _renderWithdrawalList() {
  const el = document.getElementById('admin-wd-list');
  if (!el) return;

  // Apply search filter client-side
  let items = _adminWdState.cache.items;
  if (_adminWdState.search) {
    const q = _adminWdState.search;
    items = items.filter(w => {
      const name = (w.users?.full_name || '').toLowerCase();
      const email = (w.users?.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }

  if (!items.length) {
    el.innerHTML = `<div class="empty-state" style="padding:40px">
      <div class="empty-state-icon">💸</div>
      <p style="color:var(--text-secondary);font-size:14px">${_adminWdState.search ? 'Tidak ditemukan dengan keyword tersebut' : 'Tidak ada withdrawal'}</p>
    </div>`;
    return;
  }

  const statusBadge = {
    pending:    { bg: 'var(--amber-light)',  color: 'var(--amber-dark)', label: '⏳ MENUNGGU' },
    processing: { bg: 'var(--accent-light)', color: 'var(--accent)',     label: '🚚 DIPROSES' },
    completed:  { bg: 'var(--teal-light)',   color: 'var(--teal-dark)',  label: '✅ CAIR' },
    rejected:   { bg: 'var(--rose-light)',   color: 'var(--rose)',       label: '❌ DITOLAK' },
    failed:     { bg: 'var(--rose-light)',   color: 'var(--rose)',       label: '⚠️ GAGAL' },
  };

  el.innerHTML = items.map(w => {
    const user = w.users || {};
    const bank = w.bank_account || {};
    const sb = statusBadge[w.status] || { bg: 'var(--bg-secondary)', color: 'var(--text-muted)', label: w.status };
    const reqAt = typeof fmtRelative === 'function' ? fmtRelative(w.requested_at) : new Date(w.requested_at).toLocaleString('id-ID');
    const initials = (user.full_name || '?').split(' ').slice(0,2).map(x => x[0]).join('').toUpperCase();

    return `
      <div class="card card-p-md" style="margin-bottom:10px">
        <!-- Header: status + amount -->
        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;margin-bottom:12px">
          <span style="background:${sb.bg};color:${sb.color};font-size:10px;padding:4px 9px;border-radius:6px;font-weight:700;white-space:nowrap">${sb.label}</span>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:800;color:var(--teal-dark);line-height:1">Rp ${Number(w.amount_net).toLocaleString('id-ID')}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Bruto Rp ${Number(w.amount_gross).toLocaleString('id-ID')} − Admin Rp ${Number(w.admin_fee).toLocaleString('id-ID')}</div>
          </div>
        </div>

        <!-- User info -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px;background:var(--bg-secondary);border-radius:10px">
          <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#5b3fd6);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;flex-shrink:0">${esc(initials)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(user.full_name || 'Unknown')}</div>
            <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(user.email || '-')}</div>
          </div>
        </div>

        <!-- Bank account -->
        <div style="background:var(--bg-secondary);border-radius:10px;padding:10px 12px;margin-bottom:${w.status === 'pending' ? '12px' : '0'}">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">🏦 Rekening Tujuan</div>
          <div style="font-size:14px;font-weight:700">${esc(bank.bank_name || '-')} <span style="color:var(--text-muted);font-weight:400">(${esc(bank.bank_code || '-')})</span></div>
          <div style="font-size:13px;color:var(--text-secondary);font-family:monospace;margin-top:2px">
            ${esc(bank.account_number || '-')}
            <button class="btn btn-ghost" style="padding:0 6px;height:22px;font-size:10px;margin-left:4px" onclick="_copyToClipboard('${escAttr(bank.account_number || '')}')" title="Copy nomor rekening">📋</button>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">a.n. <b style="color:var(--text-primary)">${esc(bank.account_holder || '-')}</b></div>
        </div>

        ${w.status === 'pending' ? `
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:12px">
            <button class="btn btn-ghost" style="font-size:12px;padding:8px 4px;color:var(--rose);border:1px solid var(--rose-light)" onclick="adminWdAction('${escAttr(w.id)}', 'reject', '${escAttr(user.full_name || 'Unknown')}', ${Number(w.amount_net)})">❌ Tolak</button>
            <button class="btn btn-primary" style="font-size:12px;padding:8px 4px" onclick="adminWdAction('${escAttr(w.id)}', 'approve_manual', '${escAttr(user.full_name || 'Unknown')}', ${Number(w.amount_net)})">✅ Manual</button>
            <button class="btn btn-primary" style="font-size:12px;padding:8px 4px;background:var(--teal-dark)" onclick="adminWdAction('${escAttr(w.id)}', 'approve_xendit', '${escAttr(user.full_name || 'Unknown')}', ${Number(w.amount_net)})">⚡ Xendit</button>
          </div>
        ` : ''}

        ${w.rejection_reason ? `
          <div style="margin-top:10px;padding:10px;background:var(--rose-light);border-radius:8px;font-size:12px;color:var(--rose)">
            <b>Alasan tolak:</b> ${esc(w.rejection_reason)}
          </div>
        ` : ''}

        ${w.xendit_disbursement_id ? `
          <div style="margin-top:10px;padding:8px 10px;background:var(--accent-light);border-radius:8px;font-size:11px;color:var(--accent);display:flex;align-items:center;gap:6px">
            <span>⚡ Xendit ID:</span>
            <code style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">${esc(w.xendit_disbursement_id)}</code>
            <button class="btn btn-ghost" style="padding:0 6px;height:22px;font-size:10px" onclick="_copyToClipboard('${escAttr(w.xendit_disbursement_id)}')">📋</button>
          </div>
        ` : ''}

        <!-- Footer: timestamp -->
        <div style="font-size:10px;color:var(--text-muted);margin-top:10px;display:flex;justify-content:space-between">
          <span>📅 Diminta: ${esc(reqAt)}</span>
          ${w.processed_at ? `<span>✅ Selesai: ${esc(typeof fmtRelative === 'function' ? fmtRelative(w.processed_at) : new Date(w.processed_at).toLocaleString('id-ID'))}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function _copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(
    () => showToast('📋 Disalin ke clipboard', 'success'),
    () => showToast('Gagal menyalin', 'error'),
  );
}

/* ================================================================
   PROCESS ACTION — pakai custom modal (tidak pakai native confirm/prompt)
   ================================================================ */
async function adminWdAction(id, action, userName, amountNet) {
  if (_adminWdInFlight.has(id)) return;

  if (action === 'reject') {
    _showRejectModal(id, userName, amountNet);
  } else if (action === 'approve_manual') {
    _showApproveModal(id, userName, amountNet, false);
  } else if (action === 'approve_xendit') {
    _showApproveModal(id, userName, amountNet, true);
  }
}

function _showRejectModal(id, userName, amountNet) {
  const existing = document.getElementById('admin-wd-action-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'admin-wd-action-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '10000';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:420px" role="dialog">
      <h2 style="font-size:17px;font-weight:800;margin-bottom:8px;text-align:center">❌ Tolak Penarikan</h2>
      <p style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:18px">
        ${esc(userName)} · Rp ${Number(amountNet).toLocaleString('id-ID')}
      </p>
      <div class="form-group" style="margin-bottom:18px">
        <label class="form-label">Alasan Penolakan <span class="req">*</span></label>
        <textarea class="form-input" id="wd-reject-reason" rows="3" placeholder="cth: Data rekening tidak valid, akun belum diverifikasi, dll" style="resize:vertical;min-height:80px;padding-top:10px"></textarea>
        <div class="form-hint">Alasan akan dikirim ke mahasiswa via notifikasi. Saldo otomatis dikembalikan ke dompet.</div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="_closeAdminWdActionModal()">Batal</button>
        <button class="btn btn-danger" style="flex:2" id="wd-reject-confirm-btn" onclick="_submitReject('${escAttr(id)}')">❌ Konfirmasi Tolak</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('wd-reject-reason')?.focus(), 100);
}

function _showApproveModal(id, userName, amountNet, useXendit) {
  const existing = document.getElementById('admin-wd-action-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'admin-wd-action-modal';
  modal.className = 'modal-backdrop open';
  modal.style.zIndex = '10000';
  modal.innerHTML = `
    <div class="modal-sheet" style="max-width:420px" role="dialog">
      <h2 style="font-size:17px;font-weight:800;margin-bottom:8px;text-align:center">
        ${useXendit ? '⚡ Setujui via Xendit' : '✅ Setujui (Transfer Manual)'}
      </h2>
      <p style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:18px">
        ${esc(userName)} · <b style="color:var(--teal-dark)">Rp ${Number(amountNet).toLocaleString('id-ID')}</b>
      </p>

      <div style="background:${useXendit ? 'var(--accent-light)' : 'var(--amber-light)'};border-radius:10px;padding:14px;margin-bottom:18px;font-size:13px;color:${useXendit ? 'var(--accent)' : 'var(--amber-dark)'}">
        ${useXendit
          ? '<b>Mode Xendit Disbursement</b><br>Dana akan otomatis dikirim via API Xendit. Pastikan saldo Xendit Cash cukup.'
          : '<b>Mode Transfer Manual</b><br>Lakukan transfer manual lewat aplikasi banking dulu, baru klik konfirmasi di sini.'}
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="_closeAdminWdActionModal()">Batal</button>
        <button class="btn btn-primary" style="flex:2;${useXendit ? 'background:var(--teal-dark)' : ''}" id="wd-approve-confirm-btn" onclick="_submitApprove('${escAttr(id)}', ${useXendit})">
          ${useXendit ? '⚡ Kirim via Xendit' : '✅ Saya sudah transfer'}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

function _closeAdminWdActionModal() {
  const m = document.getElementById('admin-wd-action-modal');
  if (m) m.remove();
  document.body.style.overflow = '';
}

async function _submitReject(id) {
  const reason = document.getElementById('wd-reject-reason')?.value?.trim();
  if (!reason || reason.length < 5) {
    showToast('Alasan minimal 5 karakter', 'error');
    return;
  }

  const btn = document.getElementById('wd-reject-confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }
  _adminWdInFlight.add(id);

  try {
    const res = await WithdrawalsAPI.process(id, { action: 'reject', reason });
    showToast(`✅ ${res.message || 'Penarikan ditolak'}`, 'success');
    _closeAdminWdActionModal();
    _adminWdState.cache.statsAll = null;  // invalidate stats cache
    await _loadAdminWithdrawals();
  } catch (e) {
    showToast(e.message || 'Gagal proses', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '❌ Konfirmasi Tolak'; }
  } finally {
    _adminWdInFlight.delete(id);
  }
}

async function _submitApprove(id, useXendit) {
  const btn = document.getElementById('wd-approve-confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }
  _adminWdInFlight.add(id);

  try {
    const res = await WithdrawalsAPI.process(id, { action: 'approve', use_xendit: !!useXendit });
    showToast(`✅ ${res.message || (useXendit ? 'Disbursement dikirim' : 'Penarikan disetujui')}`, 'success');
    _closeAdminWdActionModal();
    _adminWdState.cache.statsAll = null;
    await _loadAdminWithdrawals();
  } catch (e) {
    showToast(e.message || 'Gagal proses', 'error');
    if (btn) { btn.disabled = false; btn.textContent = useXendit ? '⚡ Kirim via Xendit' : '✅ Saya sudah transfer'; }
  } finally {
    _adminWdInFlight.delete(id);
  }
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.renderAdminWithdrawals  = renderAdminWithdrawals;
window.refreshAdminWithdrawals = refreshAdminWithdrawals;
window.adminWdFilter           = adminWdFilter;
window.adminWdSearchInput      = adminWdSearchInput;
window.adminWdAction           = adminWdAction;
window._submitReject           = _submitReject;
window._submitApprove          = _submitApprove;
window._closeAdminWdActionModal = _closeAdminWdActionModal;
window._copyToClipboard        = _copyToClipboard;
window._loadAdminWithdrawals   = _loadAdminWithdrawals;