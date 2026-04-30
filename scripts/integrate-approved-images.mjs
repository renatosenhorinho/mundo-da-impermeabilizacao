import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CONFIGURATION ──────────────────────────────────────────────────────────

const BASE_DIR = path.resolve(__dirname, '..');
const REVISION_DIR = path.join(__dirname, 'imgs');
const PRODUCTS_DIR = path.join(BASE_DIR, 'public', 'images', 'products');
const BUFFER_JSON_PATH = path.join(__dirname, 'products-buffer.json');

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// ─── HELPERS ────────────────────────────────────────────────────────────────

function getBaseSlug(filename) {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  const match = name.match(/^(.+?)(-\d+)?$/);
  return match ? match[1] : name;
}

function scanDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, fileList);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext) && !entry.name.startsWith('placeholder')) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Iniciando Integração de Imagens Aprovadas\n');

  if (!fs.existsSync(BUFFER_JSON_PATH)) {
    console.error(`❌ Erro: ${BUFFER_JSON_PATH} não encontrado.`);
    process.exit(1);
  }

  const expectedProducts = JSON.parse(fs.readFileSync(BUFFER_JSON_PATH, 'utf-8'));
  const validSlugs = new Set(expectedProducts.map(p => p.slug));
  const categoryMap = new Map();
  expectedProducts.forEach(p => categoryMap.set(p.slug, p.category));

  if (!fs.existsSync(REVISION_DIR)) {
    console.error(`❌ Erro: Pasta de revisão ${REVISION_DIR} não encontrada.`);
    process.exit(1);
  }

  const sourceFiles = scanDir(REVISION_DIR);
  console.log(`📦 Encontrados ${sourceFiles.length} arquivos na pasta de revisão.\n`);

  const stats = {
    copied: 0,
    overwritten: 0,
    skipped: 0,
    unrecognized: 0,
  };

  const processedSlugs = new Set();
  const unrecognizedFiles = [];

  for (const srcPath of sourceFiles) {
    const filename = path.basename(srcPath);
    const baseSlug = getBaseSlug(filename);

    if (!validSlugs.has(baseSlug)) {
      stats.unrecognized++;
      unrecognizedFiles.push(filename);
      continue;
    }

    const category = categoryMap.get(baseSlug);
    if (!category) {
      console.warn(`⚠️ Categoria não encontrada para o slug: ${baseSlug}. Pulando arquivo.`);
      stats.skipped++;
      continue;
    }

    const targetDir = path.join(PRODUCTS_DIR, category);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, filename);
    processedSlugs.add(baseSlug);

    if (fs.existsSync(targetPath)) {
      const srcStats = fs.statSync(srcPath);
      const tgtStats = fs.statSync(targetPath);
      
      // Checa se o conteúdo/tamanho é o mesmo para evitar sobrescritas idênticas, 
      // mas se force, substitui para garantir a "prioridade".
      if (srcStats.size !== tgtStats.size || srcStats.mtimeMs > tgtStats.mtimeMs) {
        fs.copyFileSync(srcPath, targetPath);
        console.log(`  🔄 Sobrescrito: ${category}/${filename}`);
        stats.overwritten++;
      } else {
        console.log(`  ⏩ Ignorado (idêntico): ${category}/${filename}`);
        stats.skipped++;
      }
    } else {
      fs.copyFileSync(srcPath, targetPath);
      console.log(`  ✅ Copiado: ${category}/${filename}`);
      stats.copied++;
    }
  }

  // Verificar quantos produtos de products-buffer não receberam ou não tinham imagem
  let missingImagesCount = 0;
  expectedProducts.forEach(p => {
    if (!processedSlugs.has(p.slug)) {
      missingImagesCount++;
    }
  });

  console.log(`\n🏁 Integração Concluída!`);
  console.log(`----------------------------------------`);
  console.log(`📊 Relatório de Integração:`);
  console.log(`   - Arquivos copiados (novos):      ${stats.copied}`);
  console.log(`   - Arquivos sobrescritos (update): ${stats.overwritten}`);
  console.log(`   - Arquivos ignorados (idênticos): ${stats.skipped}`);
  console.log(`   - Arquivos não reconhecidos:      ${stats.unrecognized}`);
  console.log(`   - Produtos totais cobertos:       ${processedSlugs.size} de ${expectedProducts.length}`);
  console.log(`   - Produtos sem imagens:           ${missingImagesCount}`);
  
  if (stats.unrecognized > 0) {
    console.log(`\n⚠️ Arquivos com slug inválido:`);
    unrecognizedFiles.slice(0, 10).forEach(f => console.log(`   - ${f}`));
    if (unrecognizedFiles.length > 10) console.log(`   ... e mais ${unrecognizedFiles.length - 10}`);
  }
  console.log(`----------------------------------------`);
  console.log(`\nAs imagens foram preparadas em: public/images/products/ e prontas para rodar o pipeline final quando desejar.\n`);
}

main().catch(err => {
  console.error('\n💥 Erro fatal:', err);
  process.exit(1);
});
