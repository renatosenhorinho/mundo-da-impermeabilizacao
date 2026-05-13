/**
 * scripts/auto-convert-images.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Universal WebP converter for ALL product images.
 *
 * • Recursively scans public/images/products/
 * • Converts .jpg / .jpeg / .png → .webp (quality 87, effort 4)
 * • Skips if matching .webp already exists (idempotent)
 * • Never deletes source files
 * • Prints a structured report with savings per file
 *
 * Usage:
 *   node scripts/auto-convert-images.cjs
 *   node scripts/auto-convert-images.cjs --dry-run   (preview only)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

// ── Config ───────────────────────────────────────────────────────────────────

const IMAGES_ROOT = path.resolve(__dirname, '..', 'public', 'images', 'products');
const WEBP_OPTS   = { quality: 87, effort: 4, smartSubsample: true };
const CONVERT_EXT = new Set(['.jpg', '.jpeg', '.png']);
const DRY_RUN     = process.argv.includes('--dry-run');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Walk a directory recursively, returning file paths */
function walkDir(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(fullPath, results);
    else results.push(fullPath);
  }
  return results;
}

/** Human-readable file size */
const kb = (bytes) => `${Math.round(bytes / 1024)}KB`;

/** Savings percentage string */
const savings = (src, dest) => {
  const pct = Math.round((1 - dest / src) * 100);
  return pct > 0 ? `↓${pct}%` : `↑${Math.abs(pct)}%`;
};

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  AUTO CONVERT TO WEBP${DRY_RUN ? ' [DRY RUN]' : ''}                              ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const allFiles  = walkDir(IMAGES_ROOT);
  const toConvert = allFiles.filter(f => CONVERT_EXT.has(path.extname(f).toLowerCase()));

  console.log(`📁 Total files scanned:  ${allFiles.length}`);
  console.log(`🔄 Files to convert:     ${toConvert.length}`);
  if (DRY_RUN) console.log('   [DRY RUN — no files will be written]\n');
  else         console.log();

  const report = { converted: [], skipped: [], failed: [] };

  for (const srcPath of toConvert) {
    const dir      = path.dirname(srcPath);
    const base     = path.basename(srcPath, path.extname(srcPath));
    const destPath = path.join(dir, `${base}.webp`);
    const relSrc   = path.relative(IMAGES_ROOT, srcPath);

    // Skip if .webp already exists
    if (fs.existsSync(destPath)) {
      report.skipped.push(relSrc);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry] Would convert: ${relSrc}`);
      report.converted.push({ relSrc, srcSize: 0, destSize: 0, savingsPct: '?' });
      continue;
    }

    try {
      await sharp(srcPath).webp(WEBP_OPTS).toFile(destPath);
      const srcSize  = fs.statSync(srcPath).size;
      const destSize = fs.statSync(destPath).size;
      const savingsPct = savings(srcSize, destSize);
      report.converted.push({ relSrc, srcSize, destSize, savingsPct });
      console.log(`  ✓ ${relSrc}`);
      console.log(`    → ${base}.webp  (${kb(srcSize)} → ${kb(destSize)}, ${savingsPct})`);
    } catch (err) {
      report.failed.push({ relSrc, err: err.message });
      console.error(`  ✗ FAILED: ${relSrc}  —  ${err.message}`);
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────

  const totalSavedBytes = report.converted.reduce((acc, r) => acc + (r.srcSize - r.destSize), 0);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                       RELATÓRIO                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`✅ Convertidos:   ${report.converted.length}`);
  console.log(`⏭  Ignorados:    ${report.skipped.length}  (WebP já existia)`);
  console.log(`❌ Falhas:        ${report.failed.length}`);
  if (!DRY_RUN && totalSavedBytes > 0) {
    console.log(`💾 Espaço total economizado: ${kb(totalSavedBytes)}`);
  }

  if (report.failed.length > 0) {
    console.log('\n⚠️  Arquivos com falha:');
    report.failed.forEach(f => console.log(`   • ${f.relSrc}: ${f.err}`));
  }

  console.log('\n✅ Conversão concluída.\n');

  if (report.failed.length > 0) process.exit(1);
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message);
  process.exit(1);
});
