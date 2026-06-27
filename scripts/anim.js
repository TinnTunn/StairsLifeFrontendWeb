/* ============================================================
 * StairsLife — anim.js
 * Landing scroll-reveal + count-up.
 * Pakai listener scroll (rAF-throttled, capture phase agar ikut
 * menangkap scroll dari kontainer dalam) + pass awal & tertunda —
 * lebih andal lintas environment dibanding IntersectionObserver
 * (yang bisa "skip" pada scroll instan / renderer headless).
 * Aman: feature-detect, hormati prefers-reduced-motion, hanya
 * menyentuh #screen-landing, dan SELALU menampilkan konten
 * (tidak pernah meninggalkan elemen tersembunyi permanen).
 * ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Count-up angka statistik (mis. "500+", "4.8★"): pertahankan
   * prefix/suffix non-digit + jumlah desimal. */
  function countUp(el, dur) {
    var raw = (el.getAttribute('data-count-raw') || el.textContent).trim();
    el.setAttribute('data-count-raw', raw);
    var m = raw.match(/^(\D*)([\d.,]+)(.*)$/);
    if (!m) return;
    var prefix = m[1], numStr = m[2].replace(/,/g, ''), suffix = m[3];
    var target = parseFloat(numStr);
    if (isNaN(target)) return;
    var decimals = (numStr.split('.')[1] || '').length;
    // Bintang (★) selalu emas, walau angka di-count-up. prefix/number aman
    // (numerik) untuk innerHTML; suffix hanya membungkus ★.
    var suffixHtml = suffix.replace(/★/g, '<span class="cu-star">★</span>');
    function paint(s) { el.innerHTML = prefix + s + suffixHtml; }
    if (reduce || dur === 0) { paint(target.toFixed(decimals)); return; }
    var start = null;
    function tick(now) {
      if (start === null) start = now;
      var p = Math.min((now - start) / (dur || 1200), 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      paint((target * eased).toFixed(decimals));
      if (p < 1) requestAnimationFrame(tick);
      else paint(target.toFixed(decimals));
    }
    paint((0).toFixed(decimals));
    requestAnimationFrame(tick);
  }

  function setup() {
    var landing = document.getElementById('screen-landing');
    if (!landing || landing.__slRevealed) return;
    landing.__slRevealed = true;
    // Tandai bahwa anim.js berhasil init → failsafe di index.html tidak perlu
    // memaksa reveal (lihat inline script <head> "sl-js").
    window.__slAnimReady = true;

    var targets = [];
    function add(el, stagger) {
      if (!el || targets.indexOf(el) !== -1) return;
      if (!el.classList.contains('sl-reveal')) el.classList.add('sl-reveal');
      if (stagger != null && !/sl-d[1-5]/.test(el.className)) el.classList.add('sl-d' + ((stagger % 5) + 1));
      targets.push(el);
    }
    function addGroup(container, sel) {
      if (!container) return;
      Array.prototype.forEach.call(container.querySelectorAll(sel), function (k, i) { add(k, i); });
    }

    // Intro tiap section + bento "Cara Kerja"/"Fitur" + stats + about + band.
    Array.prototype.forEach.call(landing.querySelectorAll('.eyebrow-block, .section-eyebrow'), function (el) { add(el); });
    Array.prototype.forEach.call(landing.querySelectorAll('.bento-grid'), function (g) { addGroup(g, '.b'); });
    addGroup(landing.querySelector('.stats-banner'), '.stat-item');
    addGroup(landing.querySelector('#about-us .grid-2'), '.card');
    Array.prototype.forEach.call(landing.querySelectorAll('.cta-banner, .footer, footer'), function (el) { add(el); });

    function fireCount(el) {
      Array.prototype.forEach.call(el.querySelectorAll ? el.querySelectorAll('.stat-val') : [], function (n) {
        if (!n.__counted) { n.__counted = true; countUp(n); }
      });
    }

    // Reduced-motion / tanpa rAF → tampilkan semua langsung (no-op aman).
    if (reduce) {
      targets.forEach(function (el) { el.classList.add('sl-in'); fireCount(el); });
      return;
    }

    function revealInView() {
      var vh = window.innerHeight || document.documentElement.clientHeight || 800;
      for (var i = targets.length - 1; i >= 0; i--) {
        var el = targets[i];
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) {
          el.classList.add('sl-in');
          fireCount(el);
          targets.splice(i, 1);
        }
      }
      if (!targets.length) teardown();
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; revealInView(); });
    }
    function teardown() {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    }

    // Capture phase → ikut menangkap scroll dari kontainer dalam (app-shell/screen).
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    revealInView();                 // pass awal (above-the-fold)
    setTimeout(revealInView, 450);  // pass tertunda (setelah font/layout settle)

    // Re-reveal saat landing KEMBALI aktif (mis. user balik dari dashboard via
    // klik logo). Tanpa ini, section yang belum sempat di-scroll bisa ter-stuck
    // tersembunyi (opacity:0) karena pass awal sudah jalan saat landing hidden.
    if ('MutationObserver' in window) {
      new MutationObserver(function () {
        if (landing.classList.contains('active') && targets.length) revealInView();
      }).observe(landing, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
