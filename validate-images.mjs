import fs from 'fs';
import path from 'path';

const DATA_FILE = 'src/data/products.ts';
const productsContent = fs.readFileSync(DATA_FILE, 'utf-8');
const entries = productsContent.split(/\{/).slice(1);
const products = [];

entries.forEach(entry => {
  const nomeMatch = entry.match(/nome:\s*['"`](.*?)['"`]/);
  const slugMatch = entry.match(/slug:\s*(?:generateSlug\(['"`](.*?)['"`]\)|['"`](.*?)['"`])/);
  const catMatch = entry.match(/categoria:\s*['"`](.*?)['"`]/);
  const imgMatch = entry.match(/imagem:\s*['"`](.*?)['"`]/);
  const ativoMatch = entry.match(/ativo:\s*(true|false)/);
  
  if (!slugMatch || !nomeMatch || !catMatch || (ativoMatch && ativoMatch[1] === 'false')) return;

  const rawSlug = slugMatch[1] || slugMatch[2];
  const finalSlug = rawSlug.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, '');
  
  products.push({
    nome: nomeMatch[1],
    slug: finalSlug,
    categoria: catMatch[1],
    manualImg: imgMatch ? imgMatch[1] : null
  });
});

const CATEGORY_FOLDERS = {
  'impermeabilizantes-cimenticios': 'impermeabilizantes-cimenticios',
  'manta-liquida': 'manta-liquida',
  'manta-asfaltica': 'manta-asfaltica',
  'primer': 'primer',
  'fitas-aluminizadas': 'fitas-aluminizadas',
  'selantes': 'selantes',
  'aditivos': 'aditivos',
  'adesivos-e-epoxi': 'adesivos-e-epoxi',
  'graute-e-reparacao-estrutural': 'graute-e-reparacao-estrutural',
  'desmoldantes-e-cura': 'desmoldantes-e-cura',
  'drenagem-e-geotexteis': 'drenagem-e-geotexteis',
  'ferramentas-e-acessorios': 'ferramentas-e-acessorios',
};

const withImage = [];
const withPlaceholder = [];

products.forEach(p => {
  // If manual image exists and is not a generic placeholder
  if (p.manualImg && !p.manualImg.includes('placeholder')) {
    withImage.push(p);
    return;
  }
  
  const folder = CATEGORY_FOLDERS[p.categoria] || p.categoria;
  const webpPath = path.join('public', 'images', 'products', folder, `${p.slug}.webp`);
  
  if (fs.existsSync(webpPath)) {
    withImage.push(p);
  } else {
    withPlaceholder.push(p);
  }
});

let md = '# Relatório de Validação de Imagens\n\n';
md += `**Total de Produtos Ativos Analisados:** ${products.length}\n`;
md += `**Com Imagem Própria:** ${withImage.length}\n`;
md += `**Usando Placeholder:** ${withPlaceholder.length}\n\n`;

md += '## Produtos com Imagem Correta\n\n';
withImage.forEach(p => md += `- ${p.nome} (\`${p.slug}\`)\n`);

md += '\n## Produtos Usando Placeholder\n\n';
withPlaceholder.forEach(p => md += `- ${p.nome} (\`${p.slug}\`)\n`);

const outPath = 'C:\\Users\\Midia_Lab\\.gemini\\antigravity\\brain\\9377b289-a95b-4973-b63f-99ea168a259c\\validation_report.md';
fs.writeFileSync(outPath, md);
console.log(`✅ Relatório de validação criado.`);
