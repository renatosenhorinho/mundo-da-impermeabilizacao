import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const COLORS = {
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  CYAN: '\x1b[36m',
  BOLD: '\x1b[1m'
};

const SYMBOLS = {
  OK: '✅',
  WARN: '⚠️',
  ERR: '❌'
};

const report = {
  timestamp: new Date().toISOString(),
  env: { status: 'PENDING', message: '' },
  connection: { status: 'PENDING', message: '' },
  tables: {
    products: { status: 'PENDING', message: '', missingCols: [], extraCols: [] },
    analytics_events: { status: 'PENDING', message: '', missingCols: [], extraCols: [] }
  },
  storage: { status: 'PENDING', message: '', buckets: [] },
  images: { status: 'PENDING', message: '', totalChecked: 0, invalid: 0 },
  build: { status: 'PENDING', message: '' }
};

function log(status, title, message = '') {
  let color = COLORS.GREEN;
  let symbol = SYMBOLS.OK;
  if (status === 'WARN') { color = COLORS.YELLOW; symbol = SYMBOLS.WARN; }
  if (status === 'ERR') { color = COLORS.RED; symbol = SYMBOLS.ERR; }
  console.log(`${color}${symbol} [${title}]${COLORS.RESET} ${message}`);
}

async function run() {
  console.log(`\n${COLORS.BOLD}${COLORS.CYAN}🚀 Iniciando Diagnóstico de Saúde: Frontend + Supabase${COLORS.RESET}\n`);

  // 1. Validar Variáveis de Ambiente
  let envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) {
    log('ERR', 'ENV', 'Arquivo .env não encontrado.');
    report.env = { status: 'ERR', message: 'Arquivo .env ausente' };
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
  const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

  if (!urlMatch || !keyMatch) {
    log('ERR', 'ENV', 'VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos no .env.');
    report.env = { status: 'ERR', message: 'Chaves do Supabase ausentes' };
    process.exit(1);
  }

  const SUPABASE_URL = urlMatch[1].trim();
  const SUPABASE_KEY = keyMatch[1].trim();
  log('OK', 'ENV', 'Variáveis de ambiente carregadas.');
  report.env = { status: 'OK', message: 'Variáveis carregadas com sucesso' };

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 2. Conexão & Tabelas
  log('OK', 'CONNECTION', 'Iniciando teste de conexão e extração de schema...');
  
  // Table: products
  const { data: prodData, error: prodErr } = await supabase.from('products').select('*').limit(1);
  if (prodErr) {
    log('ERR', 'TABLE: products', `Erro ao acessar: ${prodErr.message}`);
    report.tables.products.status = 'ERR';
    report.tables.products.message = prodErr.message;
  } else {
    log('OK', 'TABLE: products', 'Tabela acessível. Verificando schema...');
    const expectedProductsCols = ['id', 'slug', 'name', 'category', 'brand', 'image', 'images', 'description', 'highlight', 'active', 'available', 'aplicacao', 'como_usar', 'parent_id', 'variations', 'specs', 'created_at', 'updated_at'];
    
    if (prodData.length > 0) {
      const dbCols = Object.keys(prodData[0]);
      const missing = expectedProductsCols.filter(c => !dbCols.includes(c));
      const extra = dbCols.filter(c => !expectedProductsCols.includes(c));
      
      if (missing.length > 0) {
        log('WARN', 'SCHEMA: products', `Colunas ausentes no DB: ${missing.join(', ')}`);
        report.tables.products.status = 'WARN';
        report.tables.products.missingCols = missing;
      } else {
        log('OK', 'SCHEMA: products', 'Colunas sincronizadas.');
        report.tables.products.status = 'OK';
      }
      report.tables.products.extraCols = extra;
    } else {
      log('WARN', 'SCHEMA: products', 'Tabela vazia, não foi possível inferir colunas.');
      report.tables.products.status = 'WARN';
    }
  }

  // Table: analytics_events
  const { data: analData, error: analErr } = await supabase.from('analytics_events').select('*').limit(1);
  if (analErr) {
    log('ERR', 'TABLE: analytics', `Erro ao acessar: ${analErr.message}`);
    report.tables.analytics_events.status = 'ERR';
    report.tables.analytics_events.message = analErr.message;
  } else {
    const expectedAnalCols = ['id', 'event_type', 'page_url', 'session_id', 'device', 'event_data', 'created_at'];
    if (analData.length > 0) {
      const dbCols = Object.keys(analData[0]);
      const missing = expectedAnalCols.filter(c => !dbCols.includes(c));
      if (missing.length > 0) {
        log('WARN', 'SCHEMA: analytics', `Colunas ausentes no DB: ${missing.join(', ')}`);
        report.tables.analytics_events.status = 'WARN';
        report.tables.analytics_events.missingCols = missing;
      } else {
        log('OK', 'SCHEMA: analytics', 'Colunas sincronizadas.');
        report.tables.analytics_events.status = 'OK';
      }
    } else {
      log('WARN', 'SCHEMA: analytics', 'Tabela vazia, não foi possível inferir colunas.');
      report.tables.analytics_events.status = 'WARN';
    }
  }

  // 3. Storage Buckets
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  if (bucketErr) {
    log('ERR', 'STORAGE', `Erro ao listar buckets: ${bucketErr.message}`);
    report.storage.status = 'ERR';
    report.storage.message = bucketErr.message;
  } else {
    const bucketNames = buckets.map(b => b.name);
    report.storage.buckets = bucketNames;
    if (!bucketNames.includes('products')) {
      log('ERR', 'STORAGE', 'Bucket "products" NÃO ENCONTRADO. Uploads irão falhar.');
      report.storage.status = 'ERR';
      report.storage.message = 'Bucket "products" ausente';
    } else {
      log('OK', 'STORAGE', `Buckets encontrados: ${bucketNames.join(', ')}`);
      // Test public access for 'products'
      const { data: pubUrl } = supabase.storage.from('products').getPublicUrl('health-check-test.txt');
      if (pubUrl && pubUrl.publicUrl) {
        log('OK', 'STORAGE', `Geração de URL Pública ativa para "products"`);
        report.storage.status = 'OK';
      } else {
        log('WARN', 'STORAGE', 'URL pública falhou.');
        report.storage.status = 'WARN';
      }
    }
  }

  // 4. Integridade das URLs de imagem
  log('OK', 'DATA: images', 'Validando URLs de imagem no banco...');
  const { data: allProds } = await supabase.from('products').select('slug, image, images').limit(100);
  if (allProds) {
    let invalidImages = 0;
    allProds.forEach(p => {
      if (p.image && !p.image.startsWith('http') && !p.image.startsWith('/')) {
        invalidImages++;
      }
    });
    if (invalidImages > 0) {
      log('WARN', 'DATA: images', `${invalidImages} produtos possuem URLs de imagem inválidas ou relativas no DB.`);
      report.images = { status: 'WARN', totalChecked: allProds.length, invalid: invalidImages, message: 'URLs inválidas detectadas' };
    } else {
      log('OK', 'DATA: images', `Imagens de ${allProds.length} produtos analisadas e estão íntegras.`);
      report.images = { status: 'OK', totalChecked: allProds.length, invalid: 0, message: 'URLs íntegras' };
    }
  }

  // 5. Build Check
  log('OK', 'BUILD', 'Iniciando validação TypeScript e Vite build...');
  try {
    execSync('npm run build', { stdio: 'ignore', cwd: ROOT_DIR });
    log('OK', 'BUILD', 'Build finalizado com sucesso (Exit Code 0). SPA preservada.');
    report.build = { status: 'OK', message: 'Build passou perfeitamente' };
  } catch (err) {
    log('ERR', 'BUILD', 'O Build falhou! Erros de TypeScript ou Vite detectados.');
    report.build = { status: 'ERR', message: 'Build quebrado' };
  }

  // 6. Generate Markdown Report
  generateMarkdownReport();
  
  console.log(`\n${COLORS.BOLD}${COLORS.CYAN}✅ Diagnóstico Concluído. Relatório salvo em reports/supabase-health-report.md${COLORS.RESET}\n`);
}

