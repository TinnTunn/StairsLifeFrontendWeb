/* ============================================================
 * StairsLife — features/landing/landing.js
 * Komponen interaktif Landing: segmented switcher "Mahasiswa / UMKM"
 * yang menukar value-prop + CTA dengan animasi halus.
 * Aman: no-op kalau elemen #aud-panel tidak ada di DOM.
 * ============================================================ */
'use strict';
(function () {
  var ICONS = {
    shield:    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    bolt:      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>',
    search:    '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    lock:      '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>',
    fileText:  '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'
  };

  var AUD = {
    student: {
      items: [
        ['shield',    'violet',     'Verifikasi sekali, dipercaya terus', 'KTM atau email kampus bikin lamaranmu lebih dilirik klien.'],
        ['bolt',      'gold',       'Micro-task yang fleksibel',          'Pilih project yang pas dengan jadwal kuliahmu.'],
        ['briefcase', 'periwinkle', 'Portofolio otomatis',                'Tiap project selesai langsung jadi karya ber-badge verified.']
      ],
      cta: '🎓 Mulai sebagai Mahasiswa'
    },
    business: {
      items: [
        ['search',   'sky',  'Talent terverifikasi',     'Pilih mahasiswa sesuai skill, tier, dan budget kamu.'],
        ['lock',     'mint', 'Bayar aman lewat Escrow',  'Dana ditahan sampai hasil kerja kamu setujui.'],
        ['fileText', 'rose', 'Scope terkunci kontrak',   'Anti scope-creep — deliverable & deadline jelas sejak awal.']
      ],
      cta: '🏢 Pasang Project Bisnis'
    }
  };

  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  }

  function renderAudience(which) {
    var panel = document.getElementById('aud-panel');
    if (!panel) return;
    var data = AUD[which] || AUD.student;
    var cards = data.items.map(function (it) {
      return '<div class="aud-card">' +
               '<div class="feat-ico feat-ico--' + it[1] + '">' + svg(it[0]) + '</div>' +
               '<div class="aud-card-title">' + it[2] + '</div>' +
               '<div class="aud-card-desc">' + it[3] + '</div>' +
             '</div>';
    }).join('');
    panel.innerHTML =
      '<div class="aud-cards">' + cards + '</div>' +
      '<button class="btn btn-primary btn-lg aud-cta" onclick="goTo(\'screen-onboarding\')">' + data.cta + '</button>';
    // retrigger fade transition
    panel.classList.remove('aud-fade');
    void panel.offsetWidth;
    panel.classList.add('aud-fade');
  }

  window.setAudience = function (which, btn) {
    var toggle = (btn && btn.parentElement) || document.querySelector('.aud-toggle');
    if (toggle) {
      Array.prototype.forEach.call(toggle.querySelectorAll('.aud-tab'), function (t) {
        var on = t.getAttribute('data-aud') === which;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      toggle.setAttribute('data-active', which);
    }
    renderAudience(which);
  };

  /* ----------------------------------------------------------
   * Scroll-spy (nav link aktif) + progress bar.
   * Landing scroll di kontainer dalam → listener capture phase.
   * -------------------------------------------------------- */
  function initScrollExtras() {
    if (!document.getElementById('screen-landing')) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var bar = document.getElementById('sl-progress-bar');
    var spy = Array.prototype.map.call(document.querySelectorAll('.l-nav-link[data-spy]'), function (l) {
      return { link: l, sec: document.getElementById(l.getAttribute('data-spy')) };
    }).filter(function (x) { return x.sec; });
    // Parallax: elemen dekoratif yang bergeser mengikuti posisi scroll —
    // tiap gerakan scroll = gerak halus (depth). Nonaktif saat reduced-motion.
    var px = reduce ? [] : Array.prototype.slice.call(document.querySelectorAll('#screen-landing [data-parallax]'));
    if (!bar && !spy.length && !px.length) return;

    var scroller = null, ticking = false;
    function onScroll(e) {
      if (e && e.target && typeof e.target.scrollHeight === 'number' && e.target.nodeType === 1) scroller = e.target;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }
    function update() {
      ticking = false;
      // Hanya bekerja saat Landing aktif — listener ini global (capture phase)
      // jadi ikut terpanggil saat scroll di dashboard/chat dll. Skip biar hemat.
      var landing = document.getElementById('screen-landing');
      if (!landing || !landing.classList.contains('active')) return;
      var sc = scroller || document.scrollingElement || document.documentElement;
      var nav = document.getElementById('l-navbar');
      if (nav && sc) nav.classList.toggle('is-scrolled', (sc.scrollTop || 0) > 24);
      if (bar && sc) {
        var max = sc.scrollHeight - sc.clientHeight;
        bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(sc.scrollTop / max, 1) : 0).toFixed(4) + ')';
      }
      if (spy.length) {
        var line = 150, active = null;
        spy.forEach(function (x) {
          var r = x.sec.getBoundingClientRect();
          if (r.top <= line && r.bottom > line) active = x;
        });
        spy.forEach(function (x) { x.link.classList.toggle('is-active', x === active); });
      }
      if (px.length) {
        var vh = window.innerHeight || document.documentElement.clientHeight || 800;
        px.forEach(function (el) {
          var sp = parseFloat(el.getAttribute('data-parallax')) || 0;
          var r = el.getBoundingClientRect();
          var offset = ((r.top + r.height / 2) - vh / 2) * sp;
          el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
        });
      }
    }
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ----------------------------------------------------------
   * Parallax tilt 3D pada hero card mengikuti kursor.
   * Diterapkan ke .hero-card-stage (float kartu di dalam tetap jalan).
   * -------------------------------------------------------- */
  function initHeroTilt() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var hero = document.querySelector('#screen-landing .hero');
    var stage = document.querySelector('#screen-landing .hero-card-stage');
    if (!hero || !stage || window.matchMedia('(hover: none)').matches) return;
    var raf = null;
    hero.addEventListener('mousemove', function (e) {
      var rect = hero.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        stage.style.transform = 'perspective(900px) rotateY(' + (x * 7).toFixed(2) + 'deg) rotateX(' + (-y * 7).toFixed(2) + 'deg)';
      });
    });
    hero.addEventListener('mouseleave', function () { stage.style.transform = ''; });
  }

  function init() {
    var t = document.querySelector('.aud-toggle');
    if (document.getElementById('aud-panel')) {
      if (t) t.setAttribute('data-active', 'student');
      renderAudience('student');
    }
    initScrollExtras();
    initHeroTilt();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
