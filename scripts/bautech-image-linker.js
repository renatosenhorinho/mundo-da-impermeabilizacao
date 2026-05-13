/**
 * BAUTECH Image Auto-Linker
 * ─────────────────────────────────────────────────────────────
 * Scans /public/images/products/BAUTECH/, matches images to
 * Bautech products in src/data/products.ts by smart name
 * matching, then updates imagem + imagens fields in-place.
 *
 * SAFE: Only modifies placeholder → real image.
 *       Never touches slugs, ids, analytics, variations.
 * ─────────────────────────────────────────────────────────────
 */

const fs   = require('fs');
const path = require('path');

// ── Paths ───────────────────────────────────────────────────────
const ROOT         = path.resolve(__dirname, '..');
const BAUTECH_DIR  = path.join(ROOT, 'public', 'images', 'products', 'BAUTECH');
const PRODUCTS_TS  = path.join(ROOT, 'src', 'data', 'products.ts');
const WEB_PREFIX   = '/images/products/BAUTECH/';
const PLACEHOLDER  = '/images/products/placeholder.webp';

// ── Normalize for fuzzy matching ────────────────────────────────
function norm(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[_\-\s]+/g, ' ')       // normalize separators
    .replace(/[^a-z0-9 ]/g, '')      // remove special chars
    .trim();
}

// ── Score: how many tokens from needle appear in haystack ───────
function matchScore(needle, haystack) {
  const nTokens = norm(needle).split(' ').filter(Boolean);
  const hNorm   = norm(haystack);
  const matched = nTokens.filter(t => hNorm.includes(t));
  return matched.length / nTokens.length;
}

// ── Load all BAUTECH images, grouped by "base name" (no _foto/N)─
function loadBautechImages() {
  const files = fs.readdirSync(BAUTECH_DIR)
    .filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f));

  // Group: { baseKey → { capa: file, extras: [file,...] } }
  const groups = {};

  for (const file of files) {
    // Strip extension
    const noExt = file.replace(/\.(webp|png|jpg|jpeg)$/i, '');
    // Detect capa vs fotox
    const isCapaMatch  = noExt.match(/_capa$/i);
    const isFotoMatch  = noExt.match(/_foto(\d+)$/i);

    let base;
    if (isCapaMatch) {
      base = noExt.replace(/_capa$/i, '');
    } else if (isFotoMatch) {
      base = noExt.replace(/_foto\d+$/i, '');
    } else {
      base = noExt;
    }

    if (!groups[base]) groups[base] = { capa: null, extras: [] };

    if (isCapaMatch || (!isCapaMatch && !isFotoMatch)) {
      groups[base].capa = file;
    } else {
      groups[base].extras.push(file);
    }
  }

  // Sort extras by foto number
  for (const g of Object.values(groups)) {
    g.extras.sort((a, b) => {
      const na = parseInt((a.match(/_foto(\d+)/i) || [])[1] || '99');
      const nb = parseInt((b.match(/_foto(\d+)/i) || [])[1] || '99');
      return na - nb;
    });
  }

  return { files, groups };
}

// ── Build product list from products.ts ─────────────────────────
function loadBautechProducts(content) {
  const lines = content.split('\n');
  const products = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Match product nome lines containing 'Bautech'
    const nomeMatch = l.match(/nome:\s*'(Bautech[^']+)'/);
    if (!nomeMatch) continue;

    const nome = nomeMatch[1];
    // Look ahead for imagem field (within 30 lines)
    for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
      const imgMatch = lines[j].match(/imagem:\s*'([^']+)'/);
      if (imgMatch) {
        const currentImg = imgMatch[1];
        const isPlaceholder = currentImg.includes('placeholder');
        products.push({
          nome,
          imagemLine: j,        // 0-indexed
          currentImg,
          isPlaceholder,
        });
        break;
      }
    }
  }

  return products;
}

