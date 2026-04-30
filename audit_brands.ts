// @ts-nocheck
(global as any).import = { meta: { env: { DEV: false, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } } };
(globalThis as any).import = { meta: { env: { DEV: false, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } } };

// Also mock localStorage
(global as any).localStorage = { getItem: () => null, setItem: () => {} };
(global as any).window = { location: { pathname: '' } };

import { products } from './src/data/products';
import * as fs from 'fs';

const missingBrands = products.filter(p => {
  const brand = p.marca ? p.marca.trim().toLowerCase() : '';
  return !brand || brand === 'marca não informada' || brand === 'null' || brand === 'undefined';
});

const groupedByCategory = missingBrands.reduce((acc, p) => {
  const cat = p.categoriaLabel || p.categoria || 'Sem Categoria';
  if (!acc[cat]) acc[cat] = [];
  acc[cat].push(p);
  return acc;
}, {} as Record<string, typeof products>);

const summary = {
  totalMissing: missingBrands.length,
  byCategory: Object.fromEntries(Object.entries(groupedByCategory).map(([k, v]) => [k, v.length]))
};

const exportData = missingBrands.map(p => ({
  name: p.nome,
  category: p.categoriaLabel || p.categoria
}));

console.log('SUMMARY_JSON_START');
console.log(JSON.stringify(summary, null, 2));
console.log('SUMMARY_JSON_END');

let listMarkdown = '# Lista de Produtos sem Marca\n\n';
Object.entries(groupedByCategory).forEach(([cat, prods]) => {
  listMarkdown += `### Categoria: ${cat}\n`;
  prods.forEach(p => {
    listMarkdown += `- ${p.nome}\n`;
  });
  listMarkdown += '\n';
});
fs.writeFileSync('./produtos_sem_marca_listagem.md', listMarkdown, 'utf-8');

fs.writeFileSync('./produtos_sem_marca.json', JSON.stringify(exportData, null, 2), 'utf-8');

// Preparação para estrutura de atualização futura:
const updateStructure = missingBrands.map(p => ({
  slug: p.slug,
  nome: p.nome,
  marca_atual: p.marca || 'VAZIO',
  nova_marca: '' // PREENCHER AQUI
}));
fs.writeFileSync('./planilha_marcas_pendentes.json', JSON.stringify(updateStructure, null, 2), 'utf-8');

