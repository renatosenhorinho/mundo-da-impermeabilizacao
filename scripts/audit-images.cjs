const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../src/data/products.ts'), 'utf8');
const lines = content.split('\n');

const stats = { placeholder: 0, noImage: 0, withImage: 0, total: 0 };
const placeholderLines = [];
const nameLines = {};

// Build a map: line -> product name
let lastNome = '';
let lastSlug = '';
let lastCategoria = '';

lines.forEach((line, i) => {
  const nomMatch = line.match(/nome:\s*['"](.+?)['"]/);
  if (nomMatch) { lastNome = nomMatch[1]; }
  const slugMatch = line.match(/slug:\s*(?:generateSlug\(['"](.+?)['"]\)|['"](.+?)['"])/);
  if (slugMatch) { lastSlug = slugMatch[1] || slugMatch[2]; }
  const catMatch = line.match(/categoria:\s*['"](.+?)['"]/);
  if (catMatch) { lastCategoria = catMatch[1]; }

  if (line.includes("imagem:")) {
    stats.total++;
    if (line.includes('placeholder')) {
      stats.placeholder++;
      placeholderLines.push({ lineNum: i + 1, content: line.trim(), nome: lastNome, slug: lastSlug, categoria: lastCategoria });
    } else if (line.match(/imagem:\s*['"]{2}/)) {
      stats.noImage++;
      placeholderLines.push({ lineNum: i + 1, content: line.trim(), nome: lastNome, slug: lastSlug, categoria: lastCategoria });
    } else {
      stats.withImage++;
    }
  }
});

console.log('=== STATS ===');
console.log(JSON.stringify(stats, null, 2));
console.log('\n=== PRODUCTS WITHOUT REAL IMAGE ===');
placeholderLines.forEach(l => {
  console.log(`Line ${l.lineNum} | ${l.categoria} | ${l.nome}`);
});
console.log('\nTotal:', placeholderLines.length);
