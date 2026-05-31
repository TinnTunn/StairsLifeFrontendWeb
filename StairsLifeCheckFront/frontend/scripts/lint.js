#!/usr/bin/env node
/**
 * scripts/lint.js
 * Syntax checker sederhana: node --check semua file JS + duplikat function check.
 * Dipanggil via: npm run lint
 */
import { readdirSync, statSync, readFileSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// fileURLToPath menangani path Windows dengan benar (drive letter + spasi).
// `new URL('..').pathname` menghasilkan "/C:/Users/Nama%20Folder/..." yang rusak.
const root    = dirname(dirname(fileURLToPath(import.meta.url)));
const ignored = new Set(['node_modules', 'dist', '.git']);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (ignored.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (entry.endsWith('.js')) files.push(full);
  }
  return files;
}

let errors = 0;

// --- 1. Syntax check ---
const jsFiles = walk(join(root, 'scripts'));
console.log(`\nChecking syntax of ${jsFiles.length} JS files...`);
for (const f of jsFiles) {
  try {
    execSync(`node --check "${f}"`, { stdio: 'pipe' });
  } catch (e) {
    console.error(`  ❌ ${relative(root, f)}`);
    console.error(`     ${e.stderr?.toString().split('\n')[0]}`);
    errors++;
  }
}
if (!errors) console.log(`  ✅ All ${jsFiles.length} files pass syntax check`);

// --- 2. Duplicate function check ---
console.log('\nChecking for duplicate function names...');
const fnMap = new Map();
for (const f of jsFiles) {
  const src = readFileSync(f, 'utf-8');
  const rel = relative(root, f);
  for (const m of src.matchAll(/^(?:async\s+)?function\s+(\w+)/gm)) {
    const name = m[1];
    if (!fnMap.has(name)) fnMap.set(name, []);
    fnMap.get(name).push(rel);
  }
}
const dupes = [...fnMap.entries()].filter(([, files]) => files.length > 1);
if (dupes.length) {
  console.error('  ❌ Duplicate functions found:');
  for (const [name, files] of dupes) {
    console.error(`     ${name}: ${files.join(', ')}`);
  }
  errors += dupes.length;
} else {
  console.log('  ✅ No duplicate functions');
}

// --- 3. prompt() check ---
console.log('\nChecking for native prompt() usage...');
let promptCount = 0;
for (const f of jsFiles) {
  const src  = readFileSync(f, 'utf-8');
  const rel  = relative(root, f);
  const hits = [...src.matchAll(/(?<!\/\/.*)= prompt\(/g)];
  if (hits.length) {
    console.error(`  ❌ ${rel}: ${hits.length} prompt() call(s)`);
    promptCount += hits.length;
    errors++;
  }
}
if (!promptCount) console.log('  ✅ No native prompt() found');

console.log(`\n${errors ? `❌ ${errors} issue(s) found` : '✅ All checks passed'}\n`);
process.exit(errors ? 1 : 0);
