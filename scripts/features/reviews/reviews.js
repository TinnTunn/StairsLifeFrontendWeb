/**
 * StairsLife — features/reviews/reviews.js
 * setRating, toggleReviewTag, submitReview, openReviewScreen.
 * Depends on: ReviewsAPI, showToast, goBack, goTo.
 * Phase 3 — Modularisasi.
 */
'use strict';

let currentRating = 0;

function setRating(val) {
  currentRating = val;
  document.querySelectorAll('.star-btn').forEach(s => {
    const v = parseInt(s.dataset.val);
    s.classList.toggle('active', v <= val);
  });
  const labels = ['', 'Buruk 😞', 'Kurang 😐', 'Cukup 😊', 'Bagus 😄', 'Luar Biasa 🤩'];
  const lbl = document.getElementById('rating-label');
  if (lbl) lbl.textContent = labels[val] || '';
}

function toggleReviewTag(btn) { btn.classList.toggle('active'); }

async function submitReview() {
  if (!currentRating) { showToast('Pilih rating bintang dulu ⭐', 'error'); return; }

  const tags       = Array.from(document.querySelectorAll('#review-tags .filter-chip.active'))
    .map(c => c.textContent.trim());
  const comment    = document.getElementById('review-comment')?.value.trim() || '';
  const contractId = window._reviewContext?.contractId || null;
  const projectId  = window._reviewContext?.projectId  || null;

  const btn = document.getElementById('review-submit-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  try {
    // L9 FIX: cek apakah review dari CURRENT USER sudah ada untuk kontrak ini.
    // Sebelumnya cek `existing?.data` saja, tapi backend return `{ data: [] }`
    // untuk kontrak tanpa review — array kosong tetap truthy → user tidak pernah
    // bisa submit review pertamanya. Sekarang kita cari review yang reviewer-nya
    // adalah current user.
    if (contractId) {
      try {
        const existing  = await ReviewsAPI.getForContract(contractId);
        const myId      = (typeof AuthAPI !== 'undefined') ? AuthAPI.getCurrentUser()?.id : null;
        const reviews   = Array.isArray(existing?.data) ? existing.data : [];
        const fromMe    = myId ? reviews.find(r => r.reviewer_id === myId) : null;
        if (fromMe) {
          showToast('Kamu sudah memberikan review untuk kontrak ini', 'info');
          if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
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
    currentRating = 0;
    window._reviewContext = null;
    setTimeout(() => goBack(), 800);
  } catch (error) {
    showToast(error.message || 'Gagal mengirim ulasan', 'error');
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

/**
 * Open the review screen with context.
 * Example: openReviewScreen({ contractId: 'abc-123', projectName: 'Desain Logo' })
 */
function openReviewScreen(context = {}) {
  window._reviewContext = context;
  goTo('screen-review-submit');
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.setRating      = setRating;
window.toggleReviewTag = toggleReviewTag;
window.submitReview   = submitReview;
window.openReviewScreen = openReviewScreen;
