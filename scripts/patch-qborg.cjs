const fs = require('fs');
const path = require('path');
const PRODUCTS = path.join(__dirname, '../src/data/products.ts');

const MANTA_VIAPOL  = '/images/products/manta-asfaltica/viapol-betumanta-3-pp-manta-asfaltica.webp';
const SEL_PU        = '/images/products/selantes/q-borg-pu-40-multiuso-branco-800g.webp';
const SILICONE      = '/images/products/selantes/poliplas-silicone-acetico-incolor.webp';

const BY_NOME = {
  'q borg manta asfaltica poliester tipo ii 3mm'     : MANTA_VIAPOL,
  'q borg manta asfaltica poliester tipo ii 4mm'     : MANTA_VIAPOL,
  'q borg manta asfaltica aluminio 3mm'              : MANTA_VIAPOL,
  'q borg manta asfaltica aluminio 30kg'             : MANTA_VIAPOL,
  'q borg pu 40 multiuso preto bisnaga'              : SEL_PU,
  'q borg pu 40 multiuso branco bisnaga'             : SEL_PU,
  'q borg pro silicone acetico incolor'              : SILICONE,
  'q borg silicone neutro incolor'                   : SILICONE,
};

function norm(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

const content = fs.readFileSync(PRODUCTS, 'utf8');
const lines   = content.split('\n');
let currentNome = '';
let patched = 0;

const result = lines.map(line => {
  const n = line.match(/^\s+nome:\s*'([^']+)'/);
  if (n) currentNome = norm(n[1]);

  if (line.includes('imagem:') && line.includes('http')) {
    const local = BY_NOME[currentNome];
    if (local) {
      patched++;
      return line.replace(/imagem:\s*'[^']*'/, "imagem: '" + local + "'");
    }
  }
  return line;
});

fs.writeFileSync(PRODUCTS, result.join('\n'), 'utf8');
console.log('✅ Patched', patched, 'Q-Borg products');

const final = fs.readFileSync(PRODUCTS, 'utf8');
const remaining = (final.match(/imagem:\s*'https?:\/\//g) || []).length;
console.log('🔍 External URLs remaining:', remaining);
