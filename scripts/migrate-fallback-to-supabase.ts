import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { products as fallbackProducts } from '../src/data/products';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const envPath = path.join(ROOT_DIR, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausentes no .env');
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

// Função que recria o productToDbRow do service para garantir consistência
function productToDbRow(p) {
  const row = {
    slug: p.slug,
    name: p.nome || p.nomeOriginal,
    category: p.categoria || 'geral',
    brand: p.marca || null,
    image: p.imagem || null,
    images: p.imagens && p.imagens.length > 0 ? p.imagens : null,
    description: p.resumo || null,
    highlight: p.destaque ?? false,
    active: p.ativo !== false,
    available: (p.quantidadeEstoque ?? 0) > 0,
    aplicacao: p.aplicacao && p.aplicacao.length > 0 ? p.aplicacao : null,
    como_usar: p.comoUsar && p.comoUsar.length > 0 ? p.comoUsar : null,
    specs: p.especificacoes ?? null,
    parent_id: p.parentId && p.parentId.trim() !== '' ? p.parentId.trim() : null,
    updated_at: new Date().toISOString(),
  };

  row.id = p.id || p.slug; // Preserva o id como slug se não existir (regra TEXT)

  return row;
}

async function run() {
  console.log('🚀 Iniciando Migração Definitiva: Fallback -> Supabase');

  // 1. Buscar produtos do Supabase
  const { data: dbProducts, error } = await supabase.from('products').select('*');
  if (error) {
    console.error('❌ Erro ao buscar produtos do Supabase:', error);
    process.exit(1);
  }

  const dbSlugs = new Set(dbProducts.map(p => p.slug));
  console.log(`📦 Encontrados ${dbProducts.length} produtos já existentes no Supabase.`);

  // 2. Analisar Fallback
  console.log(`📂 Encontrados ${fallbackProducts.length} produtos no fallback local.`);

  const toInsert = [];
  const toSkip = [];
  const invalidParents = [];

  // Mapear os ids que vão existir (banco atual + os que vamos inserir)
  const futureDbIds = new Set(dbProducts.map(p => p.id));
  for (const fp of fallbackProducts) {
    futureDbIds.add(fp.id || fp.slug);
  }

  for (const p of fallbackProducts) {
    if (dbSlugs.has(p.slug)) {
      toSkip.push(p);
      continue;
    }

    const row = productToDbRow(p);

    // Validação de FK: se parent_id não estiver no futureDbIds, remover para evitar erro
    if (row.parent_id && !futureDbIds.has(row.parent_id)) {
      invalidParents.push({ slug: p.slug, parent_id: row.parent_id });
      row.parent_id = null;
    }

    // Force active=true as requested
    row.active = true;

    toInsert.push(row);
  }

  if (toInsert.length > 0) {
    console.log(`💾 Inserindo ${toInsert.length} novos produtos no Supabase...`);
    
    // Inserção em lotes de 50 para evitar sobrecarga
    const BATCH_SIZE = 50;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from('products').upsert(batch, { onConflict: 'slug' });
      
      if (insertError) {
        console.error(`❌ Erro no lote ${i/BATCH_SIZE + 1}:`, insertError.message);
      } else {
        console.log(`✅ Lote ${i/BATCH_SIZE + 1} (Produtos ${i} - ${i + batch.length}) migrado com sucesso.`);
      }
    }
  } else {
    console.log(`✅ Nenhum produto novo para migrar. Todos já estão no Supabase.`);
  }

  // 3. Relatório
  const reportsDir = path.join(ROOT_DIR, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const md = `# Migration Report: Fallback -> Supabase
**Data:** ${new Date().toLocaleString('pt-BR')}

## Resumo
- **Total Fallback:** ${fallbackProducts.length}
- **Já no Banco (Skip):** ${toSkip.length}
- **Novos (Inseridos):** ${toInsert.length}

## Relações Órfãs Corrigidas (parent_id nulificado para não quebrar FK)
${invalidParents.length === 0 ? '- Nenhuma' : invalidParents.map(ip => `- Produto: \`${ip.slug}\` (Apontava para: \`${ip.parent_id}\`)`).join('\n')}

## Exemplos de Inseridos
${toInsert.slice(0, 10).map(i => `- ${i.name} (Slug: ${i.slug}, Brand: ${i.brand})`).join('\n')}
${toInsert.length > 10 ? `- ... e mais ${toInsert.length - 10} produtos.` : ''}
`;

  fs.writeFileSync(path.join(reportsDir, 'migration-fallback-report.md'), md, 'utf8');
  console.log(`✅ Relatório salvo em reports/migration-fallback-report.md`);
}

run();
