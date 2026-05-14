import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const content = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(content.split('\n').filter(line => line && !line.startsWith('#')).map(line => {
  const [key, ...rest] = line.split('=');
  return [key.trim(), rest.join('=').trim().replace(/^"|"$/g, '')];
}));

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

const TIPOS_KEYWORDS = {
  'manta-asfaltica': ['manta asf', 'manta liquida', 'aluminizada', 'ardosiada'], // wait, manta liquida is different
  'manta-liquida': ['manta liquida', 'manta liquida'],
  'selante': ['selante', 'pu 40', 'poliuretano', 'mastique'],
  'fita-aluminizada': ['fita aluminizada', 'fita multiuso', 'drykofita', 'vedafita', 'fita asfaltica'],
  'impermeabilizante-cimenticio': ['cimenticio', 'argamassa polimerica', 'vedatop', 'viaplus', 'tecplus', 'denvertec'],
  'primer': ['primer', 'pintura de ligacao', 'eco primer', 'pinta', 'betume'],
  'adesivo': ['adesivo', 'cola', 'epoxi', 'chapix', 'bianco'],
  'geotextil': ['geotextil', 'bidim', 'drenagem', 'manta bidim'],
  'aditivo': ['aditivo', 'plastificante', 'impermeabilizante de argamassa', 'vedalit', 'arcalit'],
  'silicone': ['silicone'],
  'membrana-acrilica': ['membrana acrilica', 'acrilico', 'emulsao acrilica', 'vedapren'],
  'emulsao-asfaltica': ['emulsao asfaltica', 'neutrol'],
};

// Fix the manual ones
delete TIPOS_KEYWORDS['manta-asfaltica'][1]; // remove manta liquida

const APLICACOES_KEYWORDS = {
  'lajes': ['laje', 'cobertura plana', 'terracos'],
  'telhados': ['telhado', 'cobertura', 'telha'],
  'calhas': ['calha', 'rufo', 'pingadeira'],
  'banheiros': ['banheiro', 'area molhada', 'box'],
  'piscinas': ['piscina', 'reservatorio', 'caixa d', 'tanque'],
  'reservatorios': ['reservatorio', 'caixa d', 'tanque', 'piscina'],
  'areas-frias': ['area fria', 'cozinha', 'lavanderia', 'banheiro'],
  'paredes': ['parede', 'muro', 'fachada'],
  'muros': ['muro', 'arrimo'],
  'fundacao': ['fundacao', 'alicerce', 'baldrame', 'sapata', 'subsolo', 'arrimo'],
  'rodapes': ['rodape'],
  'juntas': ['junta', 'fissura', 'dilatacao'],
  'trincas': ['trinca', 'fissura', 'rachadura'],
  'fachadas': ['fachada', 'parede externa'],
  'madeira': ['madeira'],
  'metal': ['metal', 'galvanizado', 'aluminio'],
};

function normalizeSlugs(textArr, keywordsMap) {
  const matchedSlugs = new Set();
  const contentToSearch = textArr.join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  for (const [slug, keywords] of Object.entries(keywordsMap)) {
    for (const kw of keywords) {
      if (contentToSearch.includes(kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
        matchedSlugs.add(slug);
        break;
      }
    }
  }
  return Array.from(matchedSlugs);
}

async function run() {
  console.log("=== INICIANDO NORMALIZAÇÃO DE TIPOS E APLICAÇÕES ===");
  
  const { data: products, error } = await supabase.from('products').select('*');
  if (error) {
    console.error("Erro ao buscar produtos:", error);
    process.exit(1);
  }

  console.log(`Analisando ${products.length} produtos...`);
  
  const updates = [];
  
  for (const p of products) {
    // Collect all searchable text for this product
    const searchContext = [
      p.name,
      p.category,
      p.description,
      ...(p.aplicacao || []),
      ...(p.specs ? Object.values(p.specs) : [])
    ].filter(Boolean);

    const detectedTipos = normalizeSlugs(searchContext, TIPOS_KEYWORDS);
    const detectedAplicacoes = normalizeSlugs(searchContext, APLICACOES_KEYWORDS);
    
    // Se manta-asfaltica e manta-liquida baterem, o regex pode confundir. Manta liquida overrides manta asfaltica if it's explicitly liquida
    if (detectedTipos.includes('manta-liquida') && searchContext.join(' ').toLowerCase().includes('liquida')) {
      const idx = detectedTipos.indexOf('manta-asfaltica');
      if (idx !== -1) detectedTipos.splice(idx, 1);
    }

    // Update product
    const updatePayload = {
      id: p.id,
      tipo: detectedTipos.length > 0 ? detectedTipos : p.tipo,
      // For aplicacao, if we found matches, we replace the long sentences with standard tags.
      aplicacao: detectedAplicacoes.length > 0 ? detectedAplicacoes : p.aplicacao
    };

    updates.push(updatePayload);
  }

  console.log(`Aplicando atualizações em ${updates.length} produtos...`);

  let successCount = 0;
  for (const u of updates) {
    const { error } = await supabase.from('products').update({
      tipo: u.tipo,
      aplicacao: u.aplicacao
    }).eq('id', u.id);
    
    if (error) {
      console.error(`Erro ao atualizar ${u.id}:`, error.message);
    } else {
      successCount++;
    }
  }

  console.log(`\n=== RESUMO DA OPERAÇÃO ===`);
  console.log(`Produtos processados: ${products.length}`);
  console.log(`Atualizados com sucesso: ${successCount}`);
  console.log(`Falhas: ${products.length - successCount}`);
  console.log(`\nTags foram padronizadas!`);
}

run();
