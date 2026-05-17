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

    // Subtitle
    document.querySelectorAll('.dash-subtitle').forEach(el => {
      el.textContent = subtitleText;
    });

    // Badge tier di beranda
    const tierBadgeHome = document.getElementById('st-verify-badge-home');
    if (tierBadgeHome) {
      const tierBadgeEl = tierBadgeHome.nextElementSibling;
      if (tierBadgeEl) {
        tierBadgeEl.className   = `badge ${tierClass}`;
        tierBadgeEl.textContent = tierLabel;
      }
    }

    // Profil hero card (tab 4)
    const profileNameEl   = document.querySelector('.profile-name');
    const profileUniEl    = document.querySelector('.profile-uni');
    const profileAvatarEl = document.querySelector('.profile-avatar');
    if (profileNameEl)   profileNameEl.textContent   = name;
    if (profileUniEl)    profileUniEl.textContent    = subtitleText;
    if (profileAvatarEl) profileAvatarEl.textContent = name.charAt(0).toUpperCase();

    // Skills di tab profil
    if (user.skills?.length) {
      const skillsContainer = document.querySelector('#st-tab-4 .skill-tag')?.parentElement;
      if (skillsContainer) {
        skillsContainer.innerHTML = user.skills.map(s => `<span class="skill-tag">${s}</span>`).join('');
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
    try {
      const payRes        = await PaymentsAPI.getMyPayments();
      const payments      = payRes.data || [];
      const totalReleased = payments
        .filter(p => p.status === 'released')
        .reduce((s, p) => s + (p.net_amount || p.amount || 0), 0);

      statCards.forEach(card => {
        const label = card.querySelector('.stat-card-label')?.textContent || '';
        const valEl = card.querySelector('.stat-card-value');
        if (!valEl) return;
        if (label.includes('Penghasilan')) {
          valEl.textContent = `Rp ${totalReleased.toLocaleString('id-ID')}`;
          valEl.style.fontSize = '16px';
        }
      });
    } catch (_) {}

    // Profile completion
    const fields = [
      user.full_name, user.email, user.university, user.major,
      user.semester, user.bio, user.portfolio_url,
      Array.isArray(user.skills) && user.skills.length > 0,
      user.avatar_url, user.is_verified,
    ];
    const filled = fields.filter(Boolean).length;
    const pct    = Math.round((filled / fields.length) * 100);
    animateProgressBar('profile-bar', pct, 600);

    const pctEl = document.querySelector('.profile-banner__pct');
    if (pctEl) pctEl.textContent = `${pct}%`;

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
}

async function loadStudentProfile() {
  try {
    const res  = await UsersAPI.getMe();
    const user = res.data || {};
    TokenManager.setUser(user);

    const name = user.full_name || 'Pengguna';

    const nameEl   = document.querySelector('.profile-name');
    const uniEl    = document.querySelector('.profile-uni');
    const avatarEl = document.querySelector('.profile-avatar');

    if (nameEl)   nameEl.textContent   = name;
    if (uniEl)    uniEl.textContent    = `${user.university || ''} · ${user.major || ''} · Semester ${user.semester || ''}`;
    if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();

    // Skills
    const skillsEl = document.querySelector('#st-tab-4 .skill-tag')?.parentElement;
    if (skillsEl && user.skills?.length) {
      skillsEl.innerHTML = user.skills.map(s => `<span class="skill-tag">${s}</span>`).join('');
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