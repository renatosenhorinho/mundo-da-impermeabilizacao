/**
 * ─────────────────────────────────────────────────────────────────────────────
 * process-product-images.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Script de processamento automático de imagens de produtos.
 *
 * Funcionalidades:
 *   1. Detecção: Encontra e processa imagens (.jpg, .jpeg, .png, .webp) 
 *      soltas na pasta public/images/products/ ou em subpastas.
 *   2. Identificação: Lê o slug no nome e descobre a categoria correta 
 *      verificando o arquivo src/data/products.ts.
 *   3. Padronização e Movimentação: Move para public/images/products/[categoria]/
 *   4. Conversão: Para .webp com qualidade 75-80.
 *   5. Responsividade: Gera [slug]-400w.webp e [slug]-800w.webp.
 *   6. Integração: Atualiza product-images.json para o carrossel.
 *   7. Limpeza: Remove as versões .jpg/.png originais.
 *   8. Segurança: Preserva o que já está nos padrões.
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuração ────────────────────────────────────────────────────────────

const PRODUCTS_DIR = path.resolve(__dirname, 'public/images/products');
const IMAGES_JSON_PATH = path.resolve(__dirname, 'src/data/product-images.json');
const PRODUCTS_TS_PATH = path.resolve(__dirname, 'src/data/products.ts');

const WEBP_QUALITY = 78;
const RESPONSIVE_SIZES = [400, 800];
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const CATEGORY_FOLDERS = [
  'impermeabilizantes-cimenticios',
  'manta-liquida',
  'manta-asfaltica',
  'primer',
  'fitas-aluminizadas',
  'selantes',
  'aditivos',
  'adesivos-e-epoxi',
  'graute-e-reparacao-estrutural',
  'desmoldantes-e-cura',
  'drenagem-e-geotexteis',
  'ferramentas-e-acessorios',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[IMG] ${msg}`); }
function warn(msg) { console.warn(`[IMG ⚠️] ${msg}`); }
function success(msg) { console.log(`[IMG ✅] ${msg}`); }

function isResponsiveVariant(filename) {
  return /-\d+w\.webp$/.test(filename);
}

function getBaseSlug(filename) {
  if (isResponsiveVariant(filename)) return null;
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  // Captura o slug base, ignorando "-2", "-3", etc. no final
  const match = name.match(/^(.+?)(-\d+)?$/);
  return match ? match[1] : name;
}

// ─── Mapeamento Slug -> Categoria ────────────────────────────────────────────

function buildSlugMap() {
  log('Mapeando slugs e categorias com base em products.ts...');
  const map = new Map();
  
  if (!fs.existsSync(PRODUCTS_TS_PATH)) {
    warn('Arquivo products.ts não encontrado. O mapeamento pode falhar.');
    return map;
  }

  const content = fs.readFileSync(PRODUCTS_TS_PATH, 'utf-8');
  
  // Regex simples para capturar blocos com slug e categoria
  // Ex: slug: generateSlug('...'),\n    categoria: 'manta-liquida',
  // Ou: slug: 'meu-slug',\n    categoria: 'manta-liquida',
  
  // Vamos buscar todos os slugs gerados manualmente se houver
  const lines = content.split('\n');
  let currentSlug = null;
  let currentCat = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Identificar slug
    if (line.includes('slug: generateSlug(')) {
       const match = line.match(/generateSlug\(['"](.+?)['"]\)/);
       if(match) {
         // Lógica de generateSlug em products.ts
         currentSlug = match[1]
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, ' ')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/(^-|-$)/g, '');
       }
    } else if (line.match(/slug:\s*['"](.+?)['"]/)) {
       currentSlug = line.match(/slug:\s*['"](.+?)['"]/)[1];
    }
    
    // Identificar categoria e associar ao último slug visto
    if (line.match(/categoria:\s*['"](.+?)['"]/)) {
       currentCat = line.match(/categoria:\s*['"](.+?)['"]/)[1];
       if (currentSlug) {
         map.set(currentSlug, currentCat);
         currentSlug = null; // reseta
         currentCat = null;
       }
    }
  }

  log(`Mapeados ${map.size} produtos a partir do products.ts.`);
  return map;
}

// ─── Etapa 1: Pastas Base ────────────────────────────────────────────────────

function createCategoryFolders() {
  for (const folder of CATEGORY_FOLDERS) {
    const folderPath = path.join(PRODUCTS_DIR, folder);
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
  }
}

// ─── Etapa 2: Scan e Move (Pré-processamento) ────────────────────────────────

/**
 * Escaneia, localiza imagens novas e já move para a pasta correta da categoria
 * ANTES de converter.
 */
