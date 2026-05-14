import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Erro: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos no .env.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isDryRun = process.argv.includes('--dry-run');
const applyIndex = process.argv.indexOf('--apply');
const isApply = applyIndex !== -1;

const brandArg = process.argv.find(arg => arg.startsWith('--brand='));
const targetBrand = brandArg ? brandArg.split('=')[1].toLowerCase() : null;

// Heurísticas de normalização
const TIPO_RULES = [
  { slug: 'manta-asfaltica', keywords: ['manta asfáltica', 'manta asfaltica', 'premium', 'alumínio', 'poliéster', 'poliester'], required: ['manta', 'asfalt'] },
  { slug: 'manta-liquida', keywords: ['manta líquida', 'manta liquida', 'manta acrilica', 'borracha liquida'] },
  { slug: 'primer', keywords: ['primer', 'piche', 'tinta asfáltica'] },
  { slug: 'selante', keywords: ['selante', 'silicone', 'poliuretano', 'pu 40', 'pu', 'mastique'] },
  { slug: 'adesivo', keywords: ['adesivo', 'cola', 'epóxi', 'epoxi'] },
  { slug: 'impermeabilizante-cimenticio', keywords: ['cimentício', 'cimenticio', 'argamassa polimérica', 'viaplus', 'vedatop', 'sikatop', 'tecbond'] },
  { slug: 'aditivo', keywords: ['aditivo', 'plastificante', 'impermeabilizante para argamassa', 'vedalit', 'biaq', 'sika 1'] },
  { slug: 'fita-aluminizada', keywords: ['fita', 'fita aluminizada', 'fita asfáltica', 'multiuso', 'fita autoadesiva', 'vedafita', 'viafita'] },
  { slug: 'hidrofugante', keywords: ['hidrofugante', 'silicone repelente', 'repelente a agua', 'fachada'] },
  { slug: 'membrana-acrilica', keywords: ['membrana acrílica', 'acrílica', 'acrilico'] },
];

const APLICACAO_RULES = [
  { slug: 'lajes', keywords: ['laje', 'cobertura', 'terraço', 'marquise'] },
  { slug: 'telhados', keywords: ['telhado', 'telha', 'cobertura'] },
  { slug: 'calhas', keywords: ['calha', 'rufo'] },
  { slug: 'banheiros', keywords: ['banheiro', 'área fria', 'area fria', 'cozinha', 'lavanderia'] },
  { slug: 'piscinas', keywords: ['piscina', 'espelho d\'água', 'tanque'] },
  { slug: 'reservatorios', keywords: ['reservatório', 'caixa d\'água', 'caixa dagua', 'cisterna'] },
  { slug: 'paredes', keywords: ['parede', 'muro', 'alvenaria', 'reboco'] },
  { slug: 'fundacao', keywords: ['fundação', 'alicerce', 'viga baldrame', 'baldrame', 'sapata', 'muro de arrimo'] },
  { slug: 'rodapes', keywords: ['rodapé', 'rodape'] },
  { slug: 'juntas', keywords: ['junta de dilatação', 'junta', 'fresta', 'trinca'] },
  { slug: 'fachadas', keywords: ['fachada', 'pintura externa', 'parede externa'] },
  { slug: 'pisos', keywords: ['piso', 'contrapiso'] },
];

