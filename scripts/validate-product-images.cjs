/**
 * scripts/validate-product-images.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-build validator for product images.
 *
 * Reads all imagem/imagens references from products.ts and validates:
 *   ✔ File exists on disk
 *   ✔ Extension is .webp (warns on legacy formats)
 *   ✔ No placeholder paths on active products
 *   ✔ No orphan images (webp files with no product referencing them)
 *   ✔ No broken imagens[] arrays
 *
 * Usage:
 *   node scripts/validate-product-images.cjs           → exits 0 if clean
 *   node scripts/validate-product-images.cjs --strict  → exits 1 on any warning
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
const STRICT      = process.argv.includes('--strict');

// ── Parse products.ts ────────────────────────────────────────────────────────

function parseProducts(content) {
  const lines    = content.split('\n');
  const products = [];

  for (let i = 0; i < lines.length; i++) {
    const nomeMatch = lines[i].match(/^\s+nome:\s*'([^']+)'/);
    if (!nomeMatch) continue;

    const product = {
      nome    : nomeMatch[1],
      ativo   : true,
      imagem  : null,
      imagens : [],
      line    : i + 1,
    };

    for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
      const imgMatch  = lines[j].match(/^\s+imagem:\s*'([^']+)'/);
      const imgsMatch = lines[j].match(/^\s+imagens:\s*\[([^\]]+)\]/);
      const ativoFalse = lines[j].match(/^\s+ativo:\s*false/);

      if (imgMatch)    product.imagem  = imgMatch[1];
      if (ativoFalse)  product.ativo   = false;
      if (imgsMatch) {
        product.imagens = imgsMatch[1]
          .split(',')
          .map(s => s.trim().replace(/^'|'$/g, ''))
          .filter(Boolean);
      }

      if (lines[j].trim() === '},') break;
    }

    products.push(product);
  }

  return products;
}

// ── Walk public dir for all webp images ──────────────────────────────────────

function collectWebpFiles(dir, results = new Set()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectWebpFiles(fullPath, results);
    } else if (/\.webp$/i.test(entry.name)) {
      // Convert to web path: /images/products/...
      const rel = fullPath.replace(PUBLIC_DIR, '').replace(/\\/g, '/');
      results.add(rel);
    }
  }
  return results;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(products, webpFiles) {
  const errors   = [];
  const warnings = [];
  const referencedPaths = new Set();

  for (const p of products) {
    const { nome, ativo, imagem, imagens, line } = p;
    const tag = `L${line}: "${nome}"`;

    // ── imagem field ──────────────────────────────────────────────────────
    if (!imagem) {
      errors.push(`${tag} — campo 'imagem' ausente`);
    } else {
      referencedPaths.add(imagem);

      if (imagem === PLACEHOLDER) {
        if (ativo) warnings.push(`${tag} — usando placeholder (produto ativo)`);
      } else {
        const diskPath = path.join(PUBLIC_DIR, imagem.replace(/\//g, path.sep));
        if (!fs.existsSync(diskPath)) {
          errors.push(`${tag} — imagem não existe em disco: ${imagem}`);
        } else if (!/\.webp$/i.test(imagem)) {
          warnings.push(`${tag} — imagem não é WebP: ${path.basename(imagem)}`);
        }
      }
    }

    // ── imagens[] field ───────────────────────────────────────────────────
    if (imagens.length === 0) {
      warnings.push(`${tag} — campo 'imagens[]' vazio`);
    } else {
      for (const imgPath of imagens) {
        referencedPaths.add(imgPath);
        if (imgPath === PLACEHOLDER) continue;

        const diskPath = path.join(PUBLIC_DIR, imgPath.replace(/\//g, path.sep));
        if (!fs.existsSync(diskPath)) {
          errors.push(`${tag} — imagens[] contém path inexistente: ${imgPath}`);
        } else if (!/\.webp$/i.test(imgPath)) {
          warnings.push(`${tag} — imagens[] contém não-WebP: ${path.basename(imgPath)}`);
        }
      }
    }
  }

  // ── Orphan images ─────────────────────────────────────────────────────────
  const orphans = [...webpFiles].filter(f => {
    if (f.includes('placeholder')) return false;
    return !referencedPaths.has(f);
  });

  return { errors, warnings, orphans, referencedPaths };
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              VALIDATE PRODUCT IMAGES                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const content  = fs.readFileSync(PRODUCTS_TS, 'utf8');
  const products = parseProducts(content);
  const webpFiles = collectWebpFiles(path.join(PUBLIC_DIR, 'images', 'products'));

  console.log(`🛒 Produtos no catálogo:    ${products.length}`);
  console.log(`📁 Arquivos WebP em disco:  ${webpFiles.size}\n`);

  const { errors, warnings, orphans } = validate(products, webpFiles);

  // ── Results ───────────────────────────────────────────────────────────────

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Tudo válido — nenhum erro encontrado!\n');
  }

  if (errors.length > 0) {
    console.log(`❌ ERROS (${errors.length}):`);
    errors.forEach(e => console.log(`   ✗ ${e}`));
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`⚠️  AVISOS (${warnings.length}):`);
    warnings.forEach(w => console.log(`   ! ${w}`));
    console.log();
  }

  if (orphans.length > 0) {
    console.log(`🔴 IMAGENS ÓRFÃS sem produto (${orphans.length}):`);
    orphans.slice(0, 20).forEach(o => console.log(`   • ${o}`));
    if (orphans.length > 20) console.log(`   ... e mais ${orphans.length - 20} arquivo(s)`);
    console.log();
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const withPlaceholder = products.filter(p => p.imagem === PLACEHOLDER).length;
  const withRealImg     = products.filter(p => p.imagem && p.imagem !== PLACEHOLDER).length;

  console.log('📊 RESUMO:');
  console.log(`   Produtos com imagem real:   ${withRealImg}`);
  console.log(`   Produtos com placeholder:   ${withPlaceholder}`);
  console.log(`   Imagens órfãs:              ${orphans.length}`);
  console.log(`   Erros:                      ${errors.length}`);
  console.log(`   Avisos:                     ${warnings.length}`);

  const hasFailure = errors.length > 0 || (STRICT && warnings.length > 0);
  console.log(`\n${hasFailure ? '❌ Validação FALHOU' : '✅ Validação OK'}\n`);

  if (hasFailure) process.exit(1);
}

main();
