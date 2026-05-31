/**
 * vite.config.js — StairsLife Build Pipeline
 *
 * Strategi: proyek ini menggunakan Vanilla JS dengan pola window.* globals
 * (bukan ES modules). Plugin `legacyScriptsBundle` menangani ini dengan:
 *
 * DEV  → Vite dev server, file dilayani individual (hot reload CSS, HMR ringan)
 * BUILD→ Semua <script src="..."> di-concatenate & diminify jadi satu bundle,
 *         CSS diproses Vite (minify + hash), HTML dioptimasi.
 *
 * Hasil build di dist/:
 *   index.html              ← HTML dioptimasi, referensi bundle hashed
 *   assets/bundle.[hash].js ← semua 30 JS diminify dalam 1 file
 *   assets/main.[hash].css  ← CSS diminify
 *   assets/                 ← font, image, dsb.
 */

import { defineConfig }  from 'vite';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { createHash }    from 'crypto';

/* ================================================================
   PLUGIN: legacyScriptsBundle
   Membaca semua <script src="..."> (tanpa type="module") dari HTML,
   concatenate + minify dengan esbuild (sudah bundled di Vite),
   lalu replace semua tag tersebut dengan satu <script src="bundle.js">.
   ================================================================ */
function legacyScriptsBundle() {
  let viteConfig;
  const PLUGIN_NAME = 'legacy-scripts-bundle';

  return {
    name: PLUGIN_NAME,
    enforce: 'post',          // jalan setelah Vite selesai proses HTML

    configResolved(cfg) {
      viteConfig = cfg;
    },

    /*
     * transformIndexHtml: di kedua mode (dev & build) kita return HTML
     * apa adanya. Transformasi sesungguhnya (replace script tag dengan
     * bundle hashed) dilakukan di writeBundle setelah generateBundle.
     * Hook ini hanya ada untuk hadir di pipeline plugin Vite.
     */
    transformIndexHtml(html) {
      return html;
    },

    async generateBundle(_opts, _bundle) {
      // Hanya jalan saat build
      const root = viteConfig.root || process.cwd();

      // Baca HTML
      const htmlPath = join(root, 'index.html');
      const html = readFileSync(htmlPath, 'utf-8');

      // Ekstrak semua <script src="..."> non-module
      const scriptTagRe = /<script\s+src="([^"]+)"[^>]*><\/script>/g;
      const scriptTags  = [];
      let match;
      while ((match = scriptTagRe.exec(html)) !== null) {
        const src = match[1];
        // Skip CDN scripts
        if (!src.startsWith('http') && !src.startsWith('//')) {
          scriptTags.push({ tag: match[0], src });
        }
      }

      if (!scriptTags.length) return;

      // Concatenate semua JS dalam urutan yang benar
      const pieces = [];
      for (const { src } of scriptTags) {
        const filePath = join(root, src);
        try {
          const code = readFileSync(filePath, 'utf-8');
          pieces.push(`/* === ${src} === */\n${code}`);
        } catch (_e) {
          console.warn(`[${PLUGIN_NAME}] Tidak bisa baca: ${src}`);
        }
      }

      const concatenated = pieces.join('\n\n');

      // Minify menggunakan esbuild. Kalau gagal, fallback ke un-minified
      // sebagai graceful degradation (build tidak crash, hanya output lebih besar).
      let minified = concatenated;
      try {
        const { transform } = await import('esbuild');
        const result = await transform(concatenated, {
          minify:            true,
          minifyWhitespace:  true,
          minifySyntax:      true,
          minifyIdentifiers: false,
          target:            'es2018',
          format:            'iife',
          globalName:        '__SL__',
          charset:           'utf8',
        });
        minified = result.code;
      } catch (e) {
        console.warn(`[${PLUGIN_NAME}] esbuild minify gagal, pakai raw: ${e.message}`);
      }

      // Buat hash untuk cache busting
      const hash = createHash('sha256').update(minified).digest('hex').slice(0, 8);
      const bundleName = `assets/bundle.${hash}.js`;

      // Emit file ke bundle
      this.emitFile({
        type:     'asset',
        fileName: bundleName,
        source:   minified,
      });

      // Update ukuran — log info
      const origKb = Math.round(concatenated.length / 1024);
      const minKb  = Math.round(minified.length / 1024);
      const saving = Math.round((1 - minified.length / concatenated.length) * 100);
      console.log(`\n  📦 JS Bundle:`);
      console.log(`     Original  : ${origKb} KB (${scriptTags.length} files)`);
      console.log(`     Minified  : ${minKb} KB (-${saving}%)`);
      console.log(`     Output    : ${bundleName}\n`);

      // Simpan info bundle name untuk transformIndexHtml post-build
      this._bundleName = bundleName;
    },

    /* Modifikasi HTML output: replace script tags dengan bundle */
    writeBundle(_opts, bundle) {
      const root     = viteConfig.root || process.cwd();
      const outDir   = resolve(root, viteConfig.build?.outDir || 'dist');
      const htmlPath = join(outDir, 'index.html');

      if (!existsSync(htmlPath)) return;
      let html = readFileSync(htmlPath, 'utf-8');

      // Cari bundle name dari emitted files
      const bundleFile = Object.keys(bundle).find(k => k.startsWith('assets/bundle.'));
      if (!bundleFile) return;

      // Hapus semua script tags lokal
      const scriptTagRe = /<script\s+src="(?!https?:\/\/|\/\/)[^"]*"[^>]*><\/script>\s*/g;
      html = html.replace(scriptTagRe, '');

      // Sisipkan bundle sebelum </body>
      const bundleTag = `  <script src="/${bundleFile}"></script>\n`;
      html = html.replace('</body>', `${bundleTag}</body>`);

      writeFileSync(htmlPath, html);
      console.log(`  ✅ index.html updated → /${bundleFile}`);
    },
  };
}

/* ================================================================
   VITE CONFIG
   ================================================================ */
export default defineConfig({
  root: '.',

  // Dev server
  server: {
    port:   5173,
    open:   true,
    host:   true,
  },

  // Preview server (setelah build)
  preview: {
    port: 4173,
    open: true,
  },

  // Build
  build: {
    outDir:          'dist',
    emptyOutDir:     true,
    cssMinify:       true,
    cssCodeSplit:    false,     // satu file CSS
    assetsInlineLimit: 4096,   // inline asset <4KB

    rollupOptions: {
      input: {
        main: resolve('.', 'index.html'),
      },
      output: {
        // CSS output dengan hash
        assetFileNames: 'assets/[name].[hash][extname]',
        // Tidak pakai chunk splitting untuk proyek ini
        manualChunks: undefined,
      },
    },
  },

  // Plugin
  plugins: [
    legacyScriptsBundle(),
  ],
});
