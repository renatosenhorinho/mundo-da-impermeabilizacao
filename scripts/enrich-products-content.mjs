import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const fileArg = args.find(a => a.startsWith('--file='));
  const brandArg = args.find(a => a.startsWith('--brand='));
  
  const brand = brandArg ? brandArg.split('=')[1].toUpperCase() : 'VIAPOL';
  const dataFile = fileArg ? fileArg.split('=')[1] : path.join(__dirname, 'data', `${brand.toLowerCase()}_batch_1.json`);

  console.log(`\n=== INICIANDO ENRIQUECIMENTO DE CONTEÚDO ===`);
  console.log(`Marca: ${brand}`);
  console.log(`Modo: ${isApply ? 'APPLY (Atualizando Banco)' : 'DRY-RUN (Apenas leitura e validação)'}`);
  console.log(`Arquivo base: ${dataFile}\n`);

  // Load env
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = '';
  try {
    envContent = await fs.readFile(envPath, 'utf-8');
  } catch (err) {
    console.error(`❌ Erro ao ler arquivo .env na raiz do projeto: ${err.message}`);
    process.exit(1);
  }

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

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontrados no .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Load data mapping
  let enrichmentData = [];
  try {
    const rawData = await fs.readFile(dataFile, 'utf-8');
    enrichmentData = JSON.parse(rawData);
    console.log(`✅ Carregados ${enrichmentData.length} itens do arquivo de enriquecimento.`);
  } catch (err) {
    console.error(`❌ Erro ao ler arquivo de dados (${dataFile}): ${err.message}`);
    process.exit(1);
  }

  // Generate Report Map
  let report = [
    `# Relatório de Enriquecimento de Conteúdo - ${brand}`,
    `Data: ${new Date().toISOString()}`,
    `Modo: ${isApply ? 'APPLY' : 'DRY-RUN'}`,
    `\n## Resumo das Atualizações\n`
  ];

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const item of enrichmentData) {
    const slug = item.slug;
    
    // Fetch current product state
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('id, name, slug, aplicacao, como_usar, description, specs')
      .eq('slug', slug)
      .single();

    if (fetchError || !currentProduct) {
      console.log(`⚠️  Produto não encontrado: ${slug} (${fetchError?.message || 'Sem dados'})`);
      report.push(`- ❌ **${slug}**: Não encontrado no banco de dados.`);
      errorCount++;
      continue;
    }

    const updates = {};
    const reportItem = [`- **${currentProduct.name}** (\`${slug}\`):`];
    let hasUpdates = false;

    // Campos a atualizar incondicionalmente (se providenciados no mapeamento, assumindo que nossa inteligência traz um texto melhor/comercial)
    // O prompt diz: "aplicacao", "como_usar" (sem restrição). "descricao_curta (apenas se vazia)", "especificacoes (apenas se vazia)".
    // Mas devemos evitar sobrescrever conteúdo existente válido se já for muito bom.
    // O usuário disse: "atualizar somente campos vazios. Não sobrescrever conteúdo existente válido".
    
    // Então vamos atualizar TUDO somente se estiver vazio, exceto se a regra de negócio for atualizar sempre aplicacao e como_usar se vierem null/vazios
    
    if (!currentProduct.aplicacao && item.aplicacao) {
      updates.aplicacao = item.aplicacao;
      reportItem.push(`  - ✅ \`aplicacao\` adicionada.`);
      hasUpdates = true;
    } else if (currentProduct.aplicacao) {
      reportItem.push(`  - ⏭️ \`aplicacao\` mantida (já existente).`);
    }

    if (!currentProduct.como_usar && item.como_usar) {
      updates.como_usar = item.como_usar;
      reportItem.push(`  - ✅ \`como_usar\` adicionado.`);
      hasUpdates = true;
    } else if (currentProduct.como_usar) {
      reportItem.push(`  - ⏭️ \`como_usar\` mantido (já existente).`);
    }

    if (!currentProduct.description && item.description) {
      updates.description = item.description;
      reportItem.push(`  - ✅ \`description\` (descricao_curta) adicionada.`);
      hasUpdates = true;
    } else if (currentProduct.description) {
      reportItem.push(`  - ⏭️ \`description\` mantida.`);
    }

    const hasCurrentSpecs = currentProduct.specs && Object.keys(currentProduct.specs).length > 0;
    if (!hasCurrentSpecs && item.specs) {
      updates.specs = item.specs;
      reportItem.push(`  - ✅ \`specs\` (especificações) adicionadas.`);
      hasUpdates = true;
    } else if (hasCurrentSpecs) {
      reportItem.push(`  - ⏭️ \`specs\` mantidas.`);
    }

    if (!hasUpdates) {
      console.log(`⏭️  Pulando ${slug}: Nenhum campo elegível para atualização.`);
      reportItem.push(`  - ⏭️ Nenhuma alteração necessária.`);
      report.push(reportItem.join('\n'));
      skippedCount++;
      continue;
    }

    if (isApply) {
      const { error: updateError } = await supabase
        .from('products')
        .update(updates)
        .eq('slug', slug);

      if (updateError) {
        console.log(`❌ Erro ao atualizar ${slug}:`, updateError.message);
        reportItem.push(`  - ❌ Falha no update: ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`✅ Atualizado ${slug}`);
        successCount++;
      }
    } else {
      console.log(`🔍 [DRY-RUN] Atualizaria ${slug}:`, Object.keys(updates).join(', '));
      successCount++;
    }

    report.push(reportItem.join('\n'));
  }

  // Finalizar relatório
  report.unshift(
    `**Sucesso:** ${successCount} | **Pulados:** ${skippedCount} | **Erros:** ${errorCount}\n---`
  );

  const reportDir = path.join(__dirname, '..', 'reports');
  await fs.mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `content-enrichment-report-${brand.toLowerCase()}-${isApply ? 'apply' : 'dryrun'}.md`);
  await fs.writeFile(reportPath, report.join('\n'), 'utf-8');

  console.log(`\n=== PROCESSO FINALIZADO ===`);
  console.log(`Sucesso: ${successCount}`);
  console.log(`Pulados: ${skippedCount}`);
  console.log(`Erros:   ${errorCount}`);
  console.log(`📄 Relatório salvo em: ${reportPath}`);
  
  if (!isApply) {
    console.log(`\n💡 Rode o comando com a flag --apply para salvar as alterações no banco.`);
  }
}

main();
