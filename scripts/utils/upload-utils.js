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
 * Siapkan file gambar untuk upload.
 * - Foto iPhone (HEIC/HEIF) atau format non-standar → konversi ke JPEG via
 *   canvas (didukung Safari/iOS yang bisa men-decode HEIC). Sekaligus downscale
 *   kalau dimensinya sangat besar (hemat ukuran + pasti tampil di semua browser).
 * - JPEG/PNG/WEBP → dibiarkan apa adanya. PDF → dibiarkan (untuk KTM).
 * - Kalau browser tidak bisa men-decode (mis. HEIC di Chrome desktop) → throw.
 */
async function prepareImageUpload(file, { maxDim = 2000, quality = 0.9 } = {}) {
  const standard = ['image/jpeg', 'image/png', 'image/webp'];
  if (file.type && standard.includes(file.type)) return file;
  if (file.type === 'application/pdf') return file;

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();                       // gagal kalau format tak bisa di-decode browser
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error('Dimensi gambar tidak terbaca');

    const scale = Math.min(1, maxDim / Math.max(w, h));
    w = Math.round(w * scale);
    h = Math.round(h * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) throw new Error('Konversi gambar gagal');

    const baseName = (file.name || 'foto').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

window.resolveImageUrl   = resolveImageUrl;
window.prepareImageUpload = prepareImageUpload;