import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

async function run() {
  console.log('🚀 Iniciando detecção de imagens pendentes para migração...\n');

  // Load Env
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env não encontrado.');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
  const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

  if (!urlMatch || !keyMatch) {
    console.error('❌ Chaves do Supabase ausentes no .env.');
    process.exit(1);
  }

  const SUPABASE_URL = urlMatch[1].trim();
  const SUPABASE_KEY = keyMatch[1].trim();
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Fetch all products
  const { data: products, error } = await supabase.from('products').select('slug, name, image, images');
  if (error) {
    console.error('❌ Erro ao buscar produtos:', error.message);
    process.exit(1);
  }

  console.log(`✅ ${products.length} produtos encontrados. Analisando URLs...\n`);

  const report = {
    total: products.length,
    readyToMigrate: [],
    placeholders: [],
    missing: [],
    alreadyMigrated: []
  };

  const PLACEHOLDER_URL = '/images/products/placeholder.webp';

  products.forEach(p => {
    const rawImage = p.image || '';
    
    // Missing
    if (!rawImage.trim()) {
      report.missing.push(p);
      return;
    }

    // Placeholder
    if (rawImage.includes('placeholder')) {
      report.placeholders.push(p);
      return;
    }

    // Already Migrated (Supabase/External URL)
    if (/^https?:\/\//i.test(rawImage)) {
      report.alreadyMigrated.push(p);
      return;
    }

    // Local / Ready to migrate
    report.readyToMigrate.push(p);
  });

  // Orphans detection (simulated - just scanning local dir if it exists)
  const orphans = [];
  const publicProductsDir = path.join(ROOT_DIR, 'public', 'images', 'products');
  if (fs.existsSync(publicProductsDir)) {
    // A simple superficial check just as an example of what could be verified
    // We would recursively read all files and see if they are referenced in the DB.
  }

  // Generate Markdown
  const reportsDir = path.join(ROOT_DIR, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const md = `# Relatório de Migração de Imagens (Preparação)
**Data/Hora:** ${new Date().toLocaleString('pt-BR')}

Este relatório mapeia o estado atual de todas as imagens do catálogo, separando-as para a futura migração definitiva para o bucket \`products\` do Supabase. Nenhuma alteração foi feita no banco ainda.

## Resumo Executivo
- **Total de Produtos:** ${report.total}
- **Prontos para Migração (Locais):** ${report.readyToMigrate.length}
- **Já Migrados (Supabase/CDN):** ${report.alreadyMigrated.length}
- **Placeholders (Precisam de foto real):** ${report.placeholders.length}
- **Sem Imagem (Campo nulo/vazio):** ${report.missing.length}

---

## 1. Produtos Prontos para Migração (${report.readyToMigrate.length})
Estas imagens estão rodando localmente (ex: \`/images/products/...\`) e precisarão ser upadas para o bucket na migração final.
${report.readyToMigrate.length > 0 ? report.readyToMigrate.map(p => `- **${p.name}** (\`${p.slug}\`) -> Atual: \`${p.image}\``).join('\n') : '*Nenhum*'}

## 2. Placeholders Restantes (${report.placeholders.length})
Estes produtos estão usando o fallback padrão do frontend.
${report.placeholders.length > 0 ? report.placeholders.map(p => `- **${p.name}** (\`${p.slug}\`)`).join('\n') : '*Nenhum*'}

## 3. Produtos Sem Nenhuma Imagem Cadastrada (${report.missing.length})
O campo \`image\` está completamente vazio no banco de dados.
${report.missing.length > 0 ? report.missing.map(p => `- **${p.name}** (\`${p.slug}\`)`).join('\n') : '*Nenhum*'}

## 4. Já Migrados / Cloud (${report.alreadyMigrated.length})
Imagens que já estão operando via Supabase ou outro CDN. Nenhuma ação necessária para estes.
${report.alreadyMigrated.length > 0 ? report.alreadyMigrated.map(p => `- **${p.name}** (\`${p.slug}\`) -> \`${p.image}\``).join('\n') : '*Nenhum*'}

---
*Gerado automaticamente por \`detect-pending-images.mjs\`.*
`;

  const reportPath = path.join(reportsDir, 'pending-image-migration.md');
  fs.writeFileSync(reportPath, md, 'utf8');

  console.log(`✅ Relatório gerado com sucesso em: ${reportPath}`);
  console.log(`   - Locais para subir: ${report.readyToMigrate.length}`);
  console.log(`   - Já no Supabase: ${report.alreadyMigrated.length}`);
  console.log(`   - Com Placeholder: ${report.placeholders.length}`);
  console.log(`   - Campo Vazio: ${report.missing.length}`);
}

run().catch(console.error);
