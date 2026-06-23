/**
 * StairsLife — features/payments/payments.js
 *
 * Update: integrasi Xendit Payment Gateway.
 *
 * Flow baru:
 *   1. Bisnis tap "Bayar & Buat Kontrak" di lamaran mahasiswa
 *   2. Modal tampil dengan nominal + deadline (tanpa upload bukti lagi)
 *   3. Submit → backend approve application → create contract → create
 *      Xendit invoice → return invoice_url
 *   4. FE buka invoice_url di tab baru / redirect
 *   5. User bayar di hosted page Xendit (VA / QRIS / E-wallet)
 *   6. Xendit redirect ke /payment/result, FE call syncPayment untuk
 *      force sync status (kalau webhook belum sampai)
 *
 * Depends on: PaymentsAPI, ContractsAPI, ApplicationsAPI, showToast,
 *             onEnterBusiness, statusBadge, esc, escAttr.
 */
'use strict';

/* ================================================================
   PAYMENTS LIST (business dashboard tab)
   ================================================================ */
async function renderPayments() {
  const el = document.getElementById('payments-list');
  if (!el) return;

  try {
    const myId     = TokenManager.getUser()?.id;
    const res      = await PaymentsAPI.getMyPayments();
    const payments = res.data || [];

    if (!payments.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">💳</div>
        <div class="empty-state-title">Belum ada transaksi</div>
        <p class="empty-state-desc">Riwayat pembayaran escrow akan muncul di sini setelah kamu membuat kontrak.</p>
      </div>`;
      return;
    }

    // Summary: pengeluaran (payer) vs pendapatan (payee)
    const totalKeluar  = payments
      .filter(p => p.payer_id === myId)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const fmtRp = (n) => n >= 1_000_000
      ? `Rp ${(n / 1_000_000).toFixed(1)}jt`
      : `Rp ${(n / 1_000).toFixed(0)}K`;

    const summaryHtml = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div class="card card-p-md" style="border-left:3px solid var(--rose)">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Total Pengeluaran</div>
          <div style="font-size:18px;font-weight:800;color:var(--rose)">${fmtRp(totalKeluar)}</div>
        </div>
        <div class="card card-p-md" style="border-left:3px solid var(--teal)">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Dana di Escrow</div>
          <div style="font-size:18px;font-weight:800;color:var(--teal)">${fmtRp(
            payments.filter(p => p.payer_id === myId && p.status === 'held')
              .reduce((s, p) => s + (Number(p.amount) || 0), 0)
          )}</div>
        </div>
      </div>`;

    el.innerHTML = summaryHtml + payments.map(p => {
      const isPayer    = p.payer_id === myId;
      const isPayee    = p.payee_id === myId;
      const label      = isPayer ? 'Pengeluaran' : isPayee ? 'Pendapatan' : 'Transaksi';
      const displayAmt = isPayer ? Number(p.amount) : Number(p.net_amount);
      const color      = isPayer ? 'var(--rose)' : 'var(--teal-dark)';
      const icon       = isPayer ? '↑' : '↓';
      const projectTitle = p.contracts?.projects?.title || 'Project';

      // Kalau pending dan ada invoice_url, tampilkan tombol "Lanjut Bayar"
      const isPending = p.status === 'pending' && isPayer && p.xendit_invoice_url;
      const expired   = p.status === 'expired';

      return `
      <div class="card card-p-md" style="margin-bottom:10px;display:flex;align-items:center;gap:14px">
        <div style="width:44px;height:44px;border-radius:50%;background:${isPayer ? 'var(--rose-light, #fef2f2)' : 'var(--teal-light)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;font-weight:700;color:${color}">
          ${icon}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(projectTitle)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${label} · ${new Date(p.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}${p.payment_channel ? ' · ' + esc(p.payment_channel) : ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:15px;font-weight:700;color:${color}">
            ${isPayer ? '-' : '+'}Rp ${(displayAmt || 0).toLocaleString('id-ID')}
          </div>
          ${statusBadge(p.status)}
          ${isPending ? `<button class="btn btn-primary" style="margin-top:6px;font-size:11px;padding:4px 10px" onclick="continuePayment('${escAttr(p.xendit_invoice_url)}')">Lanjut Bayar</button>` : ''}
          ${expired && isPayer ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">Invoice expired</div>` : ''}
        </div>
      </div>`;
    }).join('');

  } catch (e) {
    console.error('[renderPayments]', e);
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">❌</div>
      <div class="empty-state-title">Gagal memuat pembayaran</div>
      <p class="empty-state-desc">${esc(e?.message || 'Coba refresh halaman')}</p>
    </div>`;
  }
}

/* ================================================================
   LANJUT BAYAR (untuk payment yang masih pending)
   ================================================================ */
function continuePayment(invoiceUrl) {
  if (!invoiceUrl) {
    showToast('Link pembayaran tidak ditemukan', 'error');
    return;
  }
  // Buka di tab baru — supaya state app StairsLife tidak hilang
  window.open(invoiceUrl, '_blank', 'noopener');
}

/* ================================================================
   ESCROW MODAL — Xendit version
   ================================================================ */
function showEscrowModal(applicationId, application, projectTitle) {
  const existing = document.getElementById('escrow-modal');
  if (existing) existing.remove();

  const amount       = application?.offered_budget || '';
  const deadline     = application?.estimated_completion
    ? new Date(application.estimated_completion).toISOString().split('T')[0]
    : '';
  const studentName  = application?.users?.full_name || 'Mahasiswa';
  const hasOffered   = !!application?.offered_budget && Number(application.offered_budget) > 0;

  const modal        = document.createElement('div');
  modal.id           = 'escrow-modal';
  modal.className    = 'modal-backdrop open';
  modal.style.zIndex = '9999';
  modal.innerHTML    = `
    <div class="modal-sheet" style="max-width:520px;overflow-y:auto;max-height:90vh" role="dialog">
      <div class="modal-drag-bar"></div>
      <div style="text-align:center;margin-bottom:20px">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px">🔒</div>
        <h2 style="font-size:20px;font-weight:800;margin-bottom:6px">Bayar & Buat Kontrak</h2>
        <p style="font-size:13px;color:var(--text-secondary)">Project: <b>${esc(projectTitle)}</b> · Freelancer: <b>${esc(studentName)}</b></p>
      </div>

      <div class="info-box info-box--teal" style="margin-bottom:16px">
        <svg viewBox="0 0 24 24" style="stroke:var(--teal-dark)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
        <p style="color:var(--teal-dark);font-size:13px">Dana ditahan di escrow sampai kamu setujui deliverable. Aman, terlindungi, & pembayaran lewat Xendit (VA, QRIS, E-Wallet).</p>
      </div>

      ${hasOffered ? `
      <div class="info-box info-box--amber" style="margin-bottom:16px;background:var(--amber-light);border-color:rgba(245,158,11,0.3);padding:12px;border-radius:var(--radius-md)">
        <p style="color:var(--amber-dark);font-size:13px;margin:0">
          💰 <b>Freelancer meminta:</b> Rp ${Number(amount).toLocaleString('id-ID')}.
          Default nominal sudah diisi. Kamu boleh nego dengan ubah angka di bawah.
        </p>
      </div>
      ` : `
      <div class="info-box info-box--gray" style="margin-bottom:16px;background:var(--bg-secondary);padding:12px;border-radius:var(--radius-md)">
        <p style="color:var(--text-secondary);font-size:13px;margin:0">
          💡 Freelancer tidak menentukan budget — silakan tentukan nominal yang kamu siap bayar.
        </p>
      </div>
      `}

      <div style="display:grid;gap:14px;margin-bottom:20px">
        <div class="form-group">
          <label class="form-label">Nominal Kontrak (Rp) <span class="req">*</span></label>
          <input class="form-input" id="escrow-amount" type="text" inputmode="numeric" value="${slFormatPrice(amount)}" placeholder="Sesuai kesepakatan" oninput="slPriceInput(this)">
          <div class="form-hint">${hasOffered ? `Tawaran freelancer: <b>Rp ${Number(amount).toLocaleString('id-ID')}</b>` : 'Mahasiswa belum set budget. Isi sesuai kesepakatan.'}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Deadline Kontrak <span class="req">*</span></label>
          <input class="form-input" id="escrow-deadline" type="date" value="${deadline}" min="${new Date().toISOString().split('T')[0]}" max="${new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0]}">
          <div class="form-hint">Estimasi dari freelancer: ${deadline ? new Date(deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</div>
        </div>
      </div>

      <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;margin-bottom:16px;font-size:13px;color:var(--text-secondary)">
        💳 Setelah klik tombol di bawah, kamu akan diarahkan ke halaman pembayaran Xendit. Pilih metode (Virtual Account / QRIS / OVO / DANA / GoPay / kartu kredit).
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="closeEscrowModal()">Batal</button>
        <button class="btn btn-primary" style="flex:2;height:48px;font-size:15px" id="escrow-submit-btn" onclick="submitEscrowAndContract('${escAttr(applicationId)}')">
          🔒 Lanjutkan ke Pembayaran
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

function closeEscrowModal() {
  const modal = document.getElementById('escrow-modal');
  if (modal) modal.remove();
  document.body.style.overflow = '';
}

let _submitEscrowInFlight = false;
async function submitEscrowAndContract(applicationId) {
  if (_submitEscrowInFlight) return;
  const amountRaw = slParsePrice(document.getElementById('escrow-amount')?.value);
  const amount    = amountRaw ? Math.round(amountRaw / 1000) * 1000 : 0;
  const deadline  = document.getElementById('escrow-deadline')?.value;

  if (!amount || amount < 10000)  { showToast('Masukkan jumlah minimal Rp 10.000', 'error'); return; }
  if (amount > 100000000)         { showToast('Maximum Rp 100.000.000 per kontrak', 'error'); return; }
  if (!deadline)                  { showToast('Pilih deadline kontrak', 'error'); return; }

  // Validasi deadline
  const dlDate  = new Date(deadline);
  const todayD  = new Date(); todayD.setHours(0,0,0,0);
  const maxDate = new Date(Date.now() + 365*24*3600*1000);
  if (isNaN(dlDate.getTime())) { showToast('Format tanggal deadline tidak valid', 'error'); return; }
  if (dlDate < todayD)         { showToast('Deadline tidak boleh tanggal masa lalu', 'error'); return; }
  if (dlDate > maxDate)        { showToast('Deadline maksimal 1 tahun dari sekarang', 'error'); return; }

  const btn = document.getElementById('escrow-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyetujui lamaran...'; }
  _submitEscrowInFlight = true;

  let approvedHere = false;
  let contractId = null;

  try {
    // 1. Approve application (idempotent kalau sudah approved)
    try {
      const approveRes = await ApplicationsAPI.updateStatus(applicationId, 'approved');
      approvedHere = true;
      window._lastAutoRejectedCount = approveRes?.meta?.auto_rejected_count || 0;
    } catch (approveErr) {
      console.warn('[escrow] approve application:', approveErr?.message);
    }

    if (btn) btn.textContent = '⏳ Membuat kontrak...';

    // 2. Buat kontrak
    const contractRes = await ContractsAPI.create({
      application_id: applicationId,
      agreed_budget:  amount,
      deadline,
    });
    const contract = contractRes.data;
    contractId = contract.id;

    if (btn) btn.textContent = '⏳ Membuat invoice Xendit...';

    // 3. Create Xendit invoice (replace upload bukti manual)
    const invoiceRes = await PaymentsAPI.createInvoice({
      contract_id: contract.id,
      amount,
    });
    const invoiceUrl = invoiceRes?.data?.invoice_url;
    const paymentId  = invoiceRes?.data?.payment_id;

    if (!invoiceUrl) {
      throw new Error('Backend tidak return invoice_url. Coba lagi.');
    }

    closeEscrowModal();
    showToast(`✅ Kontrak dibuat. Membuka halaman pembayaran...`, 'success');

    // Beritahu lamaran lain yang otomatis ditolak
    const autoRejected = window._lastAutoRejectedCount || 0;
    if (autoRejected > 0) {
      setTimeout(() => {
        showToast(
          `ℹ️ ${autoRejected} lamaran lain otomatis ditolak (1 project hanya untuk 1 mahasiswa)`,
          'info',
        );
      }, 2200);
    }
    window._lastAutoRejectedCount = 0;

    // 4. Redirect ke Xendit.
    //    FIX: sebelumnya baris ini pakai `res` yang tidak pernah dideklarasi
    //    (variabelnya `invoiceRes`) → ReferenceError dilempar SETELAH invoice
    //    sukses dibuat, sehingga halaman Xendit tidak pernah terbuka & user
    //    melihat toast error padahal kontrak + invoice sudah jadi. Saat user
    //    coba lagi, backend menolak dengan "Kontrak sudah ada" ("project sudah
    //    di-accept"). Pakai `paymentId` (sudah di-resolve di atas) / invoiceRes.
    //    Set flag supaya saat user balik ke tab ini, data auto-refresh.
    window._pendingPaymentCheck = {
      contractId: contractId,
      paymentId:  paymentId || invoiceRes?.data?.id || null,
      openedAt:   Date.now(),
    };

    // 5. Refresh tampilan dulu (sebelum membuka tab pembayaran) supaya
    //    dashboard sudah ter-update saat user kembali.
    try { await onEnterBusiness(); } catch (_) { /* non-fatal */ }

    // 6. Buka halaman pembayaran Xendit.
    //    Coba tab baru (state SPA tetap hidup supaya auto-refresh saat user
    //    kembali bisa jalan). Kalau diblokir popup-blocker — umum terjadi
    //    karena open() tidak lagi dalam user-gesture langsung setelah beberapa
    //    await — fallback ke redirect tab yang sama.
    //
    //    BUG FIX: sebelumnya pakai flag 'noopener'. Per spec, window.open
    //    dengan 'noopener' SELALU return null, sehingga cek `!win` selalu
    //    true → tab ini SELALU ikut di-redirect (double-navigasi: tab baru
    //    terbuka DAN tab ini pindah). Akibatnya handler visibilitychange
    //    (auto-sync saat balik) tidak pernah jalan. Kita buka tanpa noopener
    //    supaya bisa deteksi popup-block dengan benar, lalu putus opener
    //    secara manual untuk cegah reverse-tabnabbing.
    let win = null;
    try { win = window.open(invoiceUrl, '_blank'); } catch (_) { win = null; }
    if (win) {
      try { win.opener = null; } catch (_) { /* cross-origin sudah aman */ }
    } else {
      showToast('Membuka halaman pembayaran...', 'info');
      window.location.assign(invoiceUrl);
    }
  } catch (error) {
    const hint = approvedHere && !contractId
      ? ' (Lamaran sudah disetujui, silakan ulangi pembuatan kontrak.)'
      : (approvedHere && contractId
        ? ' (Kontrak sudah dibuat tapi invoice gagal. Buka kontrak lalu klik "Bayar Sekarang".)'
        : '');
    showToast((error.message || 'Gagal membuat kontrak') + hint, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🔒 Lanjutkan ke Pembayaran'; }
  } finally {
    _submitEscrowInFlight = false;
  }
}

/* ================================================================
   PAY EXISTING CONTRACT
   ================================================================
   Dipanggil dari halaman kontrak kalau payment status='expired' atau
   belum ada. Buat invoice baru untuk kontrak yang sudah ada.
*/
async function payContractInvoice(contractId, amount) {
  if (!contractId || !amount) {
    showToast('Data kontrak tidak lengkap', 'error');
    return;
  }

  try {
    showToast('⏳ Membuat invoice...', 'info');
    const res = await PaymentsAPI.createInvoice({
      contract_id: contractId,
      amount: Number(amount),
    });
    const url = res?.data?.invoice_url;
    if (!url) throw new Error('invoice_url tidak ada di response');

    window._pendingPaymentCheck = {
      contractId: contractId,
      paymentId:  res?.data?.payment_id || res?.data?.id || null,
      openedAt:   Date.now(),
    };
    showToast('✅ Invoice siap. Membuka halaman pembayaran...', 'success');

    // BUG FIX: sebelumnya `setTimeout(() => window.open(...noopener), 500)`.
    // setTimeout memutus user-gesture → popup hampir pasti diblokir & tidak
    // ada fallback, jadi halaman pembayaran tidak pernah terbuka. Buka
    // langsung (masih dalam gesture klik), deteksi blokir, fallback redirect.
    let win = null;
    try { win = window.open(url, '_blank'); } catch (_) { win = null; }
    if (win) {
      try { win.opener = null; } catch (_) { /* cross-origin sudah aman */ }
    } else {
      window.location.assign(url);
    }
  } catch (e) {
    showToast(e.message || 'Gagal buat invoice', 'error');
  }
}

/* ================================================================
   APPROVE DELIVERABLE — alur approve nyata ada di
   approveDeliverableFromContract() (contracts.js). Fungsi duplikat
   approveDeliverableAndRelease() dihapus: tidak pernah di-wire ke UI
   dan masih memakai pola double-release yang sudah ditinggalkan.
   ================================================================ */

/* ================================================================
   PAYMENT RESULT PAGE (callback dari Xendit redirect)
   ================================================================
   Dipanggil oleh router saat URL = /payment/result?status=success&payment_id=...
   FE call sync API untuk force update status (fallback kalau webhook miss).
*/
async function renderPaymentResult() {
  const params = new URLSearchParams(window.location.search);
  const status    = params.get('status');     // success | failed
  const paymentId = params.get('payment_id');

  const el = document.getElementById('payment-result-content');
  if (!el) return;

  const isSuccess = status === 'success';
  const iconHtml = isSuccess
    ? `<div style="width:80px;height:80px;border-radius:50%;background:var(--teal-light);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:40px">✅</div>`
    : `<div style="width:80px;height:80px;border-radius:50%;background:var(--rose-light);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:40px">❌</div>`;

  const title = isSuccess ? 'Pembayaran Berhasil!' : 'Pembayaran Gagal / Dibatalkan';
  const desc  = isSuccess
    ? 'Dana sudah masuk ke escrow StairsLife. Mahasiswa akan menerima notifikasi dan mulai mengerjakan project. Kamu bisa pantau progress di halaman kontrak.'
    : 'Pembayaran tidak berhasil. Kamu bisa coba lagi dari halaman kontrak (klik "Bayar Sekarang") atau buat invoice baru.';

  el.innerHTML = `
    <div style="max-width:480px;margin:40px auto;text-align:center;padding:24px">
      ${iconHtml}
      <h1 style="font-size:24px;font-weight:800;margin-bottom:12px">${title}</h1>
      <p style="color:var(--text-secondary);font-size:15px;line-height:1.6;margin-bottom:24px">${desc}</p>
      <div id="payment-result-sync" style="font-size:13px;color:var(--text-muted);margin-bottom:20px">⏳ Mengkonfirmasi status pembayaran...</div>
      <div style="display:flex;gap:10px;justify-content:center;max-width:420px;margin:0 auto">
        <button class="btn btn-primary" style="flex:1;height:46px" onclick="goToContractsFromResult()">Kembali ke Dashboard</button>
        ${isSuccess ? '' : `<button class="btn btn-ghost" style="flex:1;height:46px" onclick="goToContractsFromResult()">Lihat Kontrak</button>`}
      </div>
    </div>
  `;

  // Auto-poll: konfirmasi status ke backend berulang sampai final, tanpa
  // perlu refresh manual. Backend hit Xendit API tiap sync, jadi begitu
  // Xendit menandai PAID, status langsung jadi 'held'.
  if (paymentId) {
    _pollPaymentStatus(paymentId);
  }
}

const _PAYMENT_TERMINAL_OK   = ['held', 'released', 'refunded', 'split_settled'];
const _PAYMENT_TERMINAL_FAIL = ['expired', 'failed'];

async function _pollPaymentStatus(paymentId, attempt = 1, maxAttempts = 8) {
  const syncEl = document.getElementById('payment-result-sync');
  if (!syncEl) return;
  try {
    const sync = await PaymentsAPI.syncPayment(paymentId);
    const st         = sync?.data?.status;
    const contractId = sync?.data?.contract_id;

    if (_PAYMENT_TERMINAL_OK.includes(st)) {
      syncEl.innerHTML = `<span style="color:var(--teal-dark)">✅ Dana terkonfirmasi masuk <b>Escrow</b>. Kontrak aktif & mahasiswa sudah dinotifikasi.</span>
        <div style="margin-top:12px"><button class="btn btn-primary btn-sm" onclick="goToContractsFromResult()">📋 Lihat Kontrak Saya</button></div>`;
      return; // selesai — stop polling
    }
    if (_PAYMENT_TERMINAL_FAIL.includes(st)) {
      syncEl.innerHTML = `<span style="color:var(--rose)">❌ Invoice ${esc(st)}. Silakan buat invoice baru dari halaman kontrak.</span>`;
      return;
    }

    // Masih pending → retry
    if (attempt < maxAttempts) {
      syncEl.innerHTML = `<span style="color:var(--amber-dark)">⏳ Mengkonfirmasi pembayaran... (${attempt}/${maxAttempts})</span>`;
      setTimeout(() => _pollPaymentStatus(paymentId, attempt + 1, maxAttempts), 2500);
    } else {
      syncEl.innerHTML = `<span style="color:var(--amber-dark)">⏳ Pembayaran masih diproses penyedia. Status akan update otomatis via notifikasi.</span>
        <div style="margin-top:10px"><button class="btn btn-ghost btn-sm" onclick="_pollPaymentStatus('${escAttr(paymentId)}',1,8)">🔄 Cek lagi</button></div>`;
    }
  } catch (e) {
    // Error sementara (mis. jaringan) → tetap retry beberapa kali
    if (attempt < maxAttempts) {
      setTimeout(() => _pollPaymentStatus(paymentId, attempt + 1, maxAttempts), 2500);
    } else {
      syncEl.innerHTML = `<span style="color:var(--text-muted)">Gagal sync status: ${esc(e?.message || 'error')}.
        <button class="btn btn-ghost btn-sm" onclick="_pollPaymentStatus('${escAttr(paymentId)}',1,8)">🔄 Coba lagi</button></span>`;
    }
  }
}

// Kembali ke app dari halaman standalone /payment/result.
// BUG FIX: dulu redirect ke '/' → bootstrap menampilkan LANDING (app tidak
// auto-route user login ke dashboard), jadi tombol "Kembali ke Dashboard" /
// "Lihat Kontrak" malah mendarat di landing. Sekarang reload ke '/#screen-<role>'
// supaya bootstrap (_screenFromLocation membaca hash) langsung membuka dashboard
// sesuai role + memicu onEnter<Role> (render data). Kalau belum login → '/'.
function goToContractsFromResult() {
  const user = (typeof TokenManager !== 'undefined') ? TokenManager.getUser() : null;
  if (!user) { window.location.href = '/'; return; }
  const screen = user.role === 'admin'  ? 'screen-admin'
               : user.role === 'bisnis' ? 'screen-business'
               : 'screen-student';
  window.location.href = '/#' + screen;
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.renderPayments               = renderPayments;
window.showEscrowModal              = showEscrowModal;
window.closeEscrowModal             = closeEscrowModal;
window.submitEscrowAndContract      = submitEscrowAndContract;
window.continuePayment              = continuePayment;
window.payContractInvoice           = payContractInvoice;
window.renderPaymentResult          = renderPaymentResult;
window._pollPaymentStatus           = _pollPaymentStatus;
window.goToContractsFromResult      = goToContractsFromResult;