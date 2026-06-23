/**
 * StairsLife — features/profile/public-profile.js
 *
 * Render public profile (lihat profil pihak lain) dengan rating distribution
 * dan list review terbaru. Dipakai untuk:
 *  - Mahasiswa lihat profil bisnis (dari project detail / chat)
 *  - Bisnis lihat profil mahasiswa (dari lamaran / kontrak)
 *
 * Depends on: UsersAPI, esc, escAttr, goTo, goBack, showToast
 */
'use strict';

/**
 * Open public profile screen. Set context lalu navigate.
 */
function openPublicProfile(userId, fallbackName) {
  if (!userId) {
    showToast('Profil tidak ditemukan', 'error');
    return;
  }
  window._publicProfileId   = userId;
  window._publicProfileName = fallbackName || '';
  goTo('screen-public-profile');
}

/**
 * Load + render public profile data. Dipanggil dari _routeHooks di app.js
 * setelah navigate ke screen-public-profile.
 */
async function loadPublicProfile(userId) {
  const container = document.getElementById('public-profile-content');
  if (!container) return;
  if (!userId) {
    container.innerHTML = _emptyProfileHTML('User ID tidak diberikan');
    return;
  }

  container.innerHTML = `
    <div style="text-align:center;padding:32px 16px;color:var(--text-muted)">
      <div style="font-size:32px;margin-bottom:8px">⏳</div>
      Memuat profil...
    </div>`;

  try {
    // Fetch profile + portfolio PARALEL untuk loading lebih cepat.
    // Portfolio dibuat opsional (kalau gagal, profile tetap render normal).
    const [profileRes, portfolioRes] = await Promise.all([
      UsersAPI.getPublicProfile(userId),
      UsersAPI.getPortfolio(userId).catch(err => {
        console.warn('[publicProfile] portfolio gagal load:', err?.message);
        return null;
      }),
    ]);

    const data = profileRes.data || {};
    const user = data.user || {};
    const reviews = data.reviews || [];
    const reviewCount = data.review_count ?? 0;
    const distribution = data.rating_distribution || {};
    const portfolio = portfolioRes?.data || null;

    container.innerHTML = _buildProfileHTML(user, reviews, reviewCount, distribution, portfolio);
  } catch (e) {
    container.innerHTML = _emptyProfileHTML(e.message || 'Gagal memuat profil');
  }
}

function _emptyProfileHTML(message) {
  return `
    <div class="empty-state" style="padding:40px 20px">
      <div class="empty-state-icon">😕</div>
      <div class="empty-state-title">Profil tidak tersedia</div>
      <p class="empty-state-desc">${esc(message)}</p>
    </div>`;
}

