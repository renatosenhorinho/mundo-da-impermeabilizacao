/**
 * optimize-final-images.mjs — v2 (slug-first)
 *
 * ESTRATÉGIA CORRIGIDA:
 * - Extrai os slugs reais de src/data/products.ts (fonte da verdade)
 * - Descobre a categoria de cada produto para saber em qual pasta procurar
 * - Procura arquivos físicos em public/images/products/<categoria>/
 *   cujo nome começa com o slug (match exato de prefixo)
 * - Gera a chave JSON sempre com o slug do products.ts
 * - Converte para WebP e gera variantes responsivas 400w/800w
 * - Nunca reprocessa arquivos que já são variantes (-400w.webp, -800w.webp)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CONFIGURATION ──────────────────────────────────────────────────────────

const BASE_DIR = path.resolve(__dirname, '..');
const PRODUCTS_TS   = path.join(BASE_DIR, 'src', 'data', 'products.ts');
const PRODUCTS_DIR  = path.join(BASE_DIR, 'public', 'images', 'products');
const FINAL_PKG_DIR = path.join(__dirname, 'final-package');
const FINAL_IMG_DIR = path.join(FINAL_PKG_DIR, 'images', 'products');
const JSON_OUTPUT   = path.join(FINAL_PKG_DIR, 'product-images.json');

const WEBP_QUALITY    = 78;
const RESPONSIVE_WIDTHS = [400, 800];
const SOURCE_EXTS     = ['.jpg', '.jpeg', '.png', '.webp'];

// ─── SLUG HELPERS (mirror do products.ts) ───────────────────────────────────

function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function deduplicateSlugs(items) {
  const seen = new Map();
  return items.map(item => {
    const base = item.slug;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? item : { ...item, slug: `${base}-${count + 1}` };
  });
}

// ─── EXTRACT ACTIVE PRODUCTS FROM products.ts ───────────────────────────────

function extractActiveProducts(tsContent) {
  // Encontra o bloco rawProducts
  const match = tsContent.match(/const rawProducts: Product\[\] = \[([\s\S]+?)\];/);
  if (!match) throw new Error('Não encontrou rawProducts em products.ts');

  const block = match[1];
  // Separa entradas por }, { (com ou sem espaços/quebras)
  const entries = block.split(/\},?\s*\{/);

  const raw = [];
  for (const entry of entries) {
    const slugMatch = entry.match(/slug:\s*(?:generateSlug\(['"](.+?)['"]\)|['"](.+?)['"])/);
    const catMatch  = entry.match(/categoria:\s*['"](.+?)['"]/);
    const statusMatch = entry.match(/ativo:\s*(true|false)/);

    if (!slugMatch) continue;

    const rawSlug = slugMatch[1] || slugMatch[2];
    const slug = slugMatch[0].includes('generateSlug') ? generateSlug(rawSlug) : rawSlug;
    const categoria = catMatch ? catMatch[1] : null;
    const ativo = statusMatch ? statusMatch[1] === 'true' : true;

    if (ativo && slug && categoria) {
      raw.push({ slug, categoria });
    }
  }

  // Aplicar deduplicação igual ao products.ts
  // (ordena por categoria + ordem — não temos ordem aqui, mas a ordem de aparição é suficiente)
  return deduplicateSlugs(raw);
}

// ─── FILE DISCOVERY ─────────────────────────────────────────────────────────

/**
 * Para um dado slug e categoria, procura em public/images/products/<categoria>/
 * todos os arquivos cujo basicname (sem extensão) começa com o slug.
 *
 * Critérios de match:
 *   - filename sem extensão == slug (imagem principal)
 *   - filename sem extensão == slug + "-2", "-3", etc. (imagens adicionais do carrossel)
 *
 * NÃO inclui variantes responsivas (-400w, -800w) — essas são geradas, não copiadas.
 */
