/**
 * insert-missing-products.cjs
 * Insere os produtos não cadastrados no Supabase.
 * Uso: node insert-missing-products.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Lê .env manualmente ──────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontrados no .env');
  process.exit(1);
}

// ── Helper: gera slug ────────────────────────────────────────────────────────
function slug(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ── Produtos ausentes ────────────────────────────────────────────────────────
const missingProducts = [
  // ── ADEFLEX
  { nomeOriginal: 'ADEFLEX LT 18 L', nome: 'Adeflex 18L', marca: 'Adeflex', embalagem: 'Balde 18L', unidade: 'L', categoria: 'aditivos', categoriaLabel: 'Aditivos Impermeabilizantes' },

  // ── ARGAMASSAS / DO MESTRE
  { nomeOriginal: 'ARG. CHAPISCO ESTRUTURAL COLANTE 25 KG', nome: 'Argamassa Chapisco Estrutural Colante 25kg', marca: 'Diversas', embalagem: 'Saco 25kg', unidade: 'sc', categoria: 'adesivos-e-epoxi', categoriaLabel: 'Adesivos e Epóxi' },
  { nomeOriginal: 'ARG. COLANTE AC II 20 KG ARM - DO MESTRE', nome: 'Do Mestre Argamassa Colante AC II 20kg', marca: 'Do Mestre', embalagem: 'Saco 20kg', unidade: 'sc', categoria: 'adesivos-e-epoxi', categoriaLabel: 'Adesivos e Epóxi' },
  { nomeOriginal: 'ARG. COLANTE AC III D 20 KG - DO MESTRE', nome: 'Do Mestre Argamassa Colante AC III D 20kg', marca: 'Do Mestre', embalagem: 'Saco 20kg', unidade: 'sc', categoria: 'adesivos-e-epoxi', categoriaLabel: 'Adesivos e Epóxi' },

  // ── BAUTECH – Manta Líquida
  { nomeOriginal: 'BAUTECH MANTA LIQUIDA INCOLOR 8KG', nome: 'Bautech Manta Líquida Incolor 8kg', marca: 'Bautech', embalagem: 'Balde 8kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'BAUTECH MANTA LIQUIDA INCOLOR 900 ML', nome: 'Bautech Manta Líquida Incolor 900ml', marca: 'Bautech', embalagem: 'Frasco 900ml', unidade: 'L', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },

  // ── BAUTECH – Pintura Emborrachada
  { nomeOriginal: 'BAUTECH PINT EMBOR IMPER ALGODAO EGIPCIO 2', nome: 'Bautech Pintura Emborrachada Impermeável Algodão Egípcio', marca: 'Bautech', embalagem: 'Balde', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'BAUTECH PINT EMBOR IMPER BRANCA 20KG', nome: 'Bautech Pintura Emborrachada Impermeável Branca 20kg', marca: 'Bautech', embalagem: 'Balde 20kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'BAUTECH PINT EMBOR IMPER BRANCA 4KG', nome: 'Bautech Pintura Emborrachada Impermeável Branca 4kg', marca: 'Bautech', embalagem: 'Balde 4kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'BAUTECH PINT EMBOR IMPER CONCRETO 20KG', nome: 'Bautech Pintura Emborrachada Impermeável Concreto 20kg', marca: 'Bautech', embalagem: 'Balde 20kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'BAUTECH PINT EMBOR IMPER CONCRETO 4KG', nome: 'Bautech Pintura Emborrachada Impermeável Concreto 4kg', marca: 'Bautech', embalagem: 'Balde 4kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'BAUTECH PINT EMBOR IMPER PLATINA 20KG', nome: 'Bautech Pintura Emborrachada Impermeável Platina 20kg', marca: 'Bautech', embalagem: 'Balde 20kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'BAUTECH PINT EMBOR IMPER PLATINA 4KG', nome: 'Bautech Pintura Emborrachada Impermeável Platina 4kg', marca: 'Bautech', embalagem: 'Balde 4kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },

  // ── BAUTECH – Tinta Piso Blindado
  { nomeOriginal: 'BAUTECH TINTA PISO BLINDADO BRANCO 20 KG', nome: 'Bautech Tinta Piso Blindado Branco 20kg', marca: 'Bautech', embalagem: 'Balde 20kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'BAUTECH TINTA PISO BLINDADO CINZA PLATINA 20 I', nome: 'Bautech Tinta Piso Blindado Cinza Platina 20kg', marca: 'Bautech', embalagem: 'Balde 20kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'BAUTECH TINTA PISO BLINDADO CINZA PLATINA 4 K', nome: 'Bautech Tinta Piso Blindado Cinza Platina 4kg', marca: 'Bautech', embalagem: 'Balde 4kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'BAUTECH TINTA PISO BLINDADO GRAFITE 20 KG', nome: 'Bautech Tinta Piso Blindado Grafite 20kg', marca: 'Bautech', embalagem: 'Balde 20kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'BAUTECH TINTA PISO BLINDADO GRAFITE 4 KG', nome: 'Bautech Tinta Piso Blindado Grafite 4kg', marca: 'Bautech', embalagem: 'Balde 4kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'BAUTECH TINTA PISO BLINDADO INCOLOR 20 KG', nome: 'Bautech Tinta Piso Blindado Incolor 20kg', marca: 'Bautech', embalagem: 'Balde 20kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'BAUTECH TINTA PISO BLINDADO INCOLOR 4 KG', nome: 'Bautech Tinta Piso Blindado Incolor 4kg', marca: 'Bautech', embalagem: 'Balde 4kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },

  // ── BETUFRIO / BETUPLAST
  { nomeOriginal: 'BETUFRIO BD 20 KG', nome: 'Betufrio Emulsão Asfáltica Fria 20kg', marca: 'Viapol', embalagem: 'Balde 20kg', unidade: 'kg', categoria: 'primer', categoriaLabel: 'Primers e Imprimações' },
  { nomeOriginal: 'BETUPLAST SC 25KG', nome: 'Betuplast 25kg', marca: 'Viapol', embalagem: 'Saco 25kg', unidade: 'sc', categoria: 'aditivos', categoriaLabel: 'Aditivos Impermeabilizantes' },

  // ── DENVER
  { nomeOriginal: 'DENVERFRIO ASFALTO - BD 20KG - DENVER', nome: 'Denver Denverfrio Asfalto 20kg', marca: 'Denver', embalagem: 'Balde 20kg', unidade: 'kg', categoria: 'primer', categoriaLabel: 'Primers e Imprimações' },

  // ── DRYKO
  { nomeOriginal: 'DRYKO ASFALTO OXID TIPO II SC 10KG', nome: 'Dryko Asfalto Oxidado Tipo II 10kg', marca: 'Dryko', embalagem: 'Saco 10kg', unidade: 'sc', categoria: 'manta-asfaltica', categoriaLabel: 'Manta Asfáltica' },
  { nomeOriginal: 'DRYKO CAMADA SEPARADORA 200X1', nome: 'Dryko Camada Separadora 200x1m', marca: 'Dryko', embalagem: 'Rolo 200m²', unidade: 'm²', categoria: 'drenagem-e-geotexteis', categoriaLabel: 'Drenagem e Geotêxteis' },
  { nomeOriginal: 'DRYKOPREN PRETO BD 18 L', nome: 'Dryko Drykopren Preto 18L', marca: 'Dryko', embalagem: 'Balde 18L', unidade: 'L', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },

  // ── DIVERSOS
  { nomeOriginal: 'FIO MEADA DE CISAL.- KG', nome: 'Fio Meada de Sisal (kg)', marca: 'Diversas', embalagem: 'kg', unidade: 'kg', categoria: 'ferramentas-e-acessorios', categoriaLabel: 'Ferramentas e Acessórios' },

  // ── MAXTON / KALFACIL
  { nomeOriginal: 'KALFACIL - BALDE 18KG - MAXTON', nome: 'Maxton Kalfacil 18kg', marca: 'Maxton', embalagem: 'Balde 18kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'KALFACIL - TAMBOR 200KG - MAXTON', nome: 'Maxton Kalfacil 200kg', marca: 'Maxton', embalagem: 'Tambor 200kg', unidade: 'kg', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },

  // ── MF-12
  { nomeOriginal: 'MF-12 BRANCA GL 6,5KG', nome: 'MF-12 Manta Líquida Branca 6,5kg', marca: 'Diversas', embalagem: 'Galão 6,5kg', unidade: 'gl', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },

  // ── Q-BORG
  { nomeOriginal: 'Q-BORG CHAPISCO 18 KG', nome: 'Q-Borg Chapisco 18kg', marca: 'Qborg', embalagem: 'Balde 18kg', unidade: 'kg', categoria: 'adesivos-e-epoxi', categoriaLabel: 'Adesivos e Epóxi' },

  // ── QUARTZOLIT
  { nomeOriginal: 'QUARTZOLIT -REJ CERAMICAS CORDA 5KG FD30KG', nome: 'Quartzolit Rejunte para Cerâmicas Corda 5kg', marca: 'Quartzolit', embalagem: 'Caixa 5kg', unidade: 'cx', categoria: 'aditivos', categoriaLabel: 'Aditivos Impermeabilizantes' },

  // ── SELATON
  { nomeOriginal: 'SELATON - BALDE 18 KG', nome: 'Selaton 18kg', marca: 'Diversas', embalagem: 'Balde 18kg', unidade: 'kg', categoria: 'selantes', categoriaLabel: 'Selantes e Mástiques' },

  // ── TECHDUTO
  { nomeOriginal: 'TECHDUTO EMENDA RAPIDA 100 MM DR', nome: 'Techduto Emenda Rápida 100mm', marca: 'Techduto', embalagem: 'un', unidade: 'un', categoria: 'drenagem-e-geotexteis', categoriaLabel: 'Drenagem e Geotêxteis' },
  { nomeOriginal: 'TECHDUTO EMENDA RAPIDA 160 MM DR', nome: 'Techduto Emenda Rápida 160mm', marca: 'Techduto', embalagem: 'un', unidade: 'un', categoria: 'drenagem-e-geotexteis', categoriaLabel: 'Drenagem e Geotêxteis' },
  { nomeOriginal: 'TECHDUTO LUVA DE EMENDA 63 MM', nome: 'Techduto Luva de Emenda 63mm', marca: 'Techduto', embalagem: 'un', unidade: 'un', categoria: 'drenagem-e-geotexteis', categoriaLabel: 'Drenagem e Geotêxteis' },
  { nomeOriginal: 'TECHDUTO TAPE PRETA 50MM X 50M', nome: 'Techduto Tape Preta 50mm × 50m', marca: 'Techduto', embalagem: 'Rolo 50m', unidade: 'm', categoria: 'drenagem-e-geotexteis', categoriaLabel: 'Drenagem e Geotêxteis' },

  // ── TECIDO / TELA
  { nomeOriginal: 'TECIDO SUB COBERTURA DUPLO 25M2', nome: 'Tecido Sub Cobertura Duplo 25m²', marca: 'Diversas', embalagem: 'Rolo 25m²', unidade: 'm²', categoria: 'drenagem-e-geotexteis', categoriaLabel: 'Drenagem e Geotêxteis' },
  { nomeOriginal: 'TELA DE POLIESTER 1,00 X 50MT - RESINADA MALHA', nome: 'Tela de Poliéster Resinada Malha 1,00×50m', marca: 'Branyl', embalagem: 'Rolo 50m', unidade: 'm²', categoria: 'drenagem-e-geotexteis', categoriaLabel: 'Drenagem e Geotêxteis' },

  // ── TECHDRENO
  { nomeOriginal: 'TUBO TECHDRENO SD SN5 63 MM 50 M', nome: 'Techdreno Tubo SD SN5 63mm 50m', marca: 'Techdreno', embalagem: 'Rolo 50m', unidade: 'm', categoria: 'drenagem-e-geotexteis', categoriaLabel: 'Drenagem e Geotêxteis' },
  { nomeOriginal: 'TUBO TECHDRENO SD SN5 100 MM 50 M', nome: 'Techdreno Tubo SD SN5 100mm 50m', marca: 'Techdreno', embalagem: 'Rolo 50m', unidade: 'm', categoria: 'drenagem-e-geotexteis', categoriaLabel: 'Drenagem e Geotêxteis' },
  { nomeOriginal: 'TUBO TECHDRENO SD SN5 160 MM 50 M', nome: 'Techdreno Tubo SD SN5 160mm 50m', marca: 'Techdreno', embalagem: 'Rolo 50m', unidade: 'm', categoria: 'drenagem-e-geotexteis', categoriaLabel: 'Drenagem e Geotêxteis' },

  // ── VASELINA
  { nomeOriginal: 'VASELINA EMCAPLUS 70 LF - 175kg', nome: 'Vaselina Emcaplus 70 LF 175kg', marca: 'Emcaplus', embalagem: 'Tambor 175kg', unidade: 'kg', categoria: 'desmoldantes-e-cura', categoriaLabel: 'Desmoldantes e Agentes de Cura' },

  // ── VEDACIT
  { nomeOriginal: 'VEDACIT - NEUTROL B ACQUA 18 L BD', nome: 'Vedacit Neutrol B Acqua 18L', marca: 'Vedacit', embalagem: 'Balde 18L', unidade: 'L', categoria: 'primer', categoriaLabel: 'Primers e Imprimações' },
  { nomeOriginal: 'VEDACIT PROTETOR BASE ZINCO CX 6 LT 900', nome: 'Vedacit Protetor Base Zinco 6L', marca: 'Vedacit', embalagem: 'Caixa 6L', unidade: 'L', categoria: 'aditivos', categoriaLabel: 'Aditivos Impermeabilizantes' },

  // ── VIAPOL / VIABIT
  { nomeOriginal: 'VIABIT ACQUA - ANTIGO ECOL 2 BD 18 L - VIAPOL', nome: 'Viapol Viabit Acqua 18L', marca: 'Viapol', embalagem: 'Balde 18L', unidade: 'L', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
  { nomeOriginal: 'VIABIT LT 18 L', nome: 'Viabit 18L', marca: 'Viapol', embalagem: 'Balde 18L', unidade: 'L', categoria: 'manta-liquida', categoriaLabel: 'Manta Líquida' },
];

// ── Monta registros para inserção ────────────────────────────────────────────
function buildRecord(p) {
  return {
    id: slug(p.nome),
    name: p.nome,
    category: p.categoria,
    image: '',
    description: `${p.marca} — ${p.embalagem}. ${p.nomeOriginal}`,
    highlight: false,
    active: true,
  };
}

// ── Envia para Supabase via fetch ────────────────────────────────────────────
async function supabaseUpsert(records) {
  const url = `${SUPABASE_URL}/rest/v1/products`;
  const body = JSON.stringify(records);

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=ignore-duplicates,return=representation',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 Inserindo ${missingProducts.length} produtos no Supabase...`);
  console.log(`📡 URL: ${SUPABASE_URL}\n`);

  const records = missingProducts.map(buildRecord);

  // Insere em lotes de 10
  const batchSize = 10;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(`📦 Lote ${Math.floor(i / batchSize) + 1}: enviando ${batch.length} produtos...`);

    try {
      const result = await supabaseUpsert(batch);

      if (result.status === 201 || result.status === 200) {
        console.log(`   ✅ OK (status ${result.status})`);
        inserted += batch.length;
      } else {
        console.error(`   ❌ Erro status ${result.status}:`);
        console.error(`   ${result.body.substring(0, 300)}`);
        errors += batch.length;

        // Tenta inserir um por um para identificar o problema
        if (result.status === 409 || result.status === 400) {
          console.log('   🔄 Tentando individualmente...');
          for (const rec of batch) {
            const r2 = await supabaseUpsert([rec]);
            if (r2.status === 201 || r2.status === 200) {
              console.log(`      ✅ ${rec.nome}`);
              inserted++;
              errors--;
            } else {
              console.log(`      ❌ ${rec.nome} → ${r2.body.substring(0, 120)}`);
            }
          }
        }
      }
    } catch (err) {
      console.error(`   ❌ Falha na requisição: ${err.message}`);
      errors += batch.length;
    }
  }

  console.log('\n──────────────────────────────────────');
  console.log(`✅ Inseridos: ${inserted}`);
  console.log(`❌ Erros:    ${errors}`);
  console.log('──────────────────────────────────────\n');

  if (errors > 0) {
    console.log('💡 Dica: Se o erro for sobre colunas, verifique o schema da tabela "products" no Supabase.');
    console.log('   As colunas esperadas são: codigo, nome_original, nome, slug, categoria, categoria_label,');
    console.log('   marca, embalagem, unidade, quantidade_estoque, resumo, aplicacao, como_usar,');
    console.log('   destaque, ativo, ordem, palavras_chave\n');
  }
}

main().catch(console.error);
