/**
 * StairsLife — features/student/student.js
 * onEnterStudent, switchStudentTab, loadStudentProfile.
 */
'use strict';

async function onEnterStudent() {
  try {
    const res  = await UsersAPI.getMe();
    const user = res.data || {};
    TokenManager.setUser(user);

    const name         = user.full_name || 'Pengguna';
    const uni          = user.university || '';
    const major        = user.major || '';
    const semester     = user.semester || '';
    const tier         = user.tier || 'pemula';
    const tierLabel    = tier === 'mahir' ? '🔥 Mahir' : tier === 'menengah' ? '⚡ Menengah' : '🌱 Pemula';
    const tierClass    = tier === 'mahir' ? 'badge-accent' : tier === 'menengah' ? 'badge-amber' : 'badge-teal';
    const subtitleText = `${uni}${major ? ' · ' + major : ''}${semester ? ' · Semester ' + semester : ''}`;

    // Greeting
    document.querySelectorAll('.dash-greeting').forEach(el => {
      if (el.closest('#st-tab-0')) el.textContent = `Halo, ${name}! 👋`;
    });

    // Subtitle — HANYA elemen subtitle student. JANGAN pakai querySelectorAll
    // global karena akan menimpa .dash-subtitle milik layar business & admin
    // (yang tersembunyi di DOM) dengan data jurusan/semester mahasiswa.
    const stSubtitleEl = document.getElementById('st-greeting-sub');
    if (stSubtitleEl) stSubtitleEl.textContent = subtitleText;

    // Badge tier di beranda
    const tierBadgeHome = document.getElementById('st-verify-badge-home');
    if (tierBadgeHome) {
      const tierBadgeEl = tierBadgeHome.nextElementSibling;
      if (tierBadgeEl) {
        tierBadgeEl.className   = `badge ${tierClass}`;
        tierBadgeEl.textContent = tierLabel;
      }
    }

    // Profil hero card (tab 4) — scope ke #screen-student agar tidak
    // mengambil .profile-* milik layar business/admin (bergantung urutan DOM).
    const profileNameEl   = document.querySelector('#screen-student .profile-name');
    const profileUniEl    = document.querySelector('#screen-student .profile-uni');
    const profileAvatarEl = document.querySelector('#screen-student .profile-avatar');
    if (profileNameEl)   profileNameEl.textContent   = name;
    if (profileUniEl)    profileUniEl.textContent    = subtitleText;
    if (profileAvatarEl) {
      if (user.avatar_url) {
        profileAvatarEl.style.padding = '0';
        profileAvatarEl.style.overflow = 'hidden';
        profileAvatarEl.innerHTML = `<img src="${escAttr(user.avatar_url)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      } else {
        profileAvatarEl.textContent = name.charAt(0).toUpperCase();
      }
    }

    // Skills di tab profil (id baru: st-profile-skills)
    const skillsContainer = document.getElementById('st-profile-skills') ||
                            document.querySelector('#st-tab-4 .skill-tag')?.parentElement;
    if (skillsContainer) {
      if (user.skills?.length) {
        skillsContainer.innerHTML = user.skills.map(s => `<span class="skill-tag">${esc(s)}</span>`).join('');
      } else {
        skillsContainer.innerHTML = `<span style="font-size:12px;color:var(--text-muted)">Belum ada skill — tambahkan via Edit Profil</span>`;
      }
    }

    // Stat cards — project selesai & rating
    const statCards = document.querySelectorAll('#st-tab-0 .stat-card');
    statCards.forEach(card => {
      const label = card.querySelector('.stat-card-label')?.textContent || '';
      const valEl = card.querySelector('.stat-card-value');
      if (!valEl) return;
      if (label.includes('Project Selesai')) valEl.textContent = user.total_projects || 0;
      if (label.includes('Rating'))          valEl.textContent = user.rating_avg ? parseFloat(user.rating_avg).toFixed(1) : '0.0';
      if (label.includes('Penghasilan'))     valEl.textContent = 'Memuat...';
    });

    // Project Aktif dari kontrak
    try {
      const contractRes = await ContractsAPI.getMyContracts();
      const contracts   = contractRes.data || [];
      const active      = contracts.filter(c =>
        c.status === 'active' || c.status === 'pending_review'
      ).length;
      statCards.forEach(card => {
        const label = card.querySelector('.stat-card-label')?.textContent || '';
        const valEl = card.querySelector('.stat-card-value');
        if (label.includes('Project Aktif') && valEl) valEl.textContent = active;
      });
    } catch (_) {}

    // Total Penghasilan dari payments
    // Hanya hitung: payment yang sudah `released` DI MANA mahasiswa ini
    // jadi payee. Pakai `net_amount` (jumlah setelah dipotong fee platform).
    //
    // BUG SEBELUMNYA:
    //   1. Fallback `|| p.amount` salah — `amount` adalah jumlah sebelum
    //      potongan fee, bukan yang diterima mahasiswa. Ini bikin pendapatan
    //      ter-overstate kalau net_amount null karena bug DB.
    //   2. Tidak filter `payee_id === myId` — kalau mahasiswa muncul di
    //      payment sebagai payer (mestinya tidak terjadi tapi defensive),
    //      tetap ke-hitung sebagai penghasilan.
    //   3. `catch (_) {}` swallow error diam-diam.
    try {
      const myId          = user?.id;
      const payRes        = await PaymentsAPI.getMyPayments();
      const payments      = payRes.data || [];
      const totalReleased = payments
        .filter(p => p.status === 'released' && p.payee_id === myId)
        .reduce((s, p) => s + (Number(p.net_amount) || 0), 0);

      statCards.forEach(card => {
        const label = card.querySelector('.stat-card-label')?.textContent || '';
        const valEl = card.querySelector('.stat-card-value');
        if (!valEl) return;
        if (label.includes('Penghasilan')) {
          // Smart format: <1jt pakai full, ≥1jt pakai short
          valEl.textContent = totalReleased >= 1_000_000
            ? `Rp ${(totalReleased / 1_000_000).toFixed(1)}jt`
            : `Rp ${totalReleased.toLocaleString('id-ID')}`;
          valEl.style.fontSize = '16px';
        }
      });
    } catch (payErr) {
      console.warn('[student KPI] gagal load penghasilan:', payErr?.message);
      statCards.forEach(card => {
        const label = card.querySelector('.stat-card-label')?.textContent || '';
        const valEl = card.querySelector('.stat-card-value');
        if (label.includes('Penghasilan') && valEl) valEl.textContent = 'Rp —';
      });
    }

    // Profile completion
    const fields = [
      user.full_name, user.email, user.university, user.major,
      user.semester, user.bio, user.portfolio_url,
      Array.isArray(user.skills) && user.skills.length > 0,
      user.avatar_url, user.is_verified,
    ];
    const filled = fields.filter(Boolean).length;
    const pct    = Math.round((filled / fields.length) * 100);

    const profileBanner = document.querySelector('.profile-banner');
    if (profileBanner) {
      if (pct >= 100) {
        // Sembunyikan banner kalau sudah 100%
        profileBanner.style.display = 'none';
      } else {
        profileBanner.style.display = '';
        animateProgressBar('profile-bar', pct, 600);
        const pctEl = document.querySelector('.profile-banner__pct');
        if (pctEl) pctEl.textContent = `${pct}%`;

        // Update hint sesuai field yang belum diisi
        const hints = [];
        if (!user.bio)          hints.push('bio');
        if (!user.avatar_url)   hints.push('foto profil');
        if (!user.skills?.length) hints.push('skills');
        if (!user.university)   hints.push('universitas');
        if (!user.is_verified)  hints.push('verifikasi KTM');
        const hintEl = document.querySelector('.profile-banner__hint');
        if (hintEl && hints.length) {
          hintEl.textContent = `💡 Lengkapi: ${hints.slice(0, 3).join(', ')} untuk meningkatkan peluang diterima`;
        }
      }
    }

  } catch (error) {
    console.error('[onEnterStudent] Gagal load user:', error);
    animateProgressBar('profile-bar', 0, 600);
  }

  await updateStudentVerificationUI();
  await loadProjectsFromAPI();
  await renderApplications();
  await renderActiveProjects();
  await loadStudentActivity();
  if (typeof refreshNotifBadge === 'function') refreshNotifBadge();
}

async function loadStudentActivity() {
  const el = document.getElementById('student-activity-list');
  if (!el) return;

  try {
    const [appsRes, notifsRes] = await Promise.allSettled([
      ApplicationsAPI.getMyApplications(),
      NotificationsAPI.getAll(),
    ]);

    const apps   = appsRes.status   === 'fulfilled' ? (appsRes.value.data   || []) : [];
    const notifs = notifsRes.status === 'fulfilled' ? (notifsRes.value.data || []) : [];

    const activities = [];

    apps.slice(0, 3).forEach(a => {
      const projectTitle = a.projects?.title || 'Project';
      const icon = a.status === 'approved'
        ? { bg: 'var(--teal-light)',  color: 'var(--teal-dark)', svg: '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' }
        : a.status === 'rejected'
          ? { bg: 'var(--rose-light)', color: 'var(--rose)',      svg: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' }
          : { bg: 'var(--accent-light)', color: 'var(--accent)', svg: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>' };

      const label = a.status === 'approved'
        ? `Lamaran diterima untuk "${projectTitle}" 🎉`
        : a.status === 'rejected'
          ? `Lamaran ditolak untuk "${projectTitle}"`
          : `Lamaran dikirim ke "${projectTitle}"`;

      activities.push({ icon, label, time: a.created_at });
    });

    notifs.slice(0, 3).forEach(n => {
      const icon = n.type === 'payment'
        ? { bg: 'var(--amber-light)', color: 'var(--amber-dark)', svg: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>' }
        : { bg: 'var(--accent-light)', color: 'var(--accent)',    svg: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>' };
      activities.push({ icon, label: n.message || n.title || '', time: n.created_at });
    });

    if (!activities.length) {
      el.innerHTML = `<div class="empty-state" style="padding:16px 0"><div class="empty-state-icon" style="font-size:24px">📭</div><div class="empty-state-title" style="font-size:14px">Belum ada aktivitas</div></div>`;
      return;
    }

    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    el.innerHTML = activities.slice(0, 5).map(act => `
      <div class="activity-item">
        <div class="activity-icon-wrap" style="background:${act.icon.bg};color:${act.icon.color}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">${act.icon.svg}</svg>
        </div>
        <div style="flex:1">
          <div class="activity-title">${act.label}</div>
          <div class="activity-time">${fmtRelative(act.time)}</div>
        </div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = `<div class="empty-state" style="padding:16px 0"><div class="empty-state-title" style="font-size:13px">Gagal memuat aktivitas</div></div>`;
  }
}

async function switchStudentTab(i) {
  document.querySelectorAll('#screen-student .sidebar-item').forEach(el =>
    el.classList.toggle('active', parseInt(el.dataset.tab) === i)
  );
  document.querySelectorAll('#student-bnav .bnav-item').forEach(el =>
    el.classList.toggle('active', parseInt(el.dataset.tab) === i)
  );
  document.querySelectorAll('[id^="st-tab-"]').forEach(el =>
    el.classList.toggle('active', el.id === `st-tab-${i}`)
  );
  document.getElementById('student-main')?.scrollTo(0, 0);

  if (i === 1) await loadProjectsFromAPI();
  if (i === 2) await renderApplications();
  if (i === 3) await renderActiveProjects();
  if (i === 4) await loadStudentProfile();
  if (i === 5) await renderStudentChatList();
}

/* ================================================================
   STUDENT CHAT LIST (tab 5) — mirror gaya bisnis, dgn filter:
   Semua / Project Aktif / Masih Nanya / Selesai
   ================================================================ */
let _stChatFilter = 'all';

function setStudentChatFilter(f, btn) {
  _stChatFilter = f;
  document.querySelectorAll('#st-chat-filter-chips .filter-chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  renderStudentChatList(document.getElementById('st-chat-search')?.value || '');
}

async function renderStudentChatList(query = '') {
  const container = document.getElementById('st-chat-list-container');
  if (!container) return;

  const wsEl = document.getElementById('st-ws-status');
  if (wsEl && typeof SocketManager !== 'undefined') {
    wsEl.innerHTML = SocketManager.isConnected()
      ? '<span style="color:var(--teal)">🔌 Terhubung</span>'
      : '<span style="color:var(--text-muted)">○ Offline</span>';
  }

  container.innerHTML = skeletons.applicationCards(3);
  const q = (query || '').toLowerCase();

  try {
    let contracts = [];
    try { contracts = (await ContractsAPI.getMyContracts()).data || []; } catch (_) {}

    let inquiries = [];
    try { inquiries = (await MessagesAPI.getInquiries()).data || []; } catch (_) {}

    const f = _stChatFilter;
    const matchC = (c) => {
      const biz = c.users_contracts_business_idTousers?.full_name || '';
      const title = c.projects?.title || '';
      return !q || biz.toLowerCase().includes(q) || title.toLowerCase().includes(q);
    };
    const matchI = (inq) => {
      const name = inq.other_user?.full_name || '';
      return !q || name.toLowerCase().includes(q) || (inq.last_message || '').toLowerCase().includes(q);
    };

    const activeC = contracts.filter(c => c.status === 'active' || c.status === 'pending_review').filter(matchC);
    const doneC   = contracts.filter(c => c.status === 'completed').filter(matchC);
    const inq     = (Array.isArray(inquiries) ? inquiries : []).filter(matchI);

    const showActive  = (f === 'all' || f === 'active')  ? activeC : [];
    const showInquiry = (f === 'all' || f === 'inquiry') ? inq     : [];
    const showDone    = (f === 'all' || f === 'done')    ? doneC   : [];

    if (!showActive.length && !showInquiry.length && !showDone.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-title">Belum ada percakapan</div><p class="empty-state-desc">Chat project & pertanyaan ke bisnis akan muncul di sini.</p></div>`;
      return;
    }

    const section = (label) => `<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;padding:12px 0 6px">${esc(label)}</div>`;
    const contractItem = (c, statusKey) => {
      const biz = c.users_contracts_business_idTousers || {};
      const name = biz.full_name || 'Bisnis';
      const title = c.projects?.title || 'Project';
      return `
        <div class="chat-list-item" onclick="openDirectChatWith('${escAttr(name)}','bisnis','${escAttr(title)}','${escAttr(biz.id || '')}')">
          <div class="chat-avatar">${esc(name.charAt(0))}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
              <span class="chat-name">${esc(name)}</span>${statusBadge(statusKey)}
            </div>
            <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📋 ${esc(title)}</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="16"><polyline points="9 18 15 12 9 6"/></svg>
        </div>`;
    };

    let html = '';
    if (showActive.length) {
      if (f === 'all') html += section('Project Aktif');
      html += showActive.map(c => contractItem(c, c.status === 'pending_review' ? 'pending_review' : 'active')).join('');
    }
    if (showInquiry.length) {
      if (f === 'all') html += section('Masih Nanya');
      html += showInquiry.map(it => {
        const name = it.other_user?.full_name || 'Bisnis';
        const otherId = it.other_user_id || it.other_user?.id || '';
        const last = it.last_message || 'Pertanyaan';
        return `
          <div class="chat-list-item" onclick="openDirectChatWith('${escAttr(name)}','bisnis','Pertanyaan','${escAttr(otherId)}')">
            <div class="chat-avatar" style="background:var(--amber-light);color:var(--amber-dark)">${esc(name.charAt(0))}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
                <span class="chat-name">${esc(name)}</span><span class="badge badge-amber" style="font-size:10px">Pertanyaan</span>
              </div>
              <div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(last)}</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="16"><polyline points="9 18 15 12 9 6"/></svg>
          </div>`;
      }).join('');
    }
    if (showDone.length) {
      if (f === 'all') html += section('Selesai');
      html += showDone.map(c => contractItem(c, 'completed')).join('');
    }
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat chat</div><p class="empty-state-desc">${esc(e.message)}</p></div>`;
  }
}

async function loadStudentProfile() {
  try {
    const res  = await UsersAPI.getMe();
    const user = res.data || {};
    TokenManager.setUser(user);

    const name = user.full_name || 'Pengguna';

    const nameEl   = document.querySelector('#screen-student .profile-name');
    const uniEl    = document.querySelector('#screen-student .profile-uni');
    const avatarEl = document.querySelector('#screen-student .profile-avatar');

    if (nameEl)   nameEl.textContent   = name;
    if (uniEl)    uniEl.textContent    = `${user.university || ''} · ${user.major || ''} · Semester ${user.semester || ''}`;
    if (avatarEl) {
      if (user.avatar_url) {
        avatarEl.style.padding = '0'; avatarEl.style.overflow = 'hidden';
        avatarEl.innerHTML = `<img src="${escAttr(user.avatar_url)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      } else {
        avatarEl.textContent = name.charAt(0).toUpperCase();
      }
    }

    // Skills
    const skillsEl = document.querySelector('#st-tab-4 .skill-tag')?.parentElement;
    if (skillsEl && user.skills?.length) {
      skillsEl.innerHTML = user.skills.map(s => `<span class="skill-tag">${esc(s)}</span>`).join('');
    }

    // Tier badge di profil
    const tier      = user.tier || 'pemula';
    const tierLabel = tier === 'mahir' ? '🔥 Mahir' : tier === 'menengah' ? '⚡ Menengah' : '🌱 Pemula';
    const tierClass = tier === 'mahir' ? 'badge-accent' : tier === 'menengah' ? 'badge-amber' : 'badge-teal';
    const profileTierBadge = document.querySelector('#st-tab-4 .badge-teal, #st-tab-4 .badge-amber, #st-tab-4 .badge-accent');
    if (profileTierBadge && (profileTierBadge.textContent.includes('Pemula') ||
        profileTierBadge.textContent.includes('Menengah') ||
        profileTierBadge.textContent.includes('Mahir'))) {
      profileTierBadge.className   = `badge ${tierClass}`;
      profileTierBadge.textContent = tierLabel;
    }

  } catch (error) {
    console.error('[loadStudentProfile] Gagal:', error);
  }

  await updateStudentVerificationUI();
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.onEnterStudent      = onEnterStudent;
window.switchStudentTab    = switchStudentTab;
window.loadStudentProfile  = loadStudentProfile;
window.loadStudentActivity = loadStudentActivity;
window.renderStudentChatList = renderStudentChatList;
window.setStudentChatFilter  = setStudentChatFilter;