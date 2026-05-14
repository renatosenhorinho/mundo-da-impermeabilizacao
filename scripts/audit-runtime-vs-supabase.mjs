import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('\n=== INICIANDO AUDITORIA DE CATÁLOGO ===\n');

  const args = process.argv.slice(2);
  const localDumpArg = args.find(a => a.startsWith('--local-dump='));
  const localDumpPath = localDumpArg ? localDumpArg.split('=')[1] : null;

  // 1. Carregar configuração e Supabase
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

  // 2. Coletar estado do Supabase
  console.log('🔄 Baixando estado atual do Supabase...');
  const { data: supabaseData, error: supError } = await supabase
    .from('products')
    .select('*');

  if (supError) {
    console.error('❌ Erro ao ler Supabase:', supError.message);
    process.exit(1);
  }

  const supActive = supabaseData.filter(p => p.active !== false);
  console.log(`✅ Supabase: ${supabaseData.length} total, ${supActive.length} ativos.`);

  // 3. Coletar estado do LocalStorage (Runtime / Admin)
  let runtimeProducts = [];
  let hasRuntime = false;

  if (localDumpPath) {
    try {
      const dump = await fs.readFile(path.resolve(localDumpPath), 'utf-8');
      runtimeProducts = JSON.parse(dump);
      hasRuntime = true;
      console.log(`✅ Cache/Runtime (Admin): ${runtimeProducts.length} produtos carregados do dump.`);
    } catch (err) {
      console.error(`⚠️ Erro ao ler dump local (${localDumpPath}):`, err.message);
    }
  } else {
    console.log('⚠️ Nenhum dump de localStorage/Runtime fornecido (use --local-dump=arquivo.json).');
    console.log('   Compararemos apenas a base Supabase com backups anteriores caso existam.');
  }

  // 4. Salvar Snapshots de Segurança
  const reportsDir = path.join(__dirname, '..', 'reports');
  const backupsDir = path.join(__dirname, '..', 'backups');
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.mkdir(backupsDir, { recursive: true });

  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupSupabasePath = path.join(backupsDir, `supabase-pre-sync-${dateStr}.json`);
  await fs.writeFile(backupSupabasePath, JSON.stringify(supabaseData, null, 2));

  let backupRuntimePath = null;
  if (hasRuntime) {
    backupRuntimePath = path.join(backupsDir, `runtime-pre-sync-${dateStr}.json`);
    await fs.writeFile(backupRuntimePath, JSON.stringify(runtimeProducts, null, 2));
  }

  console.log(`\n💾 Snapshots criados em /backups`);

  // 5. Comparação e Detecção de Fonte Mais Recente
  let report = [
    `# Auditoria de Sincronização do Catálogo`,
    `Data: ${new Date().toISOString()}`,
    `\n## Resumo Geral`,
    `- Supabase Ativos: **${supActive.length}**`,
    hasRuntime ? `- Runtime (Admin/Cache): **${runtimeProducts.length}**` : `- Runtime: *Não fornecido*`,
    `\n## Divergências Encontradas\n`
  ];

  if (hasRuntime) {
    const supMap = new Map(supActive.map(p => [p.slug || p.id, p]));
    const runMap = new Map(runtimeProducts.map(p => [p.slug || p.id, p]));

    let onlyInRuntime = [];
    let onlyInSupabase = [];
    let divergent = [];

    // Validar quem está apenas no Runtime (Admin é mais novo)
    for (const [slug, pRun] of runMap.entries()) {
      if (!pRun.ativo) continue; // ignorar inativos do runtime
      const pSup = supMap.get(slug);

      if (!pSup) {
        onlyInRuntime.push(slug);
      } else {
        // Comparar campos cruciais para divergência
        const hasDiff = 
          pRun.nome !== pSup.name ||
          pRun.categoria !== pSup.category ||
          pRun.marca !== pSup.brand ||
          (pRun.imagem || '') !== (pSup.image || '') ||
          (pRun.resumo || '') !== (pSup.description || '');

        if (hasDiff) divergent.push({ slug, run: pRun, sup: pSup });
      }
    }

    // Validar quem está apenas no Supabase
    for (const [slug, pSup] of supMap.entries()) {
      const pRun = runMap.get(slug);
      if (!pRun || pRun.ativo === false) {
        onlyInSupabase.push(slug);
      }
    }

    report.push(`### 1. Produtos Apenas no Frontend/Admin (${onlyInRuntime.length})`);
    if (onlyInRuntime.length > 0) {
      report.push(`*Risco de perda se o Supabase fosse recriado. Precisam ser salvos.*`);
      onlyInRuntime.forEach(s => report.push(`- \`${s}\``));
    } else {
      report.push(`- Nenhum`);
    }

    report.push(`\n### 2. Produtos Apenas no Supabase (${onlyInSupabase.length})`);
    if (onlyInSupabase.length > 0) {
      report.push(`*Podem ter sido deletados manualmente no Admin.*`);
      onlyInSupabase.forEach(s => report.push(`- \`${s}\``));
    } else {
      report.push(`- Nenhum`);
    }

    report.push(`\n### 3. Divergências de Conteúdo (${divergent.length})`);
    if (divergent.length > 0) {
      report.push(`*Diferenças em imagens, categorias, descrições.*`);
      divergent.forEach(d => {
        report.push(`- **${d.slug}**:`);
        if (d.run.imagem !== d.sup.image) report.push(`  - Imagem difere. Run: ${d.run.imagem} | Sup: ${d.sup.image}`);
        if (d.run.resumo !== d.sup.description) report.push(`  - Descrição difere.`);
        if (d.run.marca !== d.sup.brand) report.push(`  - Marca difere. Run: ${d.run.marca} | Sup: ${d.sup.brand}`);
      });
    } else {
      report.push(`- Nenhuma divergência.`);
    }
  } else {
    report.push(`*Para auditar diferenças com o Admin, rode o script passando \`--local-dump=caminho_do_arquivo.json\`.*`);
  }

  const reportPath = path.join(reportsDir, `pre-sync-audit-${dateStr}.md`);
  await fs.writeFile(reportPath, report.join('\n'));
  
  console.log(`\n📄 Relatório de Auditoria salvo em: reports/pre-sync-audit-${dateStr}.md`);
  console.log(`\n📌 INSTRUÇÕES:`);
  console.log(`Se você alterou o catálogo no painel Admin hoje, essas alterações estão no LocalStorage do seu navegador.`);
  console.log(`Para garantir que nada se perca, siga os passos:`);
  console.log(`1. Abra o painel Admin no navegador (F12 > Console).`);
  console.log(`2. Cole este comando e aperte Enter:`);
  console.log(`   console.log(localStorage.getItem('mdi_custom_products'))`);
  console.log(`3. Salve o resultado em um arquivo chamado "reports/runtime-dump.json".`);
  console.log(`4. Rode a auditoria completa: node scripts/audit-runtime-vs-supabase.mjs --local-dump=reports/runtime-dump.json`);
  console.log(`5. Para aplicar e sincronizar a verdade absoluta, rode: node scripts/sync-runtime-to-supabase.mjs --local-dump=reports/runtime-dump.json\n`);
}

main();
