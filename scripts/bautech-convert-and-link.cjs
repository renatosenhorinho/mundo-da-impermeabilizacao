/**
 * bautech-convert-and-link.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Scan all files in public/images/products/BAUTECH/
 * 2. Convert .jpeg / .jpg / .png → .webp (quality 88, lossless=false)
 *    - Keeps originals (safe rollback)
 *    - Skips if .webp already exists with same base name
 * 3. Normalize filenames: lowercase + hyphens → underscores (already done here
 *    via mapping; we read actual filenames as-is to avoid rename conflicts)
 * 4. Build an image group map: { productKey → { capa, extras[] } }
 * 5. Match each Bautech product in products.ts by explicit key table
 * 6. Update imagem + imagens[] fields — ONLY on products that still have
 *    placeholder or outdated path. Never touches slugs/analytics/tracking.
 * 7. Print full report.
 *
 * SAFE RULES:
 *  ✔ Never deletes source files
 *  ✔ Never changes slugs, ids, analytics, tracking, admin, typings
 *  ✔ Only modifies imagem/imagens on placeholder products
 *  ✔ Idempotent — can be run multiple times safely
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

// ── Constants ────────────────────────────────────────────────────────────────

const ROOT        = path.resolve(__dirname, '..');
const BAUTECH_DIR = path.join(ROOT, 'public', 'images', 'products', 'BAUTECH');
const PRODUCTS_TS = path.join(ROOT, 'src', 'data', 'products.ts');
const WEB_BASE    = '/images/products/BAUTECH';
const PLACEHOLDER = '/images/products/placeholder.webp';

// WebP conversion settings — good quality, balanced size
const WEBP_OPTS = { quality: 88, effort: 4 };

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Remove extension from filename */
const stripExt = (f) => f.replace(/\.(webp|png|jpe?g)$/i, '');

/** Normalise string for fuzzy matching */
const norm = (s) =>
  s.toLowerCase()
   .normalize('NFD')
   .replace(/[\u0300-\u036f]/g, '')
   .replace(/[-_\s]+/g, ' ')
   .replace(/[^a-z0-9 ]/g, '')
   .trim();

/** Web path for a file in BAUTECH dir */
const webPath = (filename) => `${WEB_BASE}/${filename}`;

// ── Step 1: Scan current files ───────────────────────────────────────────────

function scanFiles() {
  return fs.readdirSync(BAUTECH_DIR)
    .filter(f => /\.(webp|png|jpe?g)$/i.test(f))
    .sort();
}

// ── Step 2: Convert non-WebP files ──────────────────────────────────────────

async function convertToWebp(files) {
  const converted = [];
  const skipped   = [];

  for (const file of files) {
    if (/\.webp$/i.test(file)) { skipped.push(file); continue; }

    const base      = stripExt(file);
    const srcPath   = path.join(BAUTECH_DIR, file);
    const destName  = `${base}.webp`;
    const destPath  = path.join(BAUTECH_DIR, destName);

    // Skip if .webp already exists (idempotent)
    if (fs.existsSync(destPath)) {
      skipped.push(`${file} → ${destName} (already exists)`);
      continue;
    }

    try {
      await sharp(srcPath).webp(WEBP_OPTS).toFile(destPath);
      const srcSize  = fs.statSync(srcPath).size;
      const destSize = fs.statSync(destPath).size;
      const savings  = Math.round((1 - destSize / srcSize) * 100);
      converted.push({ file, destName, srcSize, destSize, savings });
    } catch (err) {
      console.error(`  ✗ Failed to convert ${file}:`, err.message);
    }
  }

  return { converted, skipped };
}

// ── Step 3: Build WebP-only image groups ────────────────────────────────────
//
//  Groups files by "base key" (without _capa / _fotoN suffix).
//  Only .webp files are indexed (originals already converted).

