/**
 * fill-product-images.cjs
 * 
 * Preenche automaticamente a campo `imagem` apenas em produtos que ainda
 * usam placeholder, baseando-se em categoria + nome do produto.
 * 
 * Usa imagens do Unsplash via URL direta (sem API key, via source.unsplash.com).
 * Imagens são agrupadas por categoria/subcategoria para relevância máxima.
 * 
 * REGRAS:
 * - NÃO altera produtos com imagem real já definida
 * - NÃO duplica imagens no mesmo produto
 * - Tenta variar imagens entre produtos da mesma categoria
 */

const fs = require('fs');
const path = require('path');

// ─── Imagens curadas por categoria ───────────────────────────────────────────
// IDs do Unsplash + dimensões padronizadas (800x600 = 4:3)
// Cada grupo tem múltiplas opções para rotação entre produtos

const CATEGORY_IMAGES = {
  // Manta asfáltica
  'manta-asfaltica': [
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1590774668879-17e68b7b4db6?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1517581177684-8c667a6cba5c?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  // Mantas ardosiadas (telhado colorido)
  'mantas-ardosiadas': [
    'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  // Manta líquida / pintura impermeável
  'manta-liquida': [
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1617142137880-2b47bad8ee42?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1507101105822-7472b28602bf?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  // Impermeabilizantes cimentícios (pó, caixa d'água)
  'impermeabilizantes-cimenticios': [
    'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1591792111137-5b8219d5fad6?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1580061573046-d3b7f35b5c50?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  // Primers (produto líquido em lata/tambor escuro)
  'primer': [
    'https://images.unsplash.com/photo-1607400201515-c2c41c07d307?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  // Fitas aluminizadas (fita prateada em rolo)
  'fitas-aluminizadas': [
    'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  // Selantes / silicone / mastique (bisnaga/cartucho)
  'selantes': [
    'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1604709177225-055f99402ea3?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  // Aditivos (embalagens genéricas de construção civil)
  'aditivos': [
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1578922744454-22c07f779e23?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  // Adesivos / epóxi (kit bicomponente, cola)
  'adesivos-e-epoxi': [
    'https://images.unsplash.com/photo-1604709177225-055f99402ea3?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  // Graute / reparação estrutural (concreto, obra pesada)
  'graute-e-reparacao-estrutural': [
    'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1517581177684-8c667a6cba5c?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1576267423445-b2e0074d68a4?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  // Desmoldantes / agentes de cura (forma de concreto)
  'desmoldantes-e-cura': [
    'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  // Drenagem / geotêxteis (manta bidim, branca, jardim)
  'drenagem-e-geotexteis': [
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  // Ferramentas e acessórios (ferramentas de obra)
  'ferramentas-e-acessorios': [
    'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  // fallback genérico (obra de impermeabilização)
  'default': [
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1517581177684-8c667a6cba5c?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1590774668879-17e68b7b4db6?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1591792111137-5b8219d5fad6?w=800&h=600&fit=crop&auto=format&q=80',
  ],
};

// Subcategorias também mapeadas para variação extra
const SUBCATEGORY_OVERRIDES = {
  'mantas-ardosiadas': CATEGORY_IMAGES['mantas-ardosiadas'],
  'mantas-elastomericas': CATEGORY_IMAGES['manta-asfaltica'],
  'mantas-poliester': CATEGORY_IMAGES['manta-asfaltica'],
  'mantas-polietileno': CATEGORY_IMAGES['manta-asfaltica'],
  'primers-asfalticos': CATEGORY_IMAGES['primer'],
  'primers-epoxi': CATEGORY_IMAGES['adesivos-e-epoxi'],
  'mastique': CATEGORY_IMAGES['selantes'],
  'selante-silicone': CATEGORY_IMAGES['selantes'],
  'selante-pu': CATEGORY_IMAGES['selantes'],
  'adesivo-epoxi': CATEGORY_IMAGES['adesivos-e-epoxi'],
  'adesivo-chapisco': CATEGORY_IMAGES['aditivos'],
  'aditivos-impermeabilizantes': CATEGORY_IMAGES['aditivos'],
  'aditivos-plastificantes': CATEGORY_IMAGES['aditivos'],
  'aditivos-adesivos': CATEGORY_IMAGES['adesivos-e-epoxi'],
  'aditivos-especiais': CATEGORY_IMAGES['aditivos'],
  'graute': CATEGORY_IMAGES['graute-e-reparacao-estrutural'],
  'reparo-de-concreto': CATEGORY_IMAGES['graute-e-reparacao-estrutural'],
  'reparo-e-protecao-de-superficies': CATEGORY_IMAGES['graute-e-reparacao-estrutural'],
  'protecao-anticorrosiva': CATEGORY_IMAGES['graute-e-reparacao-estrutural'],
  'agente-de-cura': CATEGORY_IMAGES['desmoldantes-e-cura'],
  'desmoldante': CATEGORY_IMAGES['desmoldantes-e-cura'],
  'geotextil': CATEGORY_IMAGES['drenagem-e-geotexteis'],
  'drenagem': CATEGORY_IMAGES['drenagem-e-geotexteis'],
  'placas-xps': CATEGORY_IMAGES['ferramentas-e-acessorios'],
  'protecao-e-reforco': CATEGORY_IMAGES['ferramentas-e-acessorios'],
  'acessorios-de-aplicacao': CATEGORY_IMAGES['ferramentas-e-acessorios'],
  'fitas-adesivas': CATEGORY_IMAGES['fitas-aluminizadas'],
  'selamento-e-juntas': CATEGORY_IMAGES['selantes'],
  'limpeza-e-preparo': CATEGORY_IMAGES['ferramentas-e-acessorios'],
  'argamassa-polimerica': CATEGORY_IMAGES['impermeabilizantes-cimenticios'],
  'argamassa-polimerica-flexivel': CATEGORY_IMAGES['impermeabilizantes-cimenticios'],
};

// ─── Lógica principal ─────────────────────────────────────────────────────────

const PLACEHOLDER = "'/images/products/placeholder.svg'";
const PLACEHOLDER_WEBP = "'/images/products/placeholder.webp'";

const filePath = path.join(__dirname, '../src/data/products.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Counters per category for image rotation
const categoryCounters = {};

function getImageForProduct(categoria, subcategoria) {
  // Determine pool
  const subPool = subcategoria && SUBCATEGORY_OVERRIDES[subcategoria];
  const catPool = CATEGORY_IMAGES[categoria] || CATEGORY_IMAGES['default'];
  const pool = subPool || catPool;

  const key = subcategoria || categoria;
  if (!categoryCounters[key]) categoryCounters[key] = 0;
  const img = pool[categoryCounters[key] % pool.length];
  categoryCounters[key]++;
  return img;
}

// Parse all products blocks to find those with placeholder images
// Strategy: scan line by line, track context, replace placeholder imagem lines
const lines = content.split('\n');
let currentCategoria = '';
let currentSubcategoria = '';
let replacements = 0;

const newLines = lines.map((line, i) => {
  // Track categoria
  const catMatch = line.match(/^\s+categoria:\s*['"]([^'"]+)['"]/);
  if (catMatch) { currentCategoria = catMatch[1]; currentSubcategoria = ''; }

  // Track subcategoria
  const subMatch = line.match(/^\s+subcategoria:\s*['"]([^'"]+)['"]/);
  if (subMatch) { currentSubcategoria = subMatch[1]; }

  // Reset on new product object
  if (line.trim() === '{') {
    // Don't reset here, let categoria assignment do it
  }

  // Check if this is a placeholder imagem line
  const isPlaceholderLine = line.includes("imagem:") && (
    line.includes("placeholder.svg") ||
    line.includes("placeholder.webp")
  );

  if (isPlaceholderLine) {
    const url = getImageForProduct(currentCategoria, currentSubcategoria);
    const indent = line.match(/^(\s*)/)[1];
    replacements++;
    return `${indent}imagem: '${url}',`;
  }

  return line;
});

const newContent = newLines.join('\n');

// Backup original
fs.writeFileSync(filePath + '.bak-before-fill', content, 'utf8');

// Write updated file
fs.writeFileSync(filePath, newContent, 'utf8');

console.log(`✅ Done! ${replacements} produto(s) tiveram imagens preenchidas.`);
console.log(`📦 Backup salvo em: ${filePath}.bak-before-fill`);
console.log('\nDistribuição por categoria:');
Object.entries(categoryCounters).forEach(([k, v]) => {
  console.log(`  ${k}: ${v} imagens atribuídas`);
});
