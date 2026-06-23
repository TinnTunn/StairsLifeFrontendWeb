/* ============================================================
 * StairsLife — utils/a11y.js
 * Penyempurnaan aksesibilitas non-invasif (UI/UX polish).
 * Berjalan saat load + memantau DOM dinamis (screen yang
 * di-render via JS setelah login) lewat MutationObserver.
 *
 * Yang ditangani:
 *  1. Input/textarea/select tanpa <label for> atau aria-label
 *     → diberi aria-label dari placeholder terdekat.
 *  2. Tombol ikon-saja (hanya <svg>, tanpa teks/aria-label)
 *     → diberi aria-label dari title/dekat konteks (fallback generik).
 *  3. Elemen [onclick] non-native (span/div) → dibuat
 *     keyboard-operable (role=button, tabindex=0, Enter/Space).
 *  4. Tab role (.login-role-tab, .tab-btn) → aria-selected sync.
 * ============================================================ */
'use strict';

(function () {
  function labelInputs(root) {
    root.querySelectorAll('input, textarea, select').forEach((el) => {
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return;
      const id = el.id;
      if (id && root.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]')) return;
      // Cari label sibling/ancestor dulu
      const grp = el.closest('.form-group, .field, .input-wrap');
      let lbl = grp ? grp.querySelector('label, .form-label, .field-label') : null;
      const text = (lbl && lbl.textContent.trim()) || el.getAttribute('placeholder') || el.getAttribute('name') || el.type;
      if (text) el.setAttribute('aria-label', text.replace(/\s*\*\s*$/, '').trim());
    });
  }

  function labelIconButtons(root) {
    root.querySelectorAll('button').forEach((b) => {
      if (b.getAttribute('aria-label') || b.getAttribute('aria-labelledby')) return;
      if (b.textContent.trim()) return;            // ada teks → sudah jelas
      if (!b.querySelector('svg')) return;          // bukan tombol ikon
      const guess =
        b.getAttribute('title') ||
        b.dataset.label ||
        (b.classList.contains('auth-back-btn') || b.classList.contains('pd-back-btn') ? 'Kembali' : null) ||
        (b.classList.contains('theme-btn') || b.classList.contains('theme-toggle') ? 'Ganti tema terang/gelap' : null) ||
        (b.classList.contains('modal-close') ? 'Tutup' : null) ||
        (b.classList.contains('input-eye') ? 'Tampilkan/sembunyikan password' : null) ||
        'Tombol';
      b.setAttribute('aria-label', guess);
    });
  }

  function makeClickablesAccessible(root) {
    root.querySelectorAll('[onclick]').forEach((el) => {
      const tag = el.tagName;
      if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (el.dataset.a11yReady) return;
      el.dataset.a11yReady = '1';
      if (!el.getAttribute('role')) el.setAttribute('role', 'button');
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', (e) => {
        // HANYA aktifkan kalau key ditekan DI elemen itu sendiri — bukan
        // event yang menggelembung dari child (input/textarea di dalamnya).
        // BUG SEBELUMNYA: menekan Space saat mengetik di textarea (mis. form
        // lamaran di dalam .modal-backdrop[onclick]) menggelembung ke sini →
        // preventDefault (spasi tidak terketik) + el.click() → modal tertutup.
        if (e.target !== el) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          el.click();
        }
      });
    });
  }

  function syncTabs(root) {
    root.querySelectorAll('.login-role-tab, .tab-btn, [role="tab"]').forEach((t) => {
      if (t.getAttribute('role') !== 'tab') return;
      t.setAttribute('aria-selected', t.classList.contains('active') ? 'true' : 'false');
    });
  }

  function enhance(root) {
    try {
      root = root || document;
      labelInputs(root);
      labelIconButtons(root);
      makeClickablesAccessible(root);
      syncTabs(root);
    } catch (_e) { /* never break the app for a11y */ }
  }

  function init() {
    enhance(document);
    // Pantau konten dinamis (dashboard, chat, wallet, dst. di-render via JS)
    const obs = new MutationObserver((muts) => {
      let touched = false;
      for (const m of muts) {
        if (m.addedNodes && m.addedNodes.length) { touched = true; break; }
        if (m.type === 'attributes' && m.attributeName === 'class') { touched = true; break; }
      }
      if (touched) {
        // debounce ringan
        clearTimeout(window.__a11yT);
        window.__a11yT = setTimeout(() => enhance(document), 120);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__slEnhanceA11y = enhance;
})();