function _buildProfileHTML(user, reviews, reviewCount, distribution, portfolio) {
  const fullName = user.full_name || 'Pengguna';
  const initials = fullName.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const role = user.role === 'mahasiswa' ? '🎓 Mahasiswa' : (user.role === 'bisnis' ? '🏢 Bisnis' : '');
  const isStudent = user.role === 'mahasiswa';
  const isBusiness = user.role === 'bisnis';

  const rating = user.rating_avg ? parseFloat(user.rating_avg) : 0;
  const ratingStars = '⭐'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  const tierLabel = user.tier === 'mahir' ? '🔥 Mahir' : (user.tier === 'menengah' ? '⚡ Menengah' : '🌱 Pemula');
  const tierCls = user.tier === 'mahir' ? 'badge-accent' : (user.tier === 'menengah' ? 'badge-amber' : 'badge-teal');
  // Badge "Terverifikasi" hanya untuk mahasiswa (verifikasi KTM).
  // Bisnis tidak perlu badge ini — verifikasi mereka lewat escrow payment.
  const verifiedBadge = (user.role === 'mahasiswa' && user.is_verified)
    ? '<span class="badge badge-teal" style="font-size:11px">✓ Terverifikasi</span>'
    : '';

  // Header
  const header = `
    <div class="pub-profile-header" style="padding:28px 16px;text-align:center;border-radius:var(--radius-lg);margin-bottom:16px">
      <div style="width:88px;height:88px;border-radius:50%;background:rgba(255,255,255,0.18);
                  display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;
                  color:#fff;margin:0 auto 12px;border:3px solid rgba(255,255,255,0.35);overflow:hidden;
                  box-shadow:0 4px 20px rgba(0,0,0,0.2)">${avatarHtml(user)}</div>
      <h2 style="font-size:22px;font-weight:800;margin-bottom:4px;color:#fff">${esc(fullName)}</h2>
      <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:8px">
        ${role ? `<span class="badge" style="font-size:11px;background:rgba(255,255,255,0.18);color:#fff;border:1px solid rgba(255,255,255,0.3)">${role}</span>` : ''}
        ${isStudent ? `<span class="badge" style="font-size:11px;background:rgba(255,255,255,0.18);color:#fff;border:1px solid rgba(255,255,255,0.3)">${tierLabel}</span>` : ''}
        ${(user.role === 'mahasiswa' && user.is_verified) ? '<span class="badge" style="font-size:11px;background:rgba(31,185,125,0.35);color:#a7f3d0;border:1px solid rgba(31,185,125,0.4)">✓ Terverifikasi</span>' : ''}
      </div>
      <div style="font-size:14px;color:rgba(255,255,255,0.8)">
        <span style="font-weight:700;color:var(--spark)">${ratingStars}</span>
        <span style="margin-left:6px">${rating.toFixed(1)} · ${reviewCount} review</span>
      </div>
    </div>`;

  // Info section
  const infoRows = [];
  if (isStudent) {
    if (user.university) infoRows.push(['Universitas', user.university]);
    if (user.major)      infoRows.push(['Jurusan', user.major]);
    if (user.semester)   infoRows.push(['Semester', user.semester]);
  }
  if (isBusiness) {
    if (user.company_name)  infoRows.push(['Perusahaan', user.company_name]);
    if (user.business_type) infoRows.push(['Jenis Bisnis', user.business_type]);
  }
  if (user.location) infoRows.push(['Lokasi', user.location]);
  infoRows.push(['Total Project Selesai', `${user.total_projects || 0} project`]);

  const infoHTML = infoRows.length ? `
    <div class="card card-p-md" style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--text-muted);
                  text-transform:uppercase;letter-spacing:.05em">Informasi</div>
      ${infoRows.map(([k, v]) => `
        <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid var(--divider)">
          <span style="color:var(--text-secondary)">${esc(k)}</span>
          <span style="font-weight:600;text-align:right">${esc(String(v))}</span>
        </div>
      `).join('')}
    </div>` : '';

  // Bio
  const bioHTML = user.bio ? `
    <div class="card card-p-md" style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--text-muted);
                  text-transform:uppercase;letter-spacing:.05em">Tentang</div>
      <p style="font-size:14px;line-height:1.6;color:var(--text-primary);white-space:pre-wrap;margin:0">${esc(user.bio)}</p>
    </div>` : '';

  // Skills (student)
  const skillsHTML = (user.skills && user.skills.length) ? `
    <div class="card card-p-md" style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--text-muted);
                  text-transform:uppercase;letter-spacing:.05em">Skill</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${user.skills.map(s => `<span class="skill-tag">${esc(s)}</span>`).join('')}
      </div>
    </div>` : '';

  // Portfolio link manual (kalau user isi di profile)
  const portfolioLinkHTML = user.portfolio_url ? `
    <div class="card card-p-md" style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--text-muted);
                  text-transform:uppercase;letter-spacing:.05em">Portfolio Link</div>
      <a href="${escAttr(user.portfolio_url)}" target="_blank" rel="noopener noreferrer"
         style="color:var(--accent);font-weight:600;font-size:14px;word-break:break-all">
        🔗 ${esc(user.portfolio_url)}
      </a>
    </div>` : '';

  // ── PORTFOLIO AUTO (Riwayat Karya) ──
  // Section ini auto-aggregate dari completed contracts. Hanya tampil
  // untuk mahasiswa dan kalau ada minimal 1 karya. Tidak butuh upload —
  // data terisi otomatis tiap kali contract completed.
  const autoPortfolioHTML = (isStudent && portfolio && portfolio.items?.length > 0)
    ? _buildAutoPortfolioHTML(portfolio)
    : '';

  // Rating distribution
  const totalReviews = Object.values(distribution).reduce((s, n) => s + Number(n || 0), 0);
  const distBars = [5, 4, 3, 2, 1].map(star => {
    const count = Number(distribution[star] || 0);
    const pct = totalReviews ? Math.round((count / totalReviews) * 100) : 0;
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="min-width:40px;font-size:12px;color:var(--text-secondary)">${star} ⭐</span>
        <div style="flex:1;height:8px;background:var(--bg-secondary);border-radius:4px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:var(--amber);border-radius:4px"></div>
        </div>
        <span style="min-width:32px;font-size:12px;color:var(--text-muted);text-align:right">${count}</span>
      </div>`;
  }).join('');

  const distributionHTML = totalReviews > 0 ? `
    <div class="card card-p-md" style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text-muted);
                  text-transform:uppercase;letter-spacing:.05em">Distribusi Rating</div>
      ${distBars}
    </div>` : '';

  // Reviews
  const reviewsHTML = reviews.length ? `
    <div style="margin-top:8px">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text-muted);
                  text-transform:uppercase;letter-spacing:.05em">Review Terbaru (${reviewCount})</div>
      ${reviews.map(r => _buildReviewCard(r)).join('')}
    </div>` : (totalReviews === 0 ? `
    <div class="empty-state" style="padding:24px 16px">
      <div class="empty-state-icon">⭐</div>
      <div class="empty-state-title">Belum ada review</div>
      <p class="empty-state-desc">Review akan muncul di sini setelah ${isStudent ? 'mahasiswa' : 'pengguna ini'} menyelesaikan kontrak.</p>
    </div>` : '');

  return header + infoHTML + bioHTML + skillsHTML + portfolioLinkHTML + autoPortfolioHTML + distributionHTML + reviewsHTML;
}

/**
 * Build "Riwayat Karya" section dari auto-portfolio data.
 * Menampilkan summary card (total karya, kategori, rating rata-rata) +
 * grid card per karya dengan info project, klien, rating yang diterima.
 */
function _buildAutoPortfolioHTML(portfolio) {
  const items   = portfolio.items || [];
  const summary = portfolio.summary || {};

  // Summary cards di atas: tampilkan stats yang menarik
  const summaryCards = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      <div style="text-align:center;background:var(--bg-secondary);padding:10px 6px;border-radius:10px">
        <div style="font-size:20px;font-weight:800;color:var(--accent)">${summary.total_completed || 0}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.05em">Karya</div>
      </div>
      <div style="text-align:center;background:var(--bg-secondary);padding:10px 6px;border-radius:10px">
        <div style="font-size:20px;font-weight:800;color:var(--teal-dark)">${summary.unique_categories || 0}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.05em">Kategori</div>
      </div>
      <div style="text-align:center;background:var(--bg-secondary);padding:10px 6px;border-radius:10px">
        <div style="font-size:20px;font-weight:800;color:var(--amber-dark, #c97400)">
          ${summary.average_rating != null ? summary.average_rating.toFixed(1) + ' ⭐' : '—'}
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.05em">Rating</div>
      </div>
    </div>`;

  // Build item cards
  const itemCards = items.map((item, idx) => {
    const proj      = item.project || {};
    const client    = item.client || {};
    const review    = item.review;
    const skills    = Array.isArray(proj.skills) ? proj.skills.slice(0, 3) : [];
    const skillsHtml = skills.length ? skills.map(s => `<span class="skill-tag" style="font-size:10px;padding:2px 8px">${esc(s)}</span>`).join('') : '';

    const completedDate = item.completed_at
      ? new Date(item.completed_at).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
      : '';

    const ratingBadge = review?.rating
      ? `<span style="font-size:11px;color:var(--amber-dark, #c97400);font-weight:700;white-space:nowrap">
           ${'⭐'.repeat(review.rating)} ${review.rating}/5
         </span>`
      : '';

    const reviewQuote = review?.comment
      ? `<div style="margin-top:8px;padding:8px 10px;background:var(--bg-secondary);border-radius:8px;
                     font-size:12px;color:var(--text-secondary);font-style:italic;line-height:1.5">
           “${esc(review.comment.length > 120 ? review.comment.substring(0, 117) + '...' : review.comment)}”
         </div>`
      : '';

    return `
      <div style="padding:12px;background:var(--bg-card, #fff);border:1px solid var(--border);
                  border-radius:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="font-size:13.5px;font-weight:700;line-height:1.3;margin-bottom:2px">
              ${esc(proj.title || 'Project')}
            </div>
            <div style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span>${esc(proj.category || 'Lainnya')}</span>
              <span>·</span>
              <span>untuk ${esc(client.full_name || 'Klien')}</span>
              ${completedDate ? `<span>·</span><span>${esc(completedDate)}</span>` : ''}
            </div>
          </div>
          ${ratingBadge}
        </div>
        ${skillsHtml ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${skillsHtml}</div>` : ''}
        ${reviewQuote}
      </div>`;
  }).join('');

  return `
    <div class="card card-p-md" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:var(--text-muted);
                    text-transform:uppercase;letter-spacing:.05em">
          📂 Riwayat Karya
        </div>
        <span style="font-size:10.5px;color:var(--teal-dark);background:var(--teal-light);
                     padding:2px 8px;border-radius:8px;font-weight:600">
          ✓ Terverifikasi
        </span>
      </div>
      ${summaryCards}
      ${itemCards}
    </div>`;
}

function _buildReviewCard(r) {
  const reviewer = r.users_reviews_reviewer_idTousers || {};
  const reviewerName = reviewer.full_name || 'Anonim';
  const reviewerInitials = reviewerName.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const reviewerRole = reviewer.role === 'mahasiswa' ? '🎓' : (reviewer.role === 'bisnis' ? '🏢' : '');
  const rating = Number(r.rating) || 0;
  const stars = '⭐'.repeat(rating);
  const comment = r.comment || '';
  const tags = Array.isArray(r.tags) ? r.tags : [];
  const projectTitle = r.contracts?.projects?.title || 'Project';
  const date = r.created_at
    ? new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return `
    <div class="card card-p-md" style="margin-bottom:10px">
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:8px">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--accent-light);
                    display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;
                    color:var(--accent);flex-shrink:0">${esc(reviewerInitials)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span style="font-size:14px;font-weight:700">${esc(reviewerName)} ${reviewerRole}</span>
            <span style="font-size:11px;color:var(--text-muted);white-space:nowrap">${esc(date)}</span>
          </div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:1px">📋 ${esc(projectTitle)}</div>
        </div>
      </div>
      <div style="font-size:14px;color:var(--amber-dark);margin-bottom:6px">${stars}</div>
      ${comment ? `<p style="font-size:13px;line-height:1.5;color:var(--text-primary);margin:0 0 6px 0;white-space:pre-wrap">${esc(comment)}</p>` : ''}
      ${tags.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">
        ${tags.map(t => `<span class="badge badge-gray" style="font-size:10px">${esc(t)}</span>`).join('')}
      </div>` : ''}
    </div>`;
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.openPublicProfile  = openPublicProfile;
window.loadPublicProfile  = loadPublicProfile;
