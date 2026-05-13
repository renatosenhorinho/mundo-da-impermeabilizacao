import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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

async function run() {
  console.log('🚀 Iniciando auditoria de product relations (parent_id as TEXT)...');

  const { data: products, error } = await supabase.from('products').select('id, slug, name, parent_id');

  if (error) {
    console.error('Erro ao buscar produtos:', error);
    process.exit(1);
  }

  const ids = new Set(products.map(p => p.id));
  
  const emptyString = [];
  const selfReference = [];
  const orphanReference = [];
  const duplicatedId = [];
  
  // Auditar duplicação de IDs (já que usam text id e slug)
  const idCounts = {};
  products.forEach(p => {
    idCounts[p.id] = (idCounts[p.id] || 0) + 1;
  });
  Object.keys(idCounts).forEach(id => {
    if (idCounts[id] > 1) {
      duplicatedId.push(id);
    }
  });

  for (const p of products) {
    if (p.parent_id === null || p.parent_id === undefined) continue;

    if (typeof p.parent_id === 'string' && p.parent_id.trim() === '') {
      emptyString.push(p);
      continue;
    }

    if (p.parent_id === p.id) {
      selfReference.push(p);
      continue;
    }

    if (!ids.has(p.parent_id)) {
      orphanReference.push(p);
      continue;
    }
  }

  const reportsDir = path.join(ROOT_DIR, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const md = `# Product Relations Audit (TEXT)
**Data/Hora:** ${new Date().toLocaleString('pt-BR')}

## Resumo
- **Total de Produtos:** ${products.length}
- **parent_id Vazio/Branco (String):** ${emptyString.length}
- **Auto-referência (parent_id = id):** ${selfReference.length}
- **Órfãos (parent_id inexistente em products.id):** ${orphanReference.length}
- **IDs Duplicados (Inconsistência Grave):** ${duplicatedId.length}

## Detalhes

### 1. parent_id Vazio/Branco (String)
Esses produtos possuem \`parent_id\` string vazia ao invés de \`NULL\`.
${emptyString.map(p => `- ${p.name} (Slug: ${p.slug})`).join('\n') || '- Nenhum'}

### 2. Auto-referência (parent_id = id)
Esses produtos apontam para si mesmos como parent.
${selfReference.map(p => `- ${p.name} (Slug: ${p.slug})`).join('\n') || '- Nenhum'}

### 3. Órfãos (parent_id inexistente)
Esses produtos apontam para um parent_id que não existe mais no banco (\`products.id\`).
${orphanReference.map(p => `- ${p.name} (Slug: ${p.slug}) | Parent ID (TEXT): ${p.parent_id}`).join('\n') || '- Nenhum'}

### 4. IDs Duplicados
Produtos dividindo a mesma Primary/Unique Key de \`id\`.
${duplicatedId.map(id => `- ID repetido: ${id}`).join('\n') || '- Nenhum'}
`;

  fs.writeFileSync(path.join(reportsDir, 'product-relations-audit.md'), md, 'utf8');

  console.log('✅ Auditoria concluída. Relatório salvo em reports/product-relations-audit.md');
}

run();
