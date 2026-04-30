/**
 * patch-failures.cjs
 * Maps the 34 failed downloads to existing local images of the same visual type.
 * Then patches products.ts to eliminate all remaining external URLs.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT     = path.join(__dirname, '..');
const PRODUCTS = path.join(ROOT, 'src/data/products.ts');

// ── Reuse map: product nome (normalized) → existing local path ──────────────
const MANTA_VEDACIT = '/images/products/manta-asfaltica/vedacit-pro-ii-b-poliester-3mm.webp';
const MANTA_VIAPOL  = '/images/products/manta-asfaltica/viapol-betumanta-3-pp-manta-asfaltica.webp';
const FITA_LOCAL    = '/images/products/fitas-aluminizadas/maxton-maxfita-aluminio-20cm-10m.webp';
const SEL_PU        = '/images/products/selantes/q-borg-pu-40-multiuso-branco-800g.webp';
const SILICONE      = '/images/products/selantes/poliplas-silicone-acetico-incolor.webp';

function norm(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Exact normalized nome → local path
const BY_NOME = {
  // Vedacit mantas (403 on mlstatic)
  'vedacit pro ii b aluminio poliester 3mm'          : MANTA_VEDACIT,
  'vedacit pro ii b aluminio glass 3mm'              : MANTA_VEDACIT,
  'vedacit pro iii b poliester 3mm'                  : MANTA_VEDACIT,
  'vedacit pro iii b poliester 4mm'                  : MANTA_VEDACIT,
  'vedacit pro iii b aluminio 3mm'                   : MANTA_VEDACIT,
  'vedacit pro iii b aluminio 4mm manta asfaltica'   : MANTA_VEDACIT,

  // Dryko mantas (404 – wrong WP paths)
  'dryko drykomanta flex tipo ii pp 3mm'             : MANTA_VIAPOL,
  'dryko drykomanta tipo iii pp 3mm'                 : MANTA_VIAPOL,
  'dryko drykomanta tipo iii pp 4mm'                 : MANTA_VIAPOL,
  'dryko drykomanta top tipo iv pp 4mm'              : MANTA_VIAPOL,
  'dryko drykomanta aluminio tipo iii 3mm'           : MANTA_VIAPOL,
  'dryko drykomanta antiraiz tipo iii 4mm'           : MANTA_VIAPOL,

  // Denver mantas
  'denver denvermanta elastic tipo iii 4mm'          : MANTA_VIAPOL,
  'denver impermanta max tipo ii pp 3mm'             : MANTA_VIAPOL,
  'denver impermanta max tipo ii aluminio 3mm'       : MANTA_VIAPOL,

  // Q-Borg mantas
  'q-borg manta asfaltica poliester tipo ii 3mm'     : MANTA_VIAPOL,
  'q-borg manta asfaltica poliester tipo ii 4mm'     : MANTA_VIAPOL,
  'q-borg manta asfaltica aluminio 3mm'              : MANTA_VIAPOL,
  'q-borg manta asfaltica aluminio 30kg'             : MANTA_VIAPOL,

  // Mundo Flex
  'mundo flex manta asfaltica aluminio 3mm'          : MANTA_VIAPOL,

  // Viapol Betufita (404 – wrong media IDs)
  'viapol betufita 20cm fita asfaltica aluminizada'  : FITA_LOCAL,
  'viapol betufita 15cm fita asfaltica aluminizada'  : FITA_LOCAL,
  'viapol betufita 94cm fita asfaltica aluminizada'  : FITA_LOCAL,
  'viapol viaflex sleeve telha fita aluminizada'     : FITA_LOCAL,

  // Dryko Fita Vedatudo (404)
  'dryko fita vedatudo 30cm fita asfaltica aluminizada': FITA_LOCAL,
  'dryko fita vedatudo 20cm fita asfaltica aluminizada': FITA_LOCAL,
  'dryko fita vedatudo 10cm fita asfaltica aluminizada': FITA_LOCAL,
  'dryko fita vedatudo 15cm fita asfaltica aluminizada': FITA_LOCAL,
  'dryko fita vedatudo 60cm fita asfaltica aluminizada': FITA_LOCAL,
  'dryko drykomanta vedatudo al tipo i manta adesiva'  : FITA_LOCAL,

  // Q-Borg PU Bisnaga (404)
  'q-borg pu 40 multiuso preto bisnaga'              : SEL_PU,
  'q-borg pu 40 multiuso branco bisnaga'             : SEL_PU,

  // Q-Borg Silicones (404)
  'q-borg pro silicone acetico incolor'              : SILICONE,
  'q-borg silicone neutro incolor'                   : SILICONE,
};

// ── Patch products.ts ────────────────────────────────────────────────────────
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
      return line.replace(/imagem:\s*'[^']*'/, `imagem: '${local}'`);
    }
  }
  return line;
});

fs.writeFileSync(PRODUCTS, result.join('\n'), 'utf8');
console.log(`✅ Patched ${patched} products`);

// Final external URL count
const final = fs.readFileSync(PRODUCTS, 'utf8');
const remaining = (final.match(/imagem:\s*'https?:\/\//g) || []).length;
console.log(`🔍 External URLs remaining: ${remaining}`);
if (remaining > 0) {
  // List them
  const lines2 = final.split('\n');
  let nome2 = '';
  lines2.forEach(l => {
    const n = l.match(/^\s+nome:\s*'([^']+)'/); if (n) nome2 = n[1];
    if (l.includes('imagem:') && l.includes('http')) console.log(' •', nome2);
  });
}