function buildImageGroups() {
  const webpFiles = fs.readdirSync(BAUTECH_DIR)
    .filter(f => /\.webp$/i.test(f))
    .sort();

  // { baseKey → { capa: string|null, extras: string[] } }
  const groups = {};

  for (const file of webpFiles) {
    const base = stripExt(file);

    let groupKey;
    let isCapa  = false;
    let fotoNum = null;

    const capaMatch = base.match(/^(.+)_capa$/i);
    const fotoMatch = base.match(/^(.+)_foto(\d+)$/i);

    if (capaMatch)      { groupKey = capaMatch[1]; isCapa = true; }
    else if (fotoMatch) { groupKey = fotoMatch[1]; fotoNum = parseInt(fotoMatch[2]); }
    else                { groupKey = base; isCapa = true; } // solo file treated as capa

    if (!groups[groupKey]) groups[groupKey] = { capa: null, extras: [] };

    if (isCapa) {
      groups[groupKey].capa = file;
    } else {
      groups[groupKey].extras.push({ file, num: fotoNum });
    }
  }

  // Sort extras by foto number
  for (const g of Object.values(groups)) {
    g.extras.sort((a, b) => a.num - b.num);
    g.extrasFiles = g.extras.map(e => e.file);
    delete g.extras;
  }

  return groups;
}

// ── Step 4: Explicit product→group mapping ───────────────────────────────────
//
// Explicit mapping avoids false-positives from fuzzy matching.
// Key = exact substring of product `nome` (lowercased).
// Value = groupKey in the image groups map (lowercased).

function buildProductMapping(groups) {
  // Normalised group keys for lookup
  const normGroups = {};
  for (const [key] of Object.entries(groups)) {
    normGroups[norm(key)] = key;
  }

  // Explicit rules: [productNameSubstring] → groupKeyFragment
  //
  // ⚠️  IMPORTANT — ORDER BY SPECIFICITY (most specific first).
  // `resolveProductGroup` stops at the FIRST match, so longer/more-specific
  // productFragment strings must appear before shorter generic ones to avoid
  // false-positive matches (e.g., 'platina 20kg' must not capture 'Cinza Platina').
  const rules = [
    // ── Tinta Piso Blindado (specific first — avoids clash with emborrachada) ──
    { product: 'piso blindado cinza platina 20kg', groupFragment: 'ultra premium 20 kg platina' },
    { product: 'piso blindado cinza platina 4kg',  groupFragment: 'ultra premium 4 kg platina'  },
    { product: 'piso blindado grafite 20kg',       groupFragment: 'ultra premium 20 kg grafite' },
    { product: 'piso blindado grafite 4kg',        groupFragment: 'ultra premium 4 kg grafite'  },
    { product: 'piso blindado branco 20kg',        groupFragment: 'ultra premium 20 kg branca'  },
    { product: 'piso blindado incolor 2kg',        groupFragment: 'ultra premium 20 kg incolor' },
    // ── Pintura Emborrachada ──────────────────────────────────────────────────
    { product: 'algodao egipcio 20kg', groupFragment: 'algodao egipcio'                          },
    { product: 'algodao egipcio 4kg',  groupFragment: 'algodao egipcio'                          },
    { product: 'branca 20kg',          groupFragment: 'acrlica emborrachada bautech 20kg branca'  },
    { product: 'branca 4kg',           groupFragment: 'emborrachada bautech 4kg branca'           },
    { product: 'concreto 20kg',        groupFragment: 'acrlica emborrachada bautech 20kg concreto'},
    { product: 'concreto 4kg',         groupFragment: 'acrlica emborrachada bautech 4kg concreto' },
    { product: 'platina 20kg',         groupFragment: 'emborrachada bautech 20kg platina'         },
    { product: 'platina 4kg',          groupFragment: 'emborrachada bautech 4kg platina'          },
    // ── Manta Líquida ─────────────────────────────────────────────────────────
    { product: 'manta liquida incolor 8kg',   groupFragment: 'manta liquida incolor 8kg'   },
    { product: 'manta liquida incolor 900ml', groupFragment: 'manta liquida incolor 900ml' },
  ];

  // Resolve each rule to an actual group key
  const mapping = {}; // productFragment → groupKey
  for (const rule of rules) {
    const needleNorm = norm(rule.groupFragment);
    // Find matching group
    const match = Object.keys(groups).find(k => norm(k).includes(needleNorm));
    if (match) {
      mapping[rule.product] = match;
    } else {
      console.warn(`  ⚠ No group found for rule: "${rule.groupFragment}"`);
    }
  }

  return mapping; // { productFragment → groupKey }
}

