import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.resolve(__dirname, '..');
const PRODUCTS_TS = path.join(BASE_DIR, 'src', 'data', 'products.ts');
const IMAGES_JSON = path.join(BASE_DIR, 'src', 'data', 'product-images.json');
const PUBLIC_DIR = path.join(BASE_DIR, 'public');

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
  return items.map((item) => {
    const base = item.slug;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    if (count === 0) return item;
    return { ...item, slug: `${base}-${count + 1}` };
  });
}

function extractRawProducts(content) {
  const match = content.match(/const rawProducts: Product\[\] = \[([\s\S]+?)\];/);
  if (!match) return [];
  
  const block = match[1];
  // More robust splitting by { ... }
  const productStrings = block.split(/\},?\s*\{/);
  
  return productStrings.map(s => {
    const slugMatch = s.match(/slug:\s*(?:generateSlug\(['"](.+?)['"]\)|['"](.+?)['"])/);
    const imagemMatch = s.match(/imagem:\s*['"](.+?)['"]/);
    const nameMatch = s.match(/nome:\s*['"](.+?)['"]/);
    const statusMatch = s.match(/ativo:\s*(true|false)/);

    let rawSlug = slugMatch ? (slugMatch[1] || slugMatch[2]) : 'unknown';
    let slug = slugMatch && slugMatch[0].includes('generateSlug') ? generateSlug(rawSlug) : rawSlug;

    return {
      slug,
      imagem: imagemMatch ? imagemMatch[1] : undefined,
      nome: nameMatch ? nameMatch[1] : 'unknown',
      ativo: statusMatch ? statusMatch[1] === 'true' : true
    };
  });
}

async function diagnose() {
  console.log('🧪 Iniciando diagnóstico de conexão de imagens...\n');

  const content = fs.readFileSync(PRODUCTS_TS, 'utf-8');
  const rawProducts = extractRawProducts(content);
  const activeProducts = deduplicateSlugs(rawProducts.filter(p => p.ativo));
  const imagesMetadata = JSON.parse(fs.readFileSync(IMAGES_JSON, 'utf-8'));

  console.log(`📊 Produtos ativos no TS: ${activeProducts.length}`);
  console.log(`📊 Chaves no JSON: ${Object.keys(imagesMetadata).length}\n`);

  let matches = 0;
  let mismatches = [];
  let blockingImages = [];

  activeProducts.slice(0, 500).forEach(p => {
    const metaImagens = imagesMetadata[p.slug];
    
    if (metaImagens && metaImagens.length > 0) {
      matches++;
      // Check if p.imagem is a "blocker" (non-svg, non-empty)
      if (p.imagem && !p.imagem.endsWith('.svg') && !p.imagem.includes('placeholder')) {
         // It might be blocking unless it's already the right image
         blockingImages.push({ slug: p.slug, imagem: p.imagem });
      }
    } else {
      mismatches.push(p.slug);
    }
  });

  console.log(`✅ Slugs que batem com o JSON: ${matches}`);
  console.log(`❌ Slugs que NÃO batem: ${mismatches.length}`);
  console.log(`🚫 Produtos com imagem fixa no TS (podem bloquear o JSON): ${blockingImages.length}\n`);

  if (mismatches.length > 0) {
    console.log('⚠️ Primeiros 10 slugs sem correspondência no JSON:');
    mismatches.slice(0, 10).forEach(s => console.log(`  - ${s}`));
  }

  // Check some specific examples
  console.log('\n🔍 Exemplo específico: manta-asfaltica-vedacit-3mm');
  const exSlug = 'manta-asfaltica-vedacit-3mm';
  console.log(`  - No JSON? ${!!imagesMetadata[exSlug]}`);
  if (imagesMetadata[exSlug]) {
    console.log(`  - Caminhos: ${imagesMetadata[exSlug].join(', ')}`);
    const filePath = path.join(PUBLIC_DIR, imagesMetadata[exSlug][0]);
    console.log(`  - Arquivo existe em ${filePath}? ${fs.existsSync(filePath)}`);
  }
}

diagnose().catch(console.error);
