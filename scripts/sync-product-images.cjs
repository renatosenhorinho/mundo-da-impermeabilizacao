/**
 * scripts/sync-product-images.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Universal products.ts image sync engine.
 *
 * Performs three passes over products.ts:
 *
 *  PASS 1 — Extension fix
 *    • Replaces non-webp extensions in imagem/imagens[] with .webp equivalent
 *      ONLY when the .webp file exists on disk.
 *    • Skips if the original file also doesn't exist (won't invent paths).
 *
 *  PASS 2 — imagens[] backfill
 *    • If imagens[] is empty/missing but imagem is set (and not placeholder),
 *      populates imagens: [imagem] as minimum viable carousel entry.
 *
 *  PASS 3 — Slug-based auto-discovery (optional, for unlinked products)
 *    • For products with placeholder imagem, searches the category image folder
 *      for any .webp file whose name starts with the product slug.
 *    • If found, sets imagem and imagens[].
 *
 * SAFE RULES:
 *   ✔ Never modifies slugs, ids, analytics, categories, tracking
 *   ✔ Idempotent — safe to run multiple times
 *   ✔ Never invents paths that don't exist on disk
 *   ✔ Never removes existing correct data
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────────────────────

const ROOT        = path.resolve(__dirname, '..');
const PUBLIC_DIR  = path.join(ROOT, 'public');
const PRODUCTS_TS = path.join(ROOT, 'src', 'data', 'products.ts');
const PLACEHOLDER = '/images/products/placeholder.webp';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Disk path from web path */
const toDisk  = (webPath) => path.join(PUBLIC_DIR, webPath.replace(/\//g, path.sep));

/** Strip extension from filename or path */
const stripExt = (p) => p.replace(/\.(webp|jpe?g|png|svg)$/i, '');

/** Convert any image path to its .webp equivalent */
const toWebp  = (p) => `${stripExt(p)}.webp`;

/** True if file exists on disk */
const exists  = (webPath) => fs.existsSync(toDisk(webPath));

/** True if path points to a real (non-placeholder) image */
const isReal  = (p) => p && p !== PLACEHOLDER && !p.includes('placeholder');

/** Normalise text for slug-matching */
const norm = (s) =>
  s.toLowerCase()
   .normalize('NFD')
   .replace(/[\u0300-\u036f]/g, '')
   .replace(/[-_\s]+/g, '-')
   .replace(/[^a-z0-9-]/g, '');

// ── Image folder index ────────────────────────────────────────────────────────

/**
 * Builds a Map<folderWebPath, Set<filename>> for every category image folder.
 * Only indexes .webp files.
 */
function buildFolderIndex() {
  const imagesRoot  = path.join(PUBLIC_DIR, 'images', 'products');
  const index       = new Map(); // folderWebPath → Set<filename>

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.webp$/i.test(entry.name)) {
        const folderFull = path.dirname(fullPath);
        const folderWeb  = '/images/products/' +
          path.relative(imagesRoot, folderFull).replace(/\\/g, '/');
        if (!index.has(folderWeb)) index.set(folderWeb, new Set());
        index.get(folderWeb).add(entry.name);
      }
    }
  }

  walk(imagesRoot);
  return index;
}

// ── Parse products.ts into blocks ────────────────────────────────────────────

