const fs = require('fs'), path = require('path');
const MLB_ARGAMASSA  = 'https://http2.mlstatic.com/D_NQ_NP_906325-MLB47668600813_092021-O.webp';
const MLB_FITA       = 'https://http2.mlstatic.com/D_NQ_NP_994966-MLB51275468160_082022-O.webp';
const MLB_PRIMER     = 'https://http2.mlstatic.com/D_NQ_NP_833866-MLB70494128062_072023-O.webp';
const MLB_SELANTE    = 'https://http2.mlstatic.com/D_NQ_NP_908868-MLB80582294157_112024-O.webp';
const MLB_ESPUMA     = 'https://http2.mlstatic.com/D_NQ_NP_963157-MLB71004128062_082023-O.webp';

const EXTRA = {
  'q borg uso geral 90cm fita asfaltica aluminizada': MLB_FITA,
  'denver denvertec 540 argamassa polimerica flexivel': MLB_ARGAMASSA,
  'denver denvertec 540 argamassa polimerica com fibras': MLB_ARGAMASSA,
  'viapol viaplus protec argamassa polimerica': MLB_ARGAMASSA,
  'viapol vedamat 100 argamassa polimerica': MLB_ARGAMASSA,
  'maxton veda facil plus argamassa polimerica': MLB_ARGAMASSA,
  'maxton veda facil flex argamassa polimerica flexivel': MLB_ARGAMASSA,
  'maxton veda facil flex fibras argamassa polimerica': MLB_ARGAMASSA,
  'maxton veda facil flex uv argamassa polimerica': MLB_ARGAMASSA,
  'maxton veda facil rodape argamassa impermeabilizante': MLB_ARGAMASSA,
  'maxton veda facil tamp cimento de pega rapida': MLB_ARGAMASSA,
  'viapol viaplus 5000 fibras argamassa polimerica 18kg': MLB_ARGAMASSA,
  'vedacit pro primer asfaltico solvente': MLB_PRIMER,
  'q borg primer asfaltico': MLB_PRIMER,
  'q borg pu 40 multiuso branco 800g': MLB_SELANTE,
  'q borg pu 40 multiuso cinza sache': MLB_SELANTE,
  'q borg pu 40 multiuso preto sache': MLB_SELANTE,
  'q borg pu 40 multiuso cinza 310ml': MLB_SELANTE,
  'q borg pro selante para calhas e rufos cinza': MLB_SELANTE,
  'q borg pu q 25 premium cinza': MLB_SELANTE,
  'q borg pu q 25 premium branco': MLB_SELANTE,
  'q borg espuma de pu uso geral 500ml': MLB_ESPUMA,
};

function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}

const filePath = path.join(__dirname, '../src/data/products.ts');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
let currentNome = '', replaced = 0;

const result = lines.map(line => {
  const n = line.match(/^\s+nome:\s*'([^']+)'/);
  if (n) currentNome = norm(n[1]);
  if (line.includes('imagem:') && line.includes('unsplash')) {
    const url = EXTRA[currentNome];
    if (url) {
      replaced++;
      return line.replace(/imagem:\s*'[^']*'/, "imagem: '" + url + "'");
    }
  }
  return line;
});

fs.writeFileSync(filePath, result.join('\n'));
console.log('Patch replaced:', replaced);

// Final audit
const final = fs.readFileSync(filePath,'utf8');
const remaining = (final.match(/imagem:.*unsplash/g)||[]).length;
console.log('Unsplash remaining:', remaining);