// ── Find imagens[] block for a product ──────────────────────────
function findImagensLine(content, imagemLineIndex) {
  const lines = content.split('\n');
  // Look ahead from imagemLine for imagens field
  for (let i = imagemLineIndex + 1; i < Math.min(imagemLineIndex + 5, lines.length); i++) {
    if (lines[i].match(/imagens:\s*\[/)) return i;
  }
  return -1;
}

// ── Main ─────────────────────────────────────────────────────────
function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║       BAUTECH IMAGE AUTO-LINKER                      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const { files, groups } = loadBautechImages();
  console.log(`📁 BAUTECH images found: ${files.length}`);
  console.log(`   Image groups: ${Object.keys(groups).length}\n`);

  let content = fs.readFileSync(PRODUCTS_TS, 'utf8');
  const bautechProducts = loadBautechProducts(content);

  console.log(`🛒 Bautech products in catalog: ${bautechProducts.length}\n`);

  const report = {
    linked: [],
    alreadyOk: [],
    noMatch: [],
    orphanImages: [],
  };

  const usedGroups = new Set();

  // For each product, find the best matching image group
  for (const prod of bautechProducts) {
    if (!prod.isPlaceholder) {
      report.alreadyOk.push(prod.nome);
      console.log(`✅ Already OK: ${prod.nome}`);
      continue;
    }

    // Score all groups
    let bestScore = 0;
    let bestGroup = null;
    let bestBase  = null;

    for (const [base, group] of Object.entries(groups)) {
      const score = matchScore(base, prod.nome);
      if (score > bestScore) {
        bestScore = score;
        bestGroup = group;
        bestBase  = base;
      }
    }

    const THRESHOLD = 0.4;

    if (bestScore < THRESHOLD || !bestGroup || !bestGroup.capa) {
      report.noMatch.push(prod.nome);
      console.log(`❌ No match (score=${bestScore.toFixed(2)}): ${prod.nome}`);
      continue;
    }

    usedGroups.add(bestBase);

    const capaPath  = WEB_PREFIX + bestGroup.capa;
    const allImages = [bestGroup.capa, ...bestGroup.extras].map(f => WEB_PREFIX + f);

    console.log(`🔗 MATCH (score=${bestScore.toFixed(2)}): ${prod.nome}`);
    console.log(`   → capa:  ${capaPath}`);
    console.log(`   → imgs:  [${allImages.join(', ')}]\n`);

    // Build replacement
    const escapedOld = prod.currentImg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace imagem field
    const newImagem  = `  imagem: '${capaPath}',`;
    content = content.replace(
      new RegExp(`(\\s*)imagem:\\s*'${escapedOld}',`),
      (match, spaces) => `${spaces}imagem: '${capaPath}',`
    );

    // Replace imagens[] field if exists, else we leave it (field may not exist on all products)
    const imagensPattern = /(\s*)imagens:\s*\[[^\]]*\],/;
    // We need to do a targeted replacement near the imagem line
    // Strategy: replace the imagens array that follows this imagem line
    const lines = content.split('\n');
    // Re-find imagemLine since content changed
    for (let li = 0; li < lines.length; li++) {
      if (lines[li].includes(`'${capaPath}'`) && lines[li].includes('imagem:')) {
        // Check next few lines for imagens
        for (let j = li + 1; j < Math.min(li + 5, lines.length); j++) {
          if (lines[j].match(/imagens:\s*\[/)) {
            // Replace entire imagens line (handles both inline arrays)
            const indent = lines[j].match(/^(\s*)/)[1];
            lines[j] = `${indent}imagens: [${allImages.map(p => `'${p}'`).join(', ')}],`;
            break;
          }
        }
        content = lines.join('\n');
        break;
      }
    }

    report.linked.push({ nome: prod.nome, capa: capaPath, count: allImages.length });
  }

  // Find orphan images (groups not matched to any product)
  for (const [base, group] of Object.entries(groups)) {
    if (!usedGroups.has(base)) {
      report.orphanImages.push({ base, file: group.capa });
    }
  }

  // Write updated file
  fs.writeFileSync(PRODUCTS_TS, content, 'utf8');

  // ── REPORT ────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║                RELATÓRIO FINAL                       ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log(`✅ Imagens vinculadas:        ${report.linked.length}`);
  report.linked.forEach(r => console.log(`   • ${r.nome} → ${r.capa} (${r.count} img)`));

  console.log(`\n⚠️  Produtos sem match:        ${report.noMatch.length}`);
  report.noMatch.forEach(n => console.log(`   • ${n}`));

  console.log(`\n🟢 Produtos já com imagem:    ${report.alreadyOk.length}`);
  report.alreadyOk.forEach(n => console.log(`   • ${n}`));

  console.log(`\n🔴 Imagens órfãs (sem prod):  ${report.orphanImages.length}`);
  report.orphanImages.forEach(o => console.log(`   • ${o.base} → ${o.file}`));

  console.log(`\n📋 Total BAUTECH imagens:     ${files.length}`);
  console.log(`📋 Total BAUTECH produtos:    ${bautechProducts.length}`);
  console.log(`\n✅ products.ts atualizado com sucesso!\n`);
}

main();
