/**
 * fix-encoding.js
 * Corrige double-encoding UTF-8 em todos os arquivos .tsx/.ts/.html do projeto.
 * Execucao: node fix-encoding.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mapeamento: string garbled (UTF-8 mal-interpretado como Latin-1) => caractere correto
const REPLACEMENTS = [
  // PT-BR lowercase
  ['Ã§', 'ç'], ['Ã¡', 'á'], ['Ã£', 'ã'], ['Ã©', 'é'],
  ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãµ', 'õ'], ['Ã¼', 'ü'],
  ['Ãª', 'ê'], ['Ã¢', 'â'], ['Ã´', 'ô'], ['Ã±', 'ñ'],
  ['Ã®', 'î'],
  // PT-BR uppercase
  ['Ãš', 'Ú'], ['Ã‰', 'É'], ['Ã"', 'Ó'], ['Ã‡', 'Ç'],
  ['Ã€', 'À'], ['Ã‚', 'Â'], ['Ã', 'Á'],
  // Common symbols
  ['Â°', '°'], ['Â·', '·'], ['Â»', '»'], ['Â«', '«'],
  ['Â©', '©'], ['Â®', '®'],
  // Smart quotes / dashes (common in copy-paste)
  ['\u00e2\u20ac\u201c', '\u2013'], // en dash
  ['\u00e2\u20ac\u201d', '\u2014'], // em dash
];

// Extensoes a verificar
const EXTENSIONS = ['.tsx', '.ts', '.html', '.json'];

// Diretorios a ignorar
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.vite'];

function shouldIgnore(filePath) {
  return IGNORE_DIRS.some(d => filePath.includes(path.sep + d + path.sep) || filePath.endsWith(path.sep + d));
}

function fixFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let fixed = original;
  for (const [bad, good] of REPLACEMENTS) {
    // Use split/join to avoid regex escaping issues
    if (fixed.includes(bad)) {
      fixed = fixed.split(bad).join(good);
    }
  }
  if (fixed !== original) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    return true;
  }
  return false;
}

function walkDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry.name)) {
        results.push(...walkDir(full));
      }
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

// Main
const root = process.cwd();
const files = [
  ...walkDir(path.join(root, 'src')),
  path.join(root, 'index.html'),
].filter(f => fs.existsSync(f));

let fixedCount = 0;
for (const file of files) {
  const wasFixed = fixFile(file);
  if (wasFixed) {
    console.log('FIXED:', path.relative(root, file));
    fixedCount++;
  }
}

console.log(`\nDone. Fixed ${fixedCount} of ${files.length} files.`);