function findSourceFiles(slug, categoria) {
  const catDir = path.join(PRODUCTS_DIR, categoria);
  if (!fs.existsSync(catDir)) return [];

  const results = [];
  for (const file of fs.readdirSync(catDir)) {
    const ext = path.extname(file).toLowerCase();
    if (!SOURCE_EXTS.includes(ext)) continue;

    const baseName = path.basename(file, ext);

    // Excluir explicitamente variantes responsivas já existentes
    if (/-\d+w$/.test(baseName)) continue;

    // Match: nome == slug ou nome == slug-2, slug-3, ...
    if (baseName === slug || /^-\d+$/.test(baseName.slice(slug.length))) {
      // Confirmar que começa exatamente com o slug
      if (baseName === slug || (baseName.startsWith(slug) && /^-\d+$/.test(baseName.slice(slug.length)))) {
        results.push(path.join(catDir, file));
      }
    }
  }

  // Ordenar: slug principal primeiro, depois slug-2, slug-3...
  results.sort((a, b) => {
    const na = path.basename(a, path.extname(a));
    const nb = path.basename(b, path.extname(b));
    const ia = na === slug ? 0 : parseInt(na.replace(slug + '-', '')) || 999;
    const ib = nb === slug ? 0 : parseInt(nb.replace(slug + '-', '')) || 999;
    return ia - ib;
  });

  return results;
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 optimize-final-images.mjs v2 (slug-first)\n');

  // Limpar pacote anterior
  if (fs.existsSync(FINAL_PKG_DIR)) {
    fs.rmSync(FINAL_PKG_DIR, { recursive: true, force: true });
    console.log('🧹 Pacote anterior removido.');
  }
  fs.mkdirSync(FINAL_PKG_DIR, { recursive: true });

  // Ler products.ts
  console.log('📖 Lendo slugs de src/data/products.ts...');
  const tsContent = fs.readFileSync(PRODUCTS_TS, 'utf-8');
  const activeProducts = extractActiveProducts(tsContent);
  console.log(`   → ${activeProducts.length} produtos ativos extraídos.\n`);

  const imagesMap   = {};
  const stats = {
    withImages:    0,
    withoutImages: 0,
    filesConverted: 0,
    variantsGenerated: 0,
    noMatch: [],
  };

  for (const { slug, categoria } of activeProducts) {
    const sourceFiles = findSourceFiles(slug, categoria);

    if (sourceFiles.length === 0) {
      stats.withoutImages++;
      stats.noMatch.push({ slug, categoria });
      continue;
    }

    stats.withImages++;
    imagesMap[slug] = [];

    const targetDir = path.join(FINAL_IMG_DIR, categoria);
    fs.mkdirSync(targetDir, { recursive: true });

    for (const srcPath of sourceFiles) {
      const ext      = path.extname(srcPath);
      const baseName = path.basename(srcPath, ext);
      const webpName = `${baseName}.webp`;
      const destPath = path.join(targetDir, webpName);
      const publicUrl = `/images/products/${categoria}/${webpName}`;

      // Converter para WebP
      const inputBuf = fs.readFileSync(srcPath);
      const outputBuf = await sharp(inputBuf)
        .webp({ quality: WEBP_QUALITY, effort: 6 })
        .toBuffer();
      fs.writeFileSync(destPath, outputBuf);
      stats.filesConverted++;

      // Adicionar ao carrossel do slug
      imagesMap[slug].push(publicUrl);

      // Gerar variantes responsivas
      const metadata = await sharp(outputBuf).metadata();
      for (const w of RESPONSIVE_WIDTHS) {
        const respName = `${baseName}-${w}w.webp`;
        const respDest = path.join(targetDir, respName);
        const resized = metadata.width && metadata.width <= w
          ? await sharp(outputBuf).webp({ quality: WEBP_QUALITY }).toBuffer()
          : await sharp(outputBuf).resize({ width: w, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY, effort: 6 }).toBuffer();
        fs.writeFileSync(respDest, resized);
        stats.variantsGenerated++;
      }
    }

    process.stdout.write(`  ✅ ${slug} (${imagesMap[slug].length} foto(s))\n`);
  }

  // Salvar JSON
  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(imagesMap, null, 2));

  // ─── RELATÓRIO ────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('🏁 PACOTE FINAL GERADO — RELATÓRIO');
  console.log('════════════════════════════════════════');
  console.log(`  Produtos ativos no products.ts:   ${activeProducts.length}`);
  console.log(`  Produtos COM imagem (JSON entry):  ${stats.withImages}`);
  console.log(`  Produtos SEM imagem (sem match):   ${stats.withoutImages}`);
  console.log(`  Imagens principais convertidas:    ${stats.filesConverted}`);
  console.log(`  Variantes responsivas geradas:     ${stats.variantsGenerated}`);
  console.log(`\n  JSON salvo em: ${JSON_OUTPUT}`);
  console.log('════════════════════════════════════════');

  if (stats.noMatch.length > 0) {
    console.log(`\n⚠️  Slugs sem correspondência de arquivo (${stats.noMatch.length}):`)
    stats.noMatch.slice(0, 15).forEach(({ slug, categoria }) =>
      console.log(`    - [${categoria}] ${slug}`)
    );
    if (stats.noMatch.length > 15) console.log(`    ... e mais ${stats.noMatch.length - 15}`);
  }
}

main().catch(err => {
  console.error('\n💥 Erro fatal:', err);
  process.exit(1);
});