function scanAndOrganizeImages(slugMap) {
  const allFiles = [];
  
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext) && !entry.name.startsWith('placeholder')) {
          allFiles.push(fullPath);
        }
      }
    }
  }

  scanDir(PRODUCTS_DIR);
  const toProcess = [];

  for (const filePath of allFiles) {
    const filename = path.basename(filePath);
    if (isResponsiveVariant(filename)) continue;

    const baseSlug = getBaseSlug(filename);
    
    // Acha a categoria apropriada; default para a própria pasta caso não ache no map, 
    // e se estiver na raiz, cai numa pasta 'uncategorized' (ou manta-liquida por dedução)
    let category = slugMap.get(baseSlug);
    
    if (!category) {
      // Se a imagem já está dentro de uma pasta de categoria válida, mantém.
      const parentDirName = path.basename(path.dirname(filePath));
      if (CATEGORY_FOLDERS.includes(parentDirName)) {
        category = parentDirName;
      } else {
        warn(`Categoria não encontrada para '${baseSlug}'.`);
        category = 'uncategorized';
        if (!fs.existsSync(path.join(PRODUCTS_DIR, category))) {
          fs.mkdirSync(path.join(PRODUCTS_DIR, category));
        }
      }
    }

    const targetDir = path.join(PRODUCTS_DIR, category);
    const targetPath = path.join(targetDir, filename);

    // Mover arquivo se estiver no lugar errado
    if (filePath !== targetPath) {
       fs.renameSync(filePath, targetPath);
       log(`  📦 Movido: ${filename} → ${category}/`);
       toProcess.push(targetPath);
    } else {
       toProcess.push(filePath);
    }
  }

  return toProcess;
}

// ─── Etapa 3: Converter para WebP ────────────────────────────────────────────

async function convertToWebp(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  
  if (ext === '.webp') return inputPath;

  const dir = path.dirname(inputPath);
  const name = path.basename(inputPath, ext);
  const outputPath = path.join(dir, `${name}.webp`);

  if (fs.existsSync(outputPath)) {
    return outputPath;
  }

  log(`  🔄 Convertendo: ${path.basename(inputPath)} → ${name}.webp`);

  const inputBuffer = fs.readFileSync(inputPath);
  const outputBuffer = await sharp(inputBuffer)
    .webp({ quality: WEBP_QUALITY, effort: 6 })
    .toBuffer();

  fs.writeFileSync(outputPath, outputBuffer);

  // Remover original (JPG, PNG)
  fs.unlinkSync(inputPath);
  log(`  🗑️  Removido original: ${path.basename(inputPath)}`);

  return outputPath;
}

// ─── Etapa 4: Gerar Responsivos ──────────────────────────────────────────────

async function generateResponsiveVariants(webpPath) {
  const dir = path.dirname(webpPath);
  const name = path.basename(webpPath, '.webp');
  let generated = 0;

  const inputBuffer = fs.readFileSync(webpPath);
  const metadata = await sharp(inputBuffer).metadata();

  for (const width of RESPONSIVE_SIZES) {
    const outputPath = path.join(dir, `${name}-${width}w.webp`);
    if (fs.existsSync(outputPath)) continue;

    if (metadata.width && metadata.width <= width) {
      fs.writeFileSync(outputPath, await sharp(inputBuffer).webp({ quality: WEBP_QUALITY }).toBuffer());
    } else {
      fs.writeFileSync(outputPath, await sharp(inputBuffer).resize({ width, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY, effort: 6 }).toBuffer());
    }
    
    generated++;
    log(`  📐 Gerado: ${name}-${width}w.webp`);
  }

  return generated;
}

// ─── Etapa 5: Atualizar JSON ─────────────────────────────────────────────────

function buildProductImagesJson() {
  log('Construindo product-images.json...');
  const imagesMap = {};

  for (const folder of [...CATEGORY_FOLDERS, 'uncategorized']) {
    const folderPath = path.join(PRODUCTS_DIR, folder);
    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath)
      .filter(f => f.endsWith('.webp') && !isResponsiveVariant(f))
      .sort();

    const slugGroups = {};
    for (const file of files) {
      const ext = path.extname(file);
      const name = path.basename(file, ext);
      const match = name.match(/^(.+?)(-(\d+))?$/);
      const baseSlug = match ? match[1] : name;
      const index = match && match[3] ? parseInt(match[3], 10) : 1;

      if (!slugGroups[baseSlug]) slugGroups[baseSlug] = [];
      slugGroups[baseSlug].push({ index, path: `/images/products/${folder}/${file}` });
    }

    for (const [slug, images] of Object.entries(slugGroups)) {
      imagesMap[slug] = images.sort((a, b) => a.index - b.index).map(img => img.path);
    }
  }

  fs.writeFileSync(IMAGES_JSON_PATH, JSON.stringify(imagesMap, null, 2));
  return imagesMap;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Iniciando processamento de imagens...\n');

  createCategoryFolders();
  const slugMap = buildSlugMap();
  const imagesToProcess = scanAndOrganizeImages(slugMap);
  
  let convertidos = 0;
  let responsivos = 0;
  let pulados = 0;

  for (const imgPath of imagesToProcess) {
    const webpPath = await convertToWebp(imgPath);
    if (webpPath !== imgPath) convertidos++; else pulados++;
    
    const count = await generateResponsiveVariants(webpPath);
    responsivos += count;
  }

  const json = buildProductImagesJson();
  
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(' 📊 RELATÓRIO DE PROCESSAMENTO DE IMAGENS');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  🔍 Imagens mapeadas:       ${imagesToProcess.length}`);
  console.log(`  🔄 Novas conversões WebP:  ${convertidos}`);
  console.log(`  📐 Responsivos gerados:    ${responsivos}`);
  console.log(`  ⏭️ Já otimizadas/puladas: ${pulados}`);
  console.log(`  📦 Produtos no JSON:       ${Object.keys(json).length}`);
  console.log('════════════════════════════════════════════════════════════\n');
  
  success('Processamento concluído com sucesso!');
}

main().catch(console.error);