function parseProductBlocks(content) {
  const lines  = content.split('\n');
  const blocks = [];

  for (let i = 0; i < lines.length; i++) {
    const nomeMatch = lines[i].match(/^\s+nome:\s*'([^']+)'/);
    if (!nomeMatch) continue;

    const block = {
      nome       : nomeMatch[1],
      nomeLineIdx: i,        // 0-indexed
      slug       : null,
      categoria  : null,
      imagem     : null,
      imagemIdx  : null,
      imagemIndent: '',
      imagens    : [],
      imagensIdx : null,
      imagensIndent: '',
    };

    for (let j = i + 1; j < Math.min(i + 60, lines.length); j++) {
      const l = lines[j];

      const slugM     = l.match(/^\s+slug:\s*generateSlug\('([^']+)'\)/);
      const slugM2    = l.match(/^\s+slug:\s*'([^']+)'/);
      const catM      = l.match(/^\s+categoria:\s*'([^']+)'/);
      const imgM      = l.match(/^(\s+)imagem:\s*'([^']+)'/);
      const imgsM     = l.match(/^(\s+)imagens:\s*\[([^\]]*)\]/);

      if (slugM)  block.slug      = slugM[1];
      if (slugM2) block.slug      = slugM2[1];
      if (catM)   block.categoria = catM[1];

      if (imgM) {
        block.imagemIdx    = j;
        block.imagemIndent = imgM[1];
        block.imagem       = imgM[2];
      }

      if (imgsM) {
        block.imagensIdx    = j;
        block.imagensIndent = imgsM[1];
        block.imagens       = imgsM[2]
          .split(',')
          .map(s => s.trim().replace(/^'|'$/g, ''))
          .filter(Boolean);
      }

      if (l.trim() === '},') break;
    }

    blocks.push(block);
  }

  return blocks;
}

// ── Pass 1: Fix non-webp extensions ──────────────────────────────────────────

function pass1ExtensionFix(lines, blocks) {
  let fixed = 0;

  for (const block of blocks) {
    // Fix imagem field
    if (block.imagemIdx !== null && isReal(block.imagem) && !/\.webp$/i.test(block.imagem)) {
      const webpPath = toWebp(block.imagem);
      if (exists(webpPath)) {
        lines[block.imagemIdx] = lines[block.imagemIdx].replace(
          /imagem:\s*'[^']+'/,
          `imagem: '${webpPath}'`
        );
        block.imagem = webpPath;
        fixed++;
      }
    }

    // Fix imagens[] entries
    if (block.imagensIdx !== null && block.imagens.length > 0) {
      let anyFixed = false;
      const newImagens = block.imagens.map(img => {
        if (!isReal(img) || /\.webp$/i.test(img)) return img;
        const webpPath = toWebp(img);
        if (exists(webpPath)) { anyFixed = true; return webpPath; }
        return img;
      });
      if (anyFixed) {
        const indent = block.imagensIndent;
        lines[block.imagensIdx] =
          `${indent}imagens: [${newImagens.map(i => `'${i}'`).join(', ')}],`;
        block.imagens = newImagens;
        fixed++;
      }
    }
  }

  return fixed;
}

// ── Pass 2: Backfill empty imagens[] from imagem ──────────────────────────────

function pass2BackfillImagens(lines, blocks) {
  let filled = 0;

  for (const block of blocks) {
    const hasRealImagem   = isReal(block.imagem);
    const hasRealImagens  = block.imagens.some(isReal);

    if (!hasRealImagem || hasRealImagens) continue;
    if (block.imagensIdx === null) continue;

    const indent = block.imagensIndent;
    lines[block.imagensIdx] = `${indent}imagens: ['${block.imagem}'],`;
    block.imagens = [block.imagem];
    filled++;
  }

  return filled;
}

// ── Pass 3: Slug-based auto-discovery ─────────────────────────────────────────

