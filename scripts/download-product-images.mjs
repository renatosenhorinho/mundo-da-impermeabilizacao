import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── CONFIGURATION ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.resolve(__dirname, '..');
const PRODUCTS_TS_PATH = path.join(BASE_DIR, 'src', 'data', 'products.ts');
const BUFFER_JSON_PATH = path.join(BASE_DIR, 'scripts', 'products-buffer.json');
const RAW_IMAGES_DIR = path.join(BASE_DIR, 'public', 'images', 'raw');
const REVISION_BASE_DIR = path.join(__dirname, 'imgs');
const REPORT_PATH = path.join(BASE_DIR, 'scripts', 'download-report.json');

const DEFAULT_LIMIT = 999;
const DEFAULT_PER_PRODUCT = 3;
const DELAY_MS = 1500; // 1.5s entre produtos

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
};

const TRUSTED_DOMAINS = [
  'vedacit.com.br', 'viapol.com.br', 'sika.com', 'denverimper.com.br', 
  'quartzolit.weber', 'dryko.com.br', 'soprema.com.br', 'mapei.com', 
  'mcc-ltd.com', 'basf.com'
];

// ─── HELPERS ────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Tenta ler os produtos de um buffer JSON ou faz parse manual do products.ts
 */
async function loadProducts() {
  if (fs.existsSync(BUFFER_JSON_PATH)) {
    console.log('📦 Carregando produtos do buffer JSON...');
    return JSON.parse(fs.readFileSync(BUFFER_JSON_PATH, 'utf-8'));
  }

  console.log('🔍 Analisando src/data/products.ts...');
  const content = fs.readFileSync(PRODUCTS_TS_PATH, 'utf-8');
  
  // Regex simples para capturar blocos de produtos ativos no rawProducts
  // Nota: Isso é um parser "pobre" mas funcional para o formato atual
  const products = [];
  const productBlocks = content.match(/\{[\s\S]*?ativo:\s*true[\s\S]*?\}/g) || [];

  for (const block of productBlocks) {
    const slugMatch = block.match(/slug:\s*(?:generateSlug\(['"](.*?)['"]\)|['"](.*?)['"])/);
    const nameMatch = block.match(/nome:\s*['"](.*?)['"]/);
    const brandMatch = block.match(/marca:\s*['"](.*?)['"]/);
    const catMatch = block.match(/categoria:\s*['"](.*?)['"]/);

    if (slugMatch && nameMatch && brandMatch) {
      products.push({
        slug: slugMatch[1] || slugMatch[2], // lida com generateSlug ou string pura
        name: nameMatch[1],
        brand: brandMatch[1],
        category: catMatch ? catMatch[1] : 'geral'
      });
    }
  }

  return products;
}

/**
 * Motor de busca desacoplado (Bing)
 */
async function searchImages(query) {
  try {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC3`;
    const response = await fetch(searchUrl, { headers: HEADERS });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    
    const html = await response.text();
    const regex = /murl&quot;:&quot;(.*?)&quot;/g;
    const urls = [];
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      if (!match[1].startsWith('http')) continue;
      urls.push(match[1]);
      if (urls.length >= 10) break; // Pega os 10 primeiros candidatos
    }
    
    return urls;
  } catch (error) {
    console.error(`  ❌ Erro na busca: ${error.message}`);
    return [];
  }
}

/**
 * Heurística de filtragem
 */
function scoreUrl(url, brand, name) {
  let score = 0;
  const urlLower = url.toLowerCase();
  const b = normalize(brand);
  const n = normalize(name);

  // Bônus para domínios oficiais
  if (TRUSTED_DOMAINS.some(d => urlLower.includes(d))) score += 50;
  
  // Bônus para marca na URL
  if (urlLower.includes(b)) score += 30;
  
  // Bônus para partes do nome
  const nameParts = n.split(/\s+/).filter(p => p.length > 3);
  nameParts.forEach(p => {
    if (urlLower.includes(p)) score += 10;
  });

  // Penalidade para sites de bancos de imagens ou lixo
  if (urlLower.includes('shutterstock') || urlLower.includes('dreamstime') || urlLower.includes('istockphoto')) score -= 40;
  if (urlLower.match(/\.(gif|svg)$/)) score -= 100;
  if (urlLower.match(/logo|icone|mockup|vetor|vector|ilustracao|draw/i)) score -= 100;

  return score;
}

/**
 * Download de imagem
 */
async function downloadFile(url, targetPath) {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Verificação mínima de tamanho (ignora ícones/espaços em branco)
    if (buffer.length < 5000) throw new Error('Arquivo muito pequeno (<5kb)');
    
    fs.writeFileSync(targetPath, buffer);
    return true;
  } catch (error) {
    // console.error(`    ⚠️ Falha download: ${error.message}`);
    return false;
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const perProductArg = args.find(a => a.startsWith('--per-product='))?.split('=')[1];
  const categoryArg = args.find(a => a.startsWith('--category='))?.split('=')[1];
  const revisionArg = args.includes('--revision');

  const limit = limitArg ? parseInt(limitArg) : DEFAULT_LIMIT;
  const perProduct = perProductArg ? parseInt(perProductArg) : DEFAULT_PER_PRODUCT;

  console.log('🚀 Iniciando Pipeline de Download de Imagens');
  console.log(`📊 Config: limite=${limit}, por_produto=${perProduct}, categoria=${categoryArg || 'todas'}, revisão_manual=${revisionArg}`);

  let allProducts = await loadProducts();
  
  if (categoryArg) {
    allProducts = allProducts.filter(p => p.category === categoryArg);
  }

  const productsToProcess = allProducts.slice(0, limit);
  console.log(`✅ ${productsToProcess.length} produtos encontrados para processar.\n`);

  const report = [];
  const stats = {
    downloaded: 0,
    skipped: 0,
    notFound: 0,
    totalProducts: productsToProcess.length
  };
  
  const categoriesProcessed = new Set();
  const domainsUsed = {};

  for (let i = 0; i < productsToProcess.length; i++) {
    const p = productsToProcess[i];
    console.log(`[${i + 1}/${productsToProcess.length}] Processando: ${p.brand} ${p.name} (${p.slug})`);

    const query = `${p.brand} ${p.name} embalagem produto`;
    const candidates = await searchImages(query);
    
    const scored = candidates
      .map(url => ({ url, score: scoreUrl(url, p.brand, p.name) }))
      .sort((a, b) => b.score - a.score);

    const downloads = [];
    let successCount = 0;

    let currentOutputDir = RAW_IMAGES_DIR;
    if (categoryArg) {
      currentOutputDir = path.join(REVISION_BASE_DIR, categoryArg);
    } else if (revisionArg) {
      currentOutputDir = path.join(REVISION_BASE_DIR, p.category);
    }

    if (currentOutputDir !== RAW_IMAGES_DIR && !fs.existsSync(currentOutputDir)) {
      fs.mkdirSync(currentOutputDir, { recursive: true });
    }
    
    if (currentOutputDir !== RAW_IMAGES_DIR) {
      categoriesProcessed.add(p.category);
    }

    for (const item of scored) {
      if (successCount >= perProduct) break;
      
      const suffix = successCount === 0 ? '' : `-${successCount + 1}`;
      const fileName = `${p.slug}${suffix}.jpg`;
      const targetPath = path.join(currentOutputDir, fileName);

      // 1. Pular se já existir
      if (fs.existsSync(targetPath)) {
        console.log(`  ⏩ Já existe: ${fileName} (pulando)`);
        downloads.push({ url: item.url, file: fileName, status: 'skipped' });
        successCount++;
        stats.skipped++;
        continue;
      }

      process.stdout.write(`  ⬇️ Tentando candidato (score ${item.score}): ${item.url.substring(0, 60)}... `);
      
      const success = await downloadFile(item.url, targetPath);
      if (success) {
        const domain = new URL(item.url).hostname;
        domainsUsed[domain] = (domainsUsed[domain] || 0) + 1;
        
        downloads.push({ 
          url: item.url, 
          domain,
          file: fileName,
          status: 'downloaded' 
        });
        successCount++;
        stats.downloaded++;
        console.log('✅ OK');
      } else {
        console.log('❌ FALHOU');
      }
    }

    if (successCount === 0) {
      stats.notFound++;
    }

    report.push({
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      query,
      results: downloads,
      status: successCount > 0 ? 'success' : (candidates.length === 0 ? 'not_found' : 'error'),
      timestamp: new Date().toISOString()
    });

    if (i < productsToProcess.length - 1) {
      await delay(DELAY_MS);
    }
  }

  // Gravar relatório
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  
  console.log(`\n🏁 Pipeline Finalizado!`);
  console.log(`----------------------------------------`);
  console.log(`📊 Resumo:`);
  console.log(`   - Produtos processados: ${stats.totalProducts}`);
  console.log(`   - Novas imagens baixadas: ${stats.downloaded}`);
  console.log(`   - Imagens puladas (existentes): ${stats.skipped}`);
  console.log(`   - Produtos sem imagens encontradas: ${stats.notFound}`);
  
  if (revisionArg || categoryArg) {
    console.log(`   - Categorias processadas: ${Array.from(categoriesProcessed).join(', ') || categoryArg}`);
    console.log(`📂 As pastas de revisão foram geradas em: ${path.relative(process.cwd(), REVISION_BASE_DIR)}`);
  }
  
  console.log(`\n🌐 Principais origens de imagens:`);
  Object.entries(domainsUsed)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([domain, count]) => console.log(`   - ${domain}: ${count} imagem(ns)`));
    
  console.log(`----------------------------------------`);
  console.log(`📝 Relatório gerado em: scripts/download-report.json\n`);
}

main().catch(err => {
  console.error('\n💥 Erro fatal na execução:', err);
  process.exit(1);
});
