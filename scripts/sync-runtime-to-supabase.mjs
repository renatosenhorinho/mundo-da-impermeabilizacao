import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getRichestText(strA, strB) {
  if (!strA && !strB) return null;
  if (!strA) return strB;
  if (!strB) return strA;
  return strA.length >= strB.length ? strA : strB;
}

function mergeImages(runImages, runImage, supImages, supImage) {
  // Se o runtime tiver algo válido, prefere ele, caso contrário mantém o do supabase
  // Runtime arrays geralmente têm precedência se tiverem sido editados no Admin hoje
  const finalImages = (runImages && runImages.length > 0) ? runImages : supImages;
  const finalImage = runImage || supImage || (finalImages ? finalImages[0] : null);
  return { finalImage, finalImages };
}

async function main() {
  console.log('\n=== INICIANDO SINCRONIZAÇÃO SEGURA (RUNTIME -> SUPABASE) ===\n');

  const args = process.argv.slice(2);
  const localDumpArg = args.find(a => a.startsWith('--local-dump='));
  const isApply = args.includes('--apply');

  if (!localDumpArg) {
    console.error('❌ ERRO: Você deve fornecer o dump do Runtime (Admin) usando --local-dump=reports/runtime-dump.json');
    process.exit(1);
  }

  const localDumpPath = localDumpArg.split('=')[1];

  let runtimeProducts = [];
  try {
    const dump = await fs.readFile(path.resolve(localDumpPath), 'utf-8');
    runtimeProducts = JSON.parse(dump);
  } catch (err) {
    console.error(`❌ Erro ao ler dump local (${localDumpPath}):`, err.message);
    process.exit(1);
  }

  const envPath = path.join(__dirname, '..', '.env');
  const envContent = await fs.readFile(envPath, 'utf-8').catch(() => '');
  const env = Object.fromEntries(
    envContent.split('\n')
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const [key, ...rest] = line.split('=');
        return [key?.trim(), rest.join('=').trim()];
      })
  );

  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔄 Baixando Supabase atual para merge seguro...');
  const { data: supabaseData, error: supError } = await supabase.from('products').select('*');
  if (supError) throw new Error(supError.message);

  const supMap = new Map(supabaseData.map(p => [p.slug || p.id, p]));

  let syncCount = 0;
  let errorCount = 0;

  for (const pRun of runtimeProducts) {
    const slug = pRun.slug || pRun.id;
    const pSup = supMap.get(slug);

    // Converter Formato Frontend (CamelCase/PT) -> Supabase (SnakeCase/EN)
    const { finalImage, finalImages } = mergeImages(pRun.imagens, pRun.imagem, pSup?.images, pSup?.image);
    
    // Mantém o texto mais longo (mais rico) para evitar perda de descrições ricas caso o cache local estivesse vazio
    const finalDescription = getRichestText(pRun.resumo, pSup?.description);
    
    // Arrays de spec e text mantemos do runtime se existir
    const finalAplicacao = (pRun.aplicacao && pRun.aplicacao.length > 0) ? pRun.aplicacao : pSup?.aplicacao;
    const finalComoUsar = (pRun.comoUsar && pRun.comoUsar.length > 0) ? pRun.comoUsar : pSup?.como_usar;
    const finalSpecs = (pRun.especificacoes && Object.keys(pRun.especificacoes).length > 0) ? pRun.especificacoes : pSup?.specs;

    const row = {
      id: pRun.id || slug,
      slug: slug,
      name: pRun.nome || pRun.nomeOriginal,
      category: pRun.categoria,
      brand: pRun.marca || null,
      image: finalImage || null,
      images: finalImages && finalImages.length > 0 ? finalImages : null,
      description: finalDescription || null,
      highlight: pRun.destaque ?? false,
      active: pRun.ativo !== false,
      available: (pRun.quantidadeEstoque ?? 0) > 0,
      aplicacao: finalAplicacao || null,
      como_usar: finalComoUsar || null,
      specs: finalSpecs || null,
      parent_id: pRun.parentId || null,
      updated_at: new Date().toISOString(),
    };

    if (isApply) {
      const { error: upsertError } = await supabase.from('products').upsert(row, { onConflict: 'slug' });
      if (upsertError) {
        console.error(`❌ Erro ao salvar ${slug}:`, upsertError.message);
        errorCount++;
      } else {
        syncCount++;
      }
    } else {
      syncCount++;
    }
  }

  // Desativar no Supabase o que não está ativo no Runtime
  // O usuário pediu "Sincronizar definitivamente o estado atual do catálogo"
  // Se o catálogo atual diz que X não existe, deveríamos desativá-lo.
  const runSlugs = new Set(runtimeProducts.filter(p => p.ativo !== false).map(p => p.slug || p.id));
  let deactivatedCount = 0;

  for (const pSup of supabaseData) {
    if (pSup.active !== false && !runSlugs.has(pSup.slug || pSup.id)) {
      if (isApply) {
        const { error } = await supabase.from('products').update({ active: false }).eq('id', pSup.id);
        if (!error) deactivatedCount++;
      } else {
        deactivatedCount++;
      }
    }
  }

  if (!isApply) {
    console.log(`\n🔍 [DRY-RUN] Modificações Validadas:`);
    console.log(`- Upserts prontos para sincronizar: ${syncCount}`);
    console.log(`- Produtos que serão desativados (ausentes no frontend): ${deactivatedCount}`);
    console.log(`\n💡 Rode com a flag --apply para SALVAR DEFINITIVAMENTE no Supabase.\n`);
  } else {
    console.log(`\n✅ SINCRONIZAÇÃO CONCLUÍDA!`);
    console.log(`- Produtos atualizados/inseridos no Supabase: ${syncCount}`);
    console.log(`- Produtos desativados: ${deactivatedCount}`);
    console.log(`- Erros: ${errorCount}`);
    console.log(`\nO banco Supabase agora é a ÚNICA fonte de verdade absoluta.\n`);
  }
}

main();