function normalizeString(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function detectTaxonomy(product) {
  const searchableText = normalizeString(`${product.name || ''} ${product.description || ''} ${product.specs || ''} ${product.category || ''}`);
  const nameText = normalizeString(product.name || '');
  
  const novosTipos = new Set(product.tipo || []);
  const novasAplicacoes = new Set(product.aplicacao || []);
  let confidence = 0;

  // Process TIPO
  for (const rule of TIPO_RULES) {
    if (novosTipos.has(rule.slug)) continue;
    
    let match = false;
    // required override
    if (rule.required) {
       const hasAllRequired = rule.required.every(req => searchableText.includes(req));
       if (hasAllRequired) {
          match = true;
          confidence += 80;
       }
    } else {
      for (const kw of rule.keywords) {
        const normKw = normalizeString(kw);
        if (nameText.includes(normKw)) {
          match = true;
          confidence += 95; // Found in name = high confidence
          break;
        } else if (searchableText.includes(normKw)) {
          match = true;
          confidence += 60; // Found in description = medium confidence
          break;
        }
      }
    }
    if (match) novosTipos.add(rule.slug);
  }

  // Process APLICACAO
  for (const rule of APLICACAO_RULES) {
    if (novasAplicacoes.has(rule.slug)) continue;
    for (const kw of rule.keywords) {
      const normKw = normalizeString(kw);
      if (nameText.includes(normKw)) {
        novasAplicacoes.add(rule.slug);
        confidence += 90;
        break;
      } else if (searchableText.includes(normKw)) {
        novasAplicacoes.add(rule.slug);
        confidence += 75;
        break;
      }
    }
  }
  
  // Normalization limits
  if (confidence > 100) confidence = 100;
  if (confidence === 0) confidence = 10; // Default low confidence if no changes

  return {
    tipo: Array.from(novosTipos),
    aplicacao: Array.from(novasAplicacoes),
    confidence
  };
}

async function run() {
  console.log(`\n=== INICIANDO NORMALIZAÇÃO MASSIVA DE TAXONOMIA ===\n`);
  if (isDryRun) console.log(`⚠️  MODO DRY-RUN (Nenhuma alteração será salva)`);
  else if (isApply) console.log(`🚀 MODO APPLY (Alterações serão persistidas)`);
  else {
    console.log(`❌ Você deve especificar --dry-run ou --apply`);
    process.exit(1);
  }

  if (targetBrand) console.log(`🎯 Filtrando por marca: ${targetBrand.toUpperCase()}`);

  console.log(`\nBaixando produtos do Supabase...`);
  
  // Auth para passar RLS
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@admin.com';
  const adminPass = process.env.VITE_ADMIN_KEY || 'Mundo@impermeabilizacao123';
  const { error: authErr } = await supabase.auth.signInWithPassword({
     email: 'renato.senhorinho@gmail.com',
     password: adminPass
  });
  if (authErr) {
     console.log('⚠️ Aviso: Login falhou, RLS pode bloquear inserções na taxonomia:', authErr.message);
  } else {
     console.log('✅ Autenticado como Admin para RLS bypass.');
  }

  let query = supabase.from('products').select('*');
  if (targetBrand) {
    query = query.ilike('brand', `%${targetBrand}%`);
  }

  const { data: products, error } = await query;

  if (error) {
    console.error(`❌ Erro ao baixar produtos:`, error.message);
    process.exit(1);
  }

  console.log(`✅ ${products.length} produtos encontrados.\n`);

  const results = {
    updated: [],
    ignored: [],
    lowConfidence: []
  };

  const toUpdate = [];

  for (const product of products) {
    const origTipo = JSON.stringify(product.tipo || []);
    const origApp = JSON.stringify(product.aplicacao || []);

    const detected = detectTaxonomy(product);
    
    const newTipoStr = JSON.stringify(detected.tipo);
    const newAppStr = JSON.stringify(detected.aplicacao);

    const isChanged = origTipo !== newTipoStr || origApp !== newAppStr;

    if (!isChanged) {
      results.ignored.push({ slug: product.slug, reason: 'Already normalized' });
      continue;
    }

    if (detected.confidence < 80) {
      results.lowConfidence.push({
        slug: product.slug,
        nome: product.name,
        confidence: detected.confidence,
        detected_tipo: detected.tipo,
        detected_aplicacao: detected.aplicacao
      });
      results.ignored.push({ slug: product.slug, reason: 'Low confidence' });
      continue;
    }

    results.updated.push({
      slug: product.slug,
      nome: product.name,
      old_tipo: product.tipo || [],
      new_tipo: detected.tipo,
      old_aplicacao: product.aplicacao || [],
      new_aplicacao: detected.aplicacao,
      confidence: detected.confidence
    });

    toUpdate.push({
      id: product.id,
      slug: product.slug,
      tipo: detected.tipo,
      aplicacao: detected.aplicacao
    });
  }

  console.log(`📊 ESTATÍSTICAS DE ANÁLISE:`);
  console.log(`- Produtos que necessitam atualização: ${toUpdate.length}`);
  console.log(`- Produtos ignorados (já normais): ${results.ignored.filter(i => i.reason === 'Already normalized').length}`);
  console.log(`- Produtos ignorados (baixa confiança): ${results.lowConfidence.length}`);

  if (isApply && toUpdate.length > 0) {
    console.log(`\n💾 Salvando ${toUpdate.length} produtos no Supabase...`);
    let count = 0;
    for (const p of toUpdate) {
      const { error: updateErr } = await supabase
        .from('products')
        .update({ tipo: p.tipo, aplicacao: p.aplicacao, updated_at: new Date().toISOString() })
        .eq('id', p.id);
      
      if (updateErr) {
         console.error(`❌ Erro ao atualizar ${p.slug}:`, updateErr.message);
      } else {
         count++;
      }
    }
    console.log(`✅ ${count} produtos atualizados com sucesso.`);
  }

  // Ensure global taxonomy exists
  if (isApply && toUpdate.length > 0) {
      console.log(`\n🔍 Verificando taxonomia global no Supabase...`);
      const allTipos = new Set();
      const allApps = new Set();
      toUpdate.forEach(p => {
          p.tipo.forEach(t => allTipos.add(t));
          p.aplicacao.forEach(a => allApps.add(a));
      });

      const { data: existingTax } = await supabase.from('catalog_taxonomy').select('*');
      const existingSlugs = new Set(existingTax?.map(t => t.slug) || []);

      const inserts = [];
      allTipos.forEach(t => {
          if (!existingSlugs.has(t)) inserts.push({ group_name: 'TIPO', label: t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' '), slug: t });
      });
      allApps.forEach(a => {
          if (!existingSlugs.has(a)) inserts.push({ group_name: 'APLICACAO', label: a.charAt(0).toUpperCase() + a.slice(1).replace(/-/g, ' '), slug: a });
      });

      if (inserts.length > 0) {
          console.log(`➕ Adicionando ${inserts.length} novos termos à taxonomia global...`);
          const { error: insErr } = await supabase.from('catalog_taxonomy').insert(inserts);
          if (insErr) console.error(`❌ Erro ao inserir taxonomia global:`, insErr.message);
          else console.log(`✅ Taxonomia global atualizada.`);
      }
  }

  // Generate Report
  const reportPath = path.resolve(__dirname, '../reports/taxonomy-normalization-report.md');
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const report = `# Relatório de Normalização de Taxonomia 
Data: ${new Date().toISOString()}
Filtro: ${targetBrand || 'Todos'}
Modo: ${isDryRun ? 'DRY-RUN (Simulação)' : 'APPLY (Persistido)'}

## Estatísticas
- Analisados: ${products.length}
- Atualizados/Validados: ${results.updated.length}
- Ignorados por baixa confiança: ${results.lowConfidence.length}
- Ignorados por já estarem corretos: ${results.ignored.filter(i => i.reason === 'Already normalized').length}

## Produtos Atualizados (Alta Confiança >= 80%)
${results.updated.map(r => `
### ${r.nome} (Confiança: ${r.confidence}%)
- **TIPO**: [${r.old_tipo.join(', ')}] ➡️ [${r.new_tipo.join(', ')}]
- **APLICAÇÃO**: [${r.old_aplicacao.join(', ')}] ➡️ [${r.new_aplicacao.join(', ')}]`).join('\n')}

## Ignorados por Baixa Confiança (< 80%)
${results.lowConfidence.map(r => `
### ${r.nome}
- Confiança detectada: ${r.confidence}%
- Sugestão descartada: Tipo [${r.detected_tipo.join(', ')}], Aplicação [${r.detected_aplicacao.join(', ')}]`).join('\n')}
`;

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n📄 Relatório detalhado salvo em: ${reportPath}`);
  console.log(`\n=== FIM ===\n`);
}

run().catch(err => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
