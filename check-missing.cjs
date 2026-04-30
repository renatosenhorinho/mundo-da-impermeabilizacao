const fs = require('fs');

const data = fs.readFileSync('src/data/product-images.json', 'utf8');
const images = JSON.parse(data);

const productsData = fs.readFileSync('src/data/products.ts', 'utf8');
const lines = productsData.split('\n');

const mantaLiquidaSlugs = [];
let currentSlug = null;

for (let line of lines) {
  let m = line.match(/slug:\s+generateSlug\(['"](.+)['"]\)/);
  if (m) {
    currentSlug = m[1].toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, ' ')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/(^-|-$)/g, '');
  } else if ((m = line.match(/slug:\s+['"](.+)['"]/))) {
    currentSlug = m[1];
  }
  
  if (line.includes("categoria: 'manta-liquida'")) {
    mantaLiquidaSlugs.push(currentSlug);
    currentSlug = null;
  }
}

const missing = mantaLiquidaSlugs.filter(slug => !images[slug]);
console.log(missing.join('\n'));
