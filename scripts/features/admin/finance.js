/**
 * StairsLife — features/admin/finances.js
 * Dashboard keuangan admin — komisi platform 10%
 */
'use strict';

let _finChart   = null;
let _finPage    = 1;
const _finLimit = 15;

async function renderAdminFinances() {
  try {
    const res  = await AdminAPI.getFinances();
    const data = res.data || {};
    const s    = data.summary || {};

    const fmtRp = n => `Rp ${(n || 0).toLocaleString('id-ID')}`;

    const totalEl  = document.getElementById('fin-total-komisi');
    const bulanEl  = document.getElementById('fin-bulan-ini');
    const transakEl = document.getElementById('fin-total-transaksi');
    const hariEl   = document.getElementById('fin-hari-ini');
    const mingguEl = document.getElementById('fin-minggu-ini');

    if (totalEl)   totalEl.textContent   = fmtRp(s.total_komisi || 0);
    if (bulanEl)   bulanEl.textContent   = fmtRp(s.komisi_bulan_ini || 0);
    if (transakEl) transakEl.textContent = s.total_transaksi || 0;
    if (hariEl)    hariEl.textContent    = fmtRp(s.komisi_hari_ini || 0);
    if (mingguEl)  mingguEl.textContent  = fmtRp(s.komisi_minggu_ini || 0);

    // Chart tren 30 hari
    const trend  = data.daily_trend || [];
    const labels = trend.map(d => {
      const dt = new Date(d.date);
      return `${dt.getDate()}/${dt.getMonth() + 1}`;
    });
    const values = trend.map(d => d.komisi);

    const ctx = document.getElementById('fin-chart')?.getContext('2d');
    if (ctx) {
      if (_finChart) _finChart.destroy();
      _finChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Komisi (Rp)',
            data: values,
            borderColor: '#5B5BF5',
            backgroundColor: 'rgba(91,91,245,0.1)',
            borderWidth: 2,
            pointRadius: 3,
            fill: true,
            tension: 0.4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: v => v >= 1000000
                  ? `${(v / 1000000).toFixed(1)}jt`
                  : `${(v / 1000).toFixed(0)}K`,
                color: 'var(--text-muted)',
              },
              grid: { color: 'rgba(128,128,128,0.1)' },
            },
            x: {
              ticks: { color: 'var(--text-muted)', maxTicksLimit: 10 },
              grid: { display: false },
            },
          },
        },
      });
    }
  } catch (e) {
    console.error('[finances] gagal load summary:', e.message);
    showToast('Gagal memuat data keuangan', 'error');
  }

  await loadFinanceDetail();
}

async function loadFinanceDetail() {
  const tableEl = document.getElementById('fin-detail-table');
  const status  = document.getElementById('fin-status-filter')?.value || '';
  if (!tableEl) return;

  tableEl.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted)">Memuat...</div>`;

  try {
    const res        = await AdminAPI.getFinancesDetail(_finPage, _finLimit, status);
    const payments   = res.data?.payments || [];
    const pagination = res.data?.pagination || {};

    if (!payments.length) {
      tableEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💳</div><div class="empty-state-title">Tidak ada transaksi</div></div>`;
      return;
    }

    const fmtRp   = n => `Rp ${(n || 0).toLocaleString('id-ID')}`;
    const fmtDate = d => d
      ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : '-';

    tableEl.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="border-bottom:2px solid var(--border);color:var(--text-muted);text-align:left">
              <th style="padding:10px 8px">Project</th>
              <th style="padding:10px 8px">Bisnis</th>
              <th style="padding:10px 8px">Mahasiswa</th>
              <th style="padding:10px 8px;text-align:right">Nilai</th>
              <th style="padding:10px 8px;text-align:right;color:var(--teal-dark)">Komisi 10%</th>
              <th style="padding:10px 8px">Status</th>
              <th style="padding:10px 8px">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => {
              const contract = p.contracts || {};
              const project  = contract.projects || {};
              const biz      = contract.users_contracts_business_idTousers || {};
              const student  = contract.users_contracts_student_idTousers  || {};
              const badge    = p.status === 'released'
                ? `<span class="badge badge-teal" style="font-size:10px">✅ Released</span>`
                : p.status === 'held'
                  ? `<span class="badge badge-amber" style="font-size:10px">🔒 Held</span>`
                  : `<span class="badge badge-gray" style="font-size:10px">${esc(p.status)}</span>`;
              return `
                <tr style="border-bottom:1px solid var(--divider)"
                    onmouseover="this.style.background='var(--bg-surface)'"
                    onmouseout="this.style.background=''">
                  <td style="padding:10px 8px;font-weight:600;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(project.title || '')}">${esc(project.title || '-')}</td>
                  <td style="padding:10px 8px;color:var(--text-secondary)">${esc(biz.full_name || '-')}</td>
                  <td style="padding:10px 8px;color:var(--text-secondary)">${esc(student.full_name || '-')}</td>
                  <td style="padding:10px 8px;text-align:right;font-weight:600">${fmtRp(p.amount)}</td>
                  <td style="padding:10px 8px;text-align:right;font-weight:700;color:var(--teal-dark)">${fmtRp(p.platform_fee)}</td>
                  <td style="padding:10px 8px">${badge}</td>
                  <td style="padding:10px 8px;color:var(--text-muted)">${esc(fmtDate(p.released_at || p.created_at))}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    // Pagination
    const pageEl = document.getElementById('fin-pagination');
    if (pageEl) {
      if (pagination.total_pages > 1) {
        pageEl.innerHTML = `
          <button class="btn btn-ghost btn-sm" ${_finPage <= 1 ? 'disabled' : ''} onclick="_finGoPage(${_finPage - 1})">← Prev</button>
          <span style="font-size:13px;color:var(--text-muted);padding:0 12px;line-height:32px">Hal ${_finPage} / ${pagination.total_pages} (${pagination.total} transaksi)</span>
          <button class="btn btn-ghost btn-sm" ${_finPage >= pagination.total_pages ? 'disabled' : ''} onclick="_finGoPage(${_finPage + 1})">Next →</button>`;
      } else {
        pageEl.innerHTML = '';
      }
    }
  } catch (e) {
    tableEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat transaksi</div><p class="empty-state-desc">${esc(e.message)}</p></div>`;
  }
}

function _finGoPage(page) {
  _finPage = page;
  loadFinanceDetail();
}

window.renderAdminFinances = renderAdminFinances;
window.loadFinanceDetail   = loadFinanceDetail;
window._finGoPage          = _finGoPage;