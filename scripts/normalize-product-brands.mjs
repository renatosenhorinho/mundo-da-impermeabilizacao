import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Replicação da lógica do brand-normalizer para rodar em Node puro sem precisar de compilação TS
const BRAND_ALIASES = {
  'viaplus': 'VIAPOL',
  'viabit': 'VIAPOL',
  'vedalage': 'VIAPOL',
  'betumanta': 'VIAPOL',
  'drykomanta': 'DRYKO',
  'drykoprimer': 'DRYKO',
  'denvertec': 'DENVER',
  'denvermanta': 'DENVER',
  'maxpren': 'MAXTON',
  'colamax': 'MAXTON',
  'veda facil': 'VEDACIT',
  'ultra ved': 'ULTRAVED',
  'ultraved': 'ULTRAVED',
};

const INFERENCE_PREFIXES = [
  { prefix: 'BAUTECH', brand: 'BAUTECH' },
  { prefix: 'BRANYL', brand: 'BRANYL' },
  { prefix: 'ALSAN ACRIL', brand: 'DENVER' },
  { prefix: 'DENVER', brand: 'DENVER' },
  { prefix: 'IMPERMANTA', brand: 'DENVER' },
  { prefix: 'DRYKO', brand: 'DRYKO' },
  { prefix: 'EUCON', brand: 'EUCON' },
  { prefix: 'FUSEPROTEC', brand: 'FUSEPROTEC' },
  { prefix: 'MACTEX', brand: 'MACTEX' },
  { prefix: 'COLAMAX', brand: 'MAXTON' },
  { prefix: 'DESMOLTON', brand: 'MAXTON' },
  { prefix: 'KALFACIL', brand: 'MAXTON' },
  { prefix: 'MAXPREN', brand: 'MAXTON' },
  { prefix: 'SELATON', brand: 'MAXTON' },
  { prefix: 'VEDA FACIL', brand: 'VEDACIT' },
  { prefix: 'MUNDO FLEX', brand: 'MUNDO FLEX' },
  { prefix: 'BETUMANTA', brand: 'VIAPOL' },
  { prefix: 'FITA QUALITAPE', brand: 'ADELBRAS' },
  { prefix: 'FITA MULTI USO TIPO SILVER TAPE', brand: 'ADELBRAS' },
  { prefix: 'Q-BORG', brand: 'Q-BORG' },
  { prefix: 'SELANTE Q-BORG', brand: 'Q-BORG' },
  { prefix: 'ACRIFAST QUARTZOLIT', brand: 'QUARTZOLIT' },
  { prefix: 'QUARTZOLIT', brand: 'QUARTZOLIT' },
  { prefix: 'SUPERGRAUTE', brand: 'QUARTZOLIT' },
  { prefix: 'TECBOND', brand: 'QUARTZOLIT' },
  { prefix: 'REPARO ESTRUTURAL', brand: 'QUARTZOLIT' },
  { prefix: 'SIKA', brand: 'SIKA' },
  { prefix: 'ARG. COLANTE', brand: 'DO MESTRE' },
  { prefix: 'POXPUR', brand: 'POXPUR' },
  { prefix: 'CURATON', brand: 'CURATON' },
  { prefix: 'ETANIZ', brand: 'ETANIZ' },
  { prefix: 'PLASTIBAND', brand: 'PLASTIBAND' },
  { prefix: 'MAXPRIMER', brand: 'MAXPRIMER' },
  { prefix: 'ULTRA VED', brand: 'ULTRAVED' },
  { prefix: 'ULTRAVED', brand: 'ULTRAVED' },
  { prefix: 'VASELINA EMCAPLUS', brand: 'EMCAPLUS' },
  { prefix: 'TECHDRENO', brand: 'TECHDRENO' },
  { prefix: 'TECHDUTO', brand: 'TECHDUTO' },
  { prefix: 'TEGAF', brand: 'TEGAF' },
  { prefix: 'VEDACIT', brand: 'VEDACIT' },
  { prefix: 'COMPOUND', brand: 'VEDACIT' },
  { prefix: 'BETUFITA', brand: 'VIAPOL' },
  { prefix: 'DESFORMA PLUS', brand: 'VIAPOL' },
  { prefix: 'VEDALAGE', brand: 'VIAPOL' },
  { prefix: 'VIABIT', brand: 'VIAPOL' },
  { prefix: 'VIACAL', brand: 'VIAPOL' },
  { prefix: 'VIAFIX', brand: 'VIAPOL' },
  { prefix: 'VIAPLUS', brand: 'VIAPOL' },
  { prefix: 'VIAPOL', brand: 'VIAPOL' },
  { prefix: 'VITPOLI', brand: 'VIAPOL' },
  { prefix: 'ADEFLEX', brand: 'VIAPOL' },
  { prefix: 'EUCOREPAIR', brand: 'VIAPOL' },
  { prefix: 'BETUFRIO', brand: 'VIAPOL' },
  { prefix: 'BETUPLAST', brand: 'VIAPOL' },
  { prefix: 'CURACRETO', brand: 'VIAPOL' },
  { prefix: 'ECOPRIMER', brand: 'VIAPOL' },
  { prefix: 'SUPERSTOP', brand: 'VIAPOL' },
  { prefix: 'VEDAMAT', brand: 'VIAPOL' },
  { prefix: 'VIABOC', brand: 'VIAPOL' },
  { prefix: 'VIAFLEX', brand: 'VIAPOL' },
  { prefix: 'REMOX', brand: 'REMOX' },
  { prefix: 'SALVATUDO', brand: 'SALVATUDO' }
];

const INVALID_BRANDS = [
  'MUNDO DA IMPERMEABILIZAÇÃO',
  'MARCA PRÓPRIA',
  'MARCA PROPRIA',
  'SEM MARCA',
];

function cleanString(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function normalizeBrand(rawBrand) {
  if (!rawBrand) return null;
  const cleaned = cleanString(rawBrand);
  if (!cleaned) return null;

  if (INVALID_BRANDS.includes(cleaned)) return null;

  const lowerAlias = cleaned.toLowerCase();
  if (BRAND_ALIASES[lowerAlias]) return BRAND_ALIASES[lowerAlias];

  for (const [alias, realBrand] of Object.entries(BRAND_ALIASES)) {
    if (lowerAlias === alias) return realBrand;
  }
  return cleaned;
}

function inferBrandFromName(productName) {
  if (!productName) return null;
  const cleanedName = cleanString(productName);
  for (const item of INFERENCE_PREFIXES) {
    if (cleanedName.startsWith(cleanString(item.prefix))) {
      return item.brand;
    }
  }
  return null;
}

function resolveFinalBrand(rawBrand, productName) {
  const normalized = normalizeBrand(rawBrand);
  if (normalized) return normalized;
  return inferBrandFromName(productName);
}

async function runNormalization() {
  console.log('🔄 Iniciando Normalização Definitiva de Marcas...');
  
  // 1. Fetch all products
  const { data: products, error } = await supabase.from('products').select('id, name, brand, slug');
  if (error) {
    console.error('❌ Erro ao buscar produtos:', error);
    process.exit(1);
  }

  const reports = {
    total: products.length,
    updated: 0,
    noMatch: 0,
    changes: [],
    orphans: [] // Not directly computed here without full scan, but we'll show unique brands
  };

  const finalBrandsSet = new Set();

  for (const product of products) {
    const originalBrand = product.brand;
    const finalBrand = resolveFinalBrand(originalBrand, product.name);

    if (finalBrand) {
      finalBrandsSet.add(finalBrand);
    } else {
      reports.noMatch++;
    }

    if (originalBrand !== finalBrand) {
      reports.updated++;
      reports.changes.push({
        name: product.name,
        old: originalBrand,
        new: finalBrand || '[Sem Correspondência]'
      });

      // Update Supabase
      await supabase.from('products').update({ brand: finalBrand }).eq('id', product.id);
      process.stdout.write('.');
    }
  }

  console.log(`\n✅ Normalização concluída. Foram analisados ${reports.total} produtos.`);

  // Gerar relatório Markdown
  const reportPath = path.join(process.cwd(), 'reports', 'brand-normalization-report.md');
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const md = `# Relatório de Normalização de Marcas
**Data:** ${new Date().toISOString()}
**Total de Produtos Analisados:** ${reports.total}
**Produtos Atualizados:** ${reports.updated}
**Produtos Sem Match Automático (vazios):** ${reports.noMatch}
**Marcas Únicas Restantes:** ${finalBrandsSet.size}

## Detalhamento das Alterações

| Produto | Marca Antiga | Nova Marca |
|---------|--------------|------------|
${reports.changes.map(c => `| ${c.name} | ${c.old || '*vazio*'} | ${c.new} |`).join('\n')}

---
**Observação:**
Qualquer marca não associada a produtos foi virtualmente eliminada do catálogo. 
Marcas que não puderam ser inferidas receberam valor nulo para preenchimento manual no Admin.
`;

  fs.writeFileSync(reportPath, md);
  console.log(`📄 Relatório salvo em: reports/brand-normalization-report.md`);
}

runNormalization();
