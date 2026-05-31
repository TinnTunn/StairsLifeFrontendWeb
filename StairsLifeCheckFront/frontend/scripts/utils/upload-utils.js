'use strict';

/**
 * Resolve URL gambar dari Supabase.
 * - Public bucket (avatars, deliverables) → langsung pakai URL
 * - Private bucket (ktm, selfie) → minta signed URL ke backend
 */
async function resolveImageUrl(urlOrPath) {
  if (!urlOrPath) return null;

  // Sudah full URL (public bucket) → langsung pakai
  if (urlOrPath.startsWith('http')) return urlOrPath;

  // Path private (ktm/ atau selfie/) → minta signed URL
  try {
    const res = await apiFetch(
      `/upload/signed-url?path=${encodeURIComponent(urlOrPath)}`
    );
    return res?.data?.url || null;
  } catch {
    return null;
  }
}

/**
 * Render gambar dengan auto-resolve signed URL.
 * Tampilkan loading dulu, lalu ganti dengan gambar asli.
 */
async function renderSecureImage(imgElement, urlOrPath) {
  if (!imgElement) return;

  imgElement.src = ''; // kosongkan dulu
  imgElement.style.opacity = '0.5';

  const url = await resolveImageUrl(urlOrPath);
  if (url) {
    imgElement.src = url;
    imgElement.style.opacity = '1';
  } else {
    imgElement.alt = 'Gambar tidak tersedia';
    imgElement.style.opacity = '1';
  }
}

window.resolveImageUrl  = resolveImageUrl;
window.renderSecureImage = renderSecureImage;