import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_PRODUCTS = path.resolve(__dirname, '..', 'public', 'images', 'products');

// Padrões de arquivos inválidos gerados por reprocessamento acidental
const INVALID_PATTERNS = [
  /-400w-400w\.webp$/,
  /-400w-800w\.webp$/,
  /-800w-400w\.webp$/,
  /-800w-800w\.webp$/,
];

let removed = 0;
let scanned = 0;

function cleanDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanDir(fullPath);
    } else {
      scanned++;
      if (INVALID_PATTERNS.some(r => r.test(entry.name))) {
        fs.unlinkSync(fullPath);
        console.log(`  🗑️  Removido: ${path.relative(PUBLIC_PRODUCTS, fullPath)}`);
        removed++;
      }
    }
  }
}

console.log('🧹 Limpando variantes inválidas de public/images/products/...\n');
cleanDir(PUBLIC_PRODUCTS);
console.log(`\n✅ Concluído: ${removed} arquivos removidos de ${scanned} verificados.`);