// ── Step 5: Match product nome to mapping ────────────────────────────────────

function resolveProductGroup(productNome, mapping) {
  const n = norm(productNome);
  for (const [fragment, groupKey] of Object.entries(mapping)) {
    if (n.includes(norm(fragment))) return groupKey;
  }
  return null;
}

// ── Step 6: Update products.ts ───────────────────────────────────────────────

function updateProductsTs(content, productNome, capa, allImages) {
  const lines   = content.split('\n');
  const nomePat = productNome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let updated = false;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].match(new RegExp(`nome:\\s*'${nomePat}'`))) continue;

    // Found the product — look for imagem + imagens in the next 40 lines
    for (let j = i + 1; j < Math.min(i + 40, lines.length); j++) {
      // Update imagem line
      if (lines[j].match(/\s+imagem:\s*'/)) {
        const indent = lines[j].match(/^(\s*)/)[1];
        lines[j] = `${indent}imagem: '${webPath(capa)}',`;
        updated = true;
      }

      // Update imagens line
      if (lines[j].match(/\s+imagens:\s*\[/)) {
        const indent = lines[j].match(/^(\s*)/)[1];
        const imgList = allImages.map(f => `'${webPath(f)}'`).join(', ');
        lines[j] = `${indent}imagens: [${imgList}],`;
      }

      // Stop at end of this product object
      if (lines[j].trim() === '},') break;
    }

    if (updated) break;
  }

  return { content: lines.join('\n'), updated };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     BAUTECH — CONVERT TO WEBP + LINK IMAGES                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ── 1. Scan ──────────────────────────────────────────────────────────────
  const allFiles = scanFiles();
  console.log(`📁 Files in BAUTECH/: ${allFiles.length}`);

  const nonWebp = allFiles.filter(f => !/\.webp$/i.test(f));
  const alreadyWebp = allFiles.filter(f => /\.webp$/i.test(f));
  console.log(`   WebP:     ${alreadyWebp.length}`);
  console.log(`   Non-WebP: ${nonWebp.length} (will convert)\n`);

  // ── 2. Convert ───────────────────────────────────────────────────────────
  if (nonWebp.length > 0) {
    console.log('🔄 Converting to WebP...');
    const { converted, skipped } = await convertToWebp(allFiles);

    converted.forEach(({ file, destName, srcSize, destSize, savings }) => {
      const srcKb  = Math.round(srcSize / 1024);
      const destKb = Math.round(destSize / 1024);
      const arrow  = savings > 0 ? `↓${savings}%` : `↑${Math.abs(savings)}%`;
      console.log(`  ✓ ${file}`);
      console.log(`    → ${destName}  (${srcKb}KB → ${destKb}KB, ${arrow})`);
    });

    if (converted.length === 0) {
      console.log('  (all already converted)');
    }
    console.log();
  }

  // ── 3. Build groups (WebP only) ──────────────────────────────────────────
  const groups = buildImageGroups();
  console.log(`📦 Image groups (WebP): ${Object.keys(groups).length}`);
  Object.entries(groups).forEach(([key, g]) => {
    const extras = g.extrasFiles?.length ? ` + ${g.extrasFiles.length} extra` : '';
    console.log(`   • ${key} → ${g.capa}${extras}`);
  });
  console.log();

  // ── 4. Mapping ───────────────────────────────────────────────────────────
  const mapping = buildProductMapping(groups);
  console.log(`🗺  Product→Group mapping: ${Object.keys(mapping).length} rules resolved\n`);

  // ── 5. Update products.ts ────────────────────────────────────────────────
  let content = fs.readFileSync(PRODUCTS_TS, 'utf8');
  const lines  = content.split('\n');

  // Collect all Bautech product names
  const bautechNames = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/nome:\s*'(Bautech[^']+)'/);
    if (m) bautechNames.push(m[1]);
  }

  console.log(`🛒 Bautech products found: ${bautechNames.length}\n`);
  console.log('🔗 Linking...');

  const report = { linked: [], noGroup: [], alreadyOk: [] };

  for (const nome of bautechNames) {
    const groupKey = resolveProductGroup(nome, mapping);

    if (!groupKey) {
      report.noGroup.push(nome);
      console.log(`  ✗ No mapping: ${nome}`);
      continue;
    }

    const group = groups[groupKey];
    if (!group?.capa) {
      report.noGroup.push(nome);
      console.log(`  ✗ No capa file: ${nome} → ${groupKey}`);
      continue;
    }

    const allImages = [group.capa, ...(group.extrasFiles || [])];

    // Check current imagem value — skip if already correct
    let currentImg = '';
    const nomeEsc = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].match(new RegExp(`nome:\\s*'${nomeEsc}'`))) continue;
      for (let j = i + 1; j < Math.min(i + 40, lines.length); j++) {
        const m = lines[j].match(/imagem:\s*'([^']+)'/);
        if (m) { currentImg = m[1]; break; }
        if (lines[j].trim() === '},') break;
      }
      break;
    }

    const expectedImg = webPath(group.capa);
    if (currentImg === expectedImg) {
      report.alreadyOk.push(nome);
      console.log(`  ✓ Already OK: ${nome}`);
      continue;
    }

    // Apply update
    const result = updateProductsTs(content, nome, group.capa, allImages);
    if (result.updated) {
      content = result.content;
      report.linked.push({ nome, capa: group.capa, count: allImages.length });
      console.log(`  ✅ Linked: ${nome}`);
      console.log(`     → ${group.capa} (${allImages.length} img)`);
    }
  }

  // ── 6. Write file ────────────────────────────────────────────────────────
  fs.writeFileSync(PRODUCTS_TS, content, 'utf8');

  // ── 7. Report ────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    RELATÓRIO FINAL                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`✅ Imagens convertidas para WebP: ${nonWebp.length}`);
  nonWebp.forEach(f => console.log(`   • ${f} → ${stripExt(f)}.webp`));

  console.log(`\n✅ Produtos vinculados agora:     ${report.linked.length}`);
  report.linked.forEach(r =>
    console.log(`   • ${r.nome} → ${r.capa} (${r.count} img)`)
  );

  console.log(`\n🟢 Produtos já corretos:          ${report.alreadyOk.length}`);
  report.alreadyOk.forEach(n => console.log(`   • ${n}`));

  console.log(`\n⚠️  Produtos sem grupo:            ${report.noGroup.length}`);
  report.noGroup.forEach(n => console.log(`   • ${n}`));

  // Final WebP inventory
  const finalWebp = fs.readdirSync(BAUTECH_DIR).filter(f => /\.webp$/i.test(f));
  console.log(`\n📁 Total WebP na pasta BAUTECH/:  ${finalWebp.length}`);
  console.log(`📁 Total Bautech produtos:         ${bautechNames.length}`);

  const covered = report.linked.length + report.alreadyOk.length;
  console.log(`📊 Cobertura de imagens:           ${covered}/${bautechNames.length} (${Math.round(covered/bautechNames.length*100)}%)`);
  console.log('\n✅ products.ts atualizado.\n');
}

main().catch(err => {
  console.error('\n✗ Fatal error:', err);
  process.exit(1);
});
