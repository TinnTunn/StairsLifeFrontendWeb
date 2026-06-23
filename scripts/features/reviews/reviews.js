/**
 * StairsLife — features/reviews/reviews.js
 * setRating, toggleReviewTag, submitReview, openReviewScreen.
 *
 * Depends on: ReviewsAPI, showToast, goBack, goTo, AuthAPI, TokenManager.
 */
'use strict';

let currentRating = 0;

function setRating(val) {
  currentRating = val;

  // Anim: bintang yang terpilih full-color + scale up sebentar
  document.querySelectorAll('.star-btn').forEach(s => {
    const v = parseInt(s.dataset.val);
    const isActive = v <= val;
    s.classList.toggle('active', isActive);
    // Visual feedback via inline style (in-line karena beberapa CSS lib
    // tidak punya class .active untuk star)
    s.style.filter    = isActive ? 'grayscale(0) opacity(1)'  : 'grayscale(1) opacity(0.35)';
    s.style.transform = isActive ? 'scale(1.05)' : 'scale(1)';
  });

  // Pulse animation di bintang terpilih
  const picked = document.querySelector(`.star-btn[data-val="${val}"]`);
  if (picked) {
    picked.style.transform = 'scale(1.25)';
    setTimeout(() => { picked.style.transform = 'scale(1.05)'; }, 180);
  }

  const labels = [
    '',
    '😞 Buruk — pengalaman tidak memuaskan',
    '😐 Kurang — masih banyak yang harus diperbaiki',
    '😊 Cukup — sesuai ekspektasi',
    '😄 Bagus — pengalaman menyenangkan',
    '🤩 Luar Biasa — sangat direkomendasikan!',
  ];
  const lbl = document.getElementById('rating-label');
  if (lbl) {
    lbl.style.opacity = '0';
    setTimeout(() => {
      lbl.textContent = labels[val] || '';
      lbl.style.opacity = '1';
    }, 100);
  }
}

function toggleReviewTag(btn) { btn.classList.toggle('active'); }

let _submitReviewInFlight = false;
async function submitReview() {
  if (_submitReviewInFlight) return;
  if (!currentRating) {
    showToast('Pilih rating bintang dulu ⭐', 'error');
    // Highlight star section
    const starWrap = document.getElementById('star-rating');
    if (starWrap) {
      starWrap.style.animation = 'shake 0.4s ease';
      setTimeout(() => { starWrap.style.animation = ''; }, 500);
    }
    return;
  }

  const tags       = Array.from(document.querySelectorAll('#review-tags .filter-chip.active'))
    .map(c => c.textContent.trim());
  const comment    = document.getElementById('review-comment')?.value.trim() || '';
  const contractId = window._reviewContext?.contractId || null;
  const projectId  = window._reviewContext?.projectId  || null;

  const btn = document.getElementById('review-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Mengirim...';
  }
  _submitReviewInFlight = true;

  try {
    // L9 FIX: cek apakah review dari CURRENT USER sudah ada untuk kontrak ini.
    if (contractId) {
      try {
        const existing  = await ReviewsAPI.getForContract(contractId);
        const myId      = (typeof AuthAPI !== 'undefined') ? AuthAPI.getCurrentUser()?.id : null;
        const reviews   = Array.isArray(existing?.data) ? existing.data : [];
        const fromMe    = myId ? reviews.find(r => r.reviewer_id === myId) : null;
        if (fromMe) {
          showToast('Kamu sudah memberikan review untuk kontrak ini', 'info');
          if (btn) { btn.disabled = false; btn.innerHTML = 'Kirim Ulasan ⭐'; }
          return;
        }
      } catch (_) { /* belum ada review = normal, lanjut */ }
    }

    await ReviewsAPI.submit({
      contract_id: contractId,
      project_id:  projectId,
      rating:  currentRating,
      comment,
      tags,
    });
    showToast('Ulasan terkirim! Terima kasih 🙏', 'success');
    resetReviewState();
    setTimeout(() => goBack(), 800);
  } catch (error) {
    showToast(error.message || 'Gagal mengirim ulasan', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = 'Kirim Ulasan ⭐'; }
  } finally {
    _submitReviewInFlight = false;
  }
}

/**
 * Reset state review (rating, tags, comment) — dipanggil saat submit sukses
 * dan saat openReviewScreen() agar layar baru tidak menampilkan state lama.
 */
function resetReviewState() {
  currentRating = 0;
  window._reviewContext = null;

  // Reset bintang
  document.querySelectorAll('.star-btn').forEach(s => {
    s.classList.remove('active');
    s.style.filter = 'grayscale(1) opacity(0.35)';
    s.style.transform = 'scale(1)';
  });

  // Reset label
  const lbl = document.getElementById('rating-label');
  if (lbl) {
    lbl.textContent = 'Tap bintang untuk memberi rating';
    lbl.style.opacity = '1';
  }

  // Reset tags
  document.querySelectorAll('#review-tags .filter-chip.active').forEach(c => c.classList.remove('active'));

  // Reset comment
  const commentEl = document.getElementById('review-comment');
  if (commentEl) commentEl.value = '';
  const charCountEl = document.getElementById('review-char-count');
  if (charCountEl) charCountEl.textContent = '0';
}

/**
 * Open the review screen with context.
 *
 * Context expects:
 *   - contractId   (required) — untuk validasi single-review per user
 *   - projectId    (optional) — untuk metadata
 *   - targetName   (optional) — nama orang yang di-review (untuk hero)
 *   - projectName  (optional) — nama project (untuk hero)
 *   - targetInitial (optional) — huruf untuk avatar
 *
 * Example:
 *   openReviewScreen({
 *     contractId: 'abc-123',
 *     projectId:  'proj-456',
 *     targetName: 'Toko Kue Artisan',
 *     projectName: 'Desain Feed Instagram',
 *   })
 */
function openReviewScreen(context = {}) {
  resetReviewState();
  window._reviewContext = context;

  // Populate hero dengan info dynamic — supaya tidak hardcoded "Toko Kue Artisan"
  const avatarEl  = document.getElementById('review-target-avatar');
  const nameEl    = document.getElementById('review-target-name');
  const projectEl = document.getElementById('review-project-name');

  const targetName  = context.targetName  || 'Klien';
  const projectName = context.projectName || 'Project';
  const initial     = context.targetInitial || targetName.charAt(0).toUpperCase();

  if (avatarEl)  avatarEl.textContent  = initial;
  if (nameEl)    nameEl.textContent    = targetName;
  if (projectEl) projectEl.textContent = `Project: ${projectName}`;

  goTo('screen-review-submit');
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.setRating         = setRating;
window.toggleReviewTag   = toggleReviewTag;
window.submitReview      = submitReview;
window.openReviewScreen  = openReviewScreen;
window.resetReviewState  = resetReviewState;
