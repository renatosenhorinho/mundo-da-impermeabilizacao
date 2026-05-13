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
  console.log('🛠️ Iniciando correção de product relations (parent_id as TEXT)...');

  const { data: products, error } = await supabase.from('products').select('id, slug, name, parent_id');

  if (error) {
    console.error('Erro ao buscar produtos:', error);
    process.exit(1);
  }

  const ids = new Set(products.map(p => p.id));
  const toFix = [];

  for (const p of products) {
    if (p.parent_id === null || p.parent_id === undefined) continue;

    let needsFix = false;

    if (typeof p.parent_id === 'string' && p.parent_id.trim() === '') {
      needsFix = true;
    } else if (p.parent_id === p.id) {
      needsFix = true;
    } else if (!ids.has(p.parent_id)) {
      needsFix = true;
    }

    if (needsFix) {
      toFix.push(p);
    }
  }

  if (toFix.length === 0) {
    console.log('✅ Nenhum produto requer correção no parent_id.');
    return;
  }

  console.log(`Encontrados ${toFix.length} produtos com parent_id inválido. Corrigindo...`);

  for (const p of toFix) {
    const { error: updateError } = await supabase
      .from('products')
      .update({ parent_id: null })
      .eq('id', p.id);

    if (updateError) {
      console.error(`❌ Erro ao atualizar ${p.slug}:`, updateError.message);
    } else {
      console.log(`✅ Corrigido: ${p.name} (Slug: ${p.slug}) -> parent_id = NULL`);
    }
  }

  console.log('🎉 Todas as correções aplicadas com sucesso.');
}

run();