function pass3SlugDiscovery(lines, blocks, folderIndex) {
  let discovered = 0;

  for (const block of blocks) {
    if (isReal(block.imagem)) continue; // already has a real image
    if (!block.slug || !block.categoria) continue;

    // Determine candidate folder(s) — category folder + BAUTECH
    const folderCandidates = [
      `/images/products/${block.categoria}`,
    ];

    let found = null;

    for (const folder of folderCandidates) {
      const files = folderIndex.get(folder);
      if (!files) continue;

      const slugNorm = norm(block.slug);

      // 1st priority: filename starts with slug
      for (const file of files) {
        const fileNorm = norm(stripExt(file));
        if (fileNorm === slugNorm || fileNorm.startsWith(slugNorm + '-') || fileNorm.startsWith(slugNorm + '_')) {
          found = { folder, file };
          break;
        }
      }
      if (found) break;

      // 2nd priority: slug contained in filename
      for (const file of files) {
        const fileNorm = norm(stripExt(file));
        if (fileNorm.includes(slugNorm)) {
          found = { folder, file };
          break;
        }
      }
      if (found) break;
    }

    if (!found) continue;

    const capaPath = `${found.folder}/${found.file}`;

    // Collect all images in the group (same base, no _fotox suffix → extras)
    const base       = norm(stripExt(found.file)).replace(/-capa$/, '');
    const allFiles   = folderIndex.get(found.folder);
    const groupFiles = [...allFiles]
      .filter(f => norm(stripExt(f)).startsWith(base))
      .sort()
      .map(f => `${found.folder}/${f}`);

    const allImages = groupFiles.length > 0 ? groupFiles : [capaPath];

    // Update imagem
    if (block.imagemIdx !== null) {
      lines[block.imagemIdx] = lines[block.imagemIdx].replace(
        /imagem:\s*'[^']+'/,
        `imagem: '${capaPath}'`
      );
    }

    // Update imagens
    if (block.imagensIdx !== null) {
      const indent = block.imagensIndent;
      lines[block.imagensIdx] =
        `${indent}imagens: [${allImages.map(i => `'${i}'`).join(', ')}],`;
    }

    discovered++;
  }

  return discovered;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           SYNC PRODUCT IMAGES — Universal                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const content     = fs.readFileSync(PRODUCTS_TS, 'utf8');
  const lines       = content.split('\n');
  const blocks      = parseProductBlocks(content);
  const folderIndex = buildFolderIndex();

  console.log(`🛒 Products parsed:         ${blocks.length}`);
  console.log(`📁 Image folders indexed:   ${folderIndex.size}`);
  const totalWebp = [...folderIndex.values()].reduce((s, v) => s + v.size, 0);
  console.log(`🖼  WebP files indexed:      ${totalWebp}\n`);

  // ── Passes ────────────────────────────────────────────────────────────────
  console.log('--- Pass 1: Fix non-webp extensions ---');
  const fixedExt  = pass1ExtensionFix(lines, blocks);
  console.log(`   Fixed: ${fixedExt} fields\n`);

  console.log('--- Pass 2: Backfill empty imagens[] ---');
  const filled    = pass2BackfillImagens(lines, blocks);
  console.log(`   Filled: ${filled} products\n`);

  console.log('--- Pass 3: Slug-based discovery ---');
  const discovered = pass3SlugDiscovery(lines, blocks, folderIndex);
  console.log(`   Discovered: ${discovered} products\n`);

  // ── Write ─────────────────────────────────────────────────────────────────
  const totalChanges = fixedExt + filled + discovered;
  if (totalChanges === 0) {
    console.log('✅ Nothing to update — already in sync.\n');
  } else {
    fs.writeFileSync(PRODUCTS_TS, lines.join('\n'), 'utf8');
    console.log(`✅ products.ts updated (${totalChanges} change(s)).\n`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const withPlaceholder = blocks.filter(b => !isReal(b.imagem)).length;
  const withImage       = blocks.filter(b => isReal(b.imagem)).length;

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    RELATÓRIO                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`✅ Extensões corrigidas (→.webp): ${fixedExt}`);
  console.log(`✅ imagens[] preenchidos:          ${filled}`);
  console.log(`✅ Produtos descobertos via slug:   ${discovered}`);
  console.log(`\n📊 Estado final:`);
  console.log(`   Com imagem real:    ${withImage}`);
  console.log(`   Com placeholder:    ${withPlaceholder}`);
  console.log(`   Total produtos:     ${blocks.length}\n`);
}

main();