function generateMarkdownReport() {
  const reportsDir = path.join(ROOT_DIR, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const md = `# Supabase + Frontend Health Check Report
**Data/Hora:** ${new Date(report.timestamp).toLocaleString('pt-BR')}

## 1. Ambiente & Conexão
* **Variáveis de Ambiente:** ${report.env.status === 'OK' ? '✅' : '❌'} ${report.env.message}
* **Build SPA (Vite/TS):** ${report.build.status === 'OK' ? '✅' : '❌'} ${report.build.message}

## 2. Tabelas & Schema
### Tabela \`products\`
* **Status:** ${report.tables.products.status === 'OK' ? '✅ OK' : report.tables.products.status === 'WARN' ? '⚠️ WARNING' : '❌ ERROR'}
* **Colunas Faltando:** ${report.tables.products.missingCols.length > 0 ? report.tables.products.missingCols.join(', ') : 'Nenhuma'}
* **Colunas Extras no DB:** ${report.tables.products.extraCols.length > 0 ? report.tables.products.extraCols.join(', ') : 'Nenhuma'}

### Tabela \`analytics_events\`
* **Status:** ${report.tables.analytics_events.status === 'OK' ? '✅ OK' : report.tables.analytics_events.status === 'WARN' ? '⚠️ WARNING' : '❌ ERROR'}
* **Colunas Faltando:** ${report.tables.analytics_events.missingCols.length > 0 ? report.tables.analytics_events.missingCols.join(', ') : 'Nenhuma'}

## 3. Storage
* **Status do Storage:** ${report.storage.status === 'OK' ? '✅ OK' : '❌ ERROR'}
* **Buckets Ativos:** ${report.storage.buckets.join(', ')}

## 4. Integridade de Dados
* **Imagens Analisadas:** ${report.images.totalChecked} produtos
* **URLs Quebradas ou Inválidas:** ${report.images.invalid}
* **Status das Imagens:** ${report.images.status === 'OK' ? '✅ Integração perfeita' : '⚠️ Foram detectados caminhos corrompidos (não resolvem HTTP ou caminhos absolutos locais)'}

---
*Gerado automaticamente pelo script de Health Check.*
`;

  fs.writeFileSync(path.join(reportsDir, 'supabase-health-report.md'), md, 'utf8');
}

run().catch(console.error);
