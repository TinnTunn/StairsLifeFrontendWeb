/**
 * StairsLife — features/admin/announcements.js
 * adminSendAnnouncement, renderAdminAnnouncements.
 * Phase 3 — Modularisasi.
 */
'use strict';

async function adminSendAnnouncement() {
  const title  = (document.getElementById('admin-ann-title')?.value || '').trim();
  const body   = (document.getElementById('admin-ann-body')?.value || '').trim();
  const target = document.getElementById('admin-ann-target')?.value || 'all';

  if (!title || !body) { showToast('Judul dan isi pengumuman wajib diisi', 'error'); return; }

  try {
    await AdminAPI.sendAnnouncement({ title, body, target });
    ADMIN_AUDIT_LOGS.unshift({ who: 'Admin Utama', action: `Kirim announcement ke ${target}: ${title}`, at: new Date() });
    document.getElementById('admin-ann-title').value = '';
    document.getElementById('admin-ann-body').value  = '';
    await renderAdminAnnouncements();
    showToast('Broadcast berhasil dikirim', 'success');
  } catch (error) {
    showToast(error.message || 'Gagal mengirim broadcast', 'error');
  }
}

async function renderAdminAnnouncements() {
  const el = document.getElementById('admin-announcements-list');
  if (!el) return;

  el.innerHTML = skeletons.announcementItems(3);

  try {
    const res   = await AdminAPI.getAnnouncements();
    const items = (res.data || []).slice();
    if (!items.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📣</div><div class="empty-state-title">Belum ada broadcast</div></div>`;
      return;
    }
    el.innerHTML = items.map(a => {
      const time = a.created_at || a.time || new Date();
      return `
      <div class="card card-p-md" style="margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div style="font-size:14px;font-weight:700">${a.title}</div>
          ${statusBadge(a.target === 'all' ? 'aktif' : 'pending')}
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${a.body}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Target: ${a.target === 'all' ? 'Semua pengguna' : a.target === 'student' ? 'Mahasiswa' : 'Bisnis'} · ${timeAgo(time)}</div>
      </div>`;
    }).join('');
  } catch (error) {
    if (ADMIN_ANNOUNCEMENTS.length) {
      el.innerHTML = ADMIN_ANNOUNCEMENTS.map(a => `
        <div class="card card-p-md" style="margin-bottom:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div style="font-size:14px;font-weight:700">${a.title}</div>
            ${statusBadge(a.target === 'all' ? 'aktif' : 'pending')}
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${a.body}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Target: ${a.target === 'all' ? 'Semua pengguna' : a.target === 'student' ? 'Mahasiswa' : 'Bisnis'} · ${fmtRelative(a.time)}</div>
        </div>
      `).join('');
    } else {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📣</div><div class="empty-state-title">Belum ada broadcast</div></div>`;
    }
  }
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.adminSendAnnouncement   = adminSendAnnouncement;
window.renderAdminAnnouncements = renderAdminAnnouncements;
