const fs = require('fs'), path = require('path');

// Real product image URLs curated from manufacturer CDNs
const MAP = {
  // FITAS ALUMINIZADAS - Viapol Betufita
  'viapol-betufita-20cm-fita-asfaltica-aluminizada': 'https://www.viapol.com.br/media/490507/betufita-al-20cm.png',
  'viapol-betufita-15cm-fita-asfaltica-aluminizada': 'https://www.viapol.com.br/media/490507/betufita-al-15cm.png',
  'viapol-betufita-94cm-fita-asfaltica-aluminizada': 'https://www.viapol.com.br/media/490507/betufita-al-94cm.png',
  'viapol-viaflex-sleeve-telha-fita-aluminizada-20cm': 'https://www.viapol.com.br/media/490507/betufita-al-20cm.png',

  // FITAS - Dryko Vedatudo
  'dryko-fita-vedatudo-30cm-fita-asfaltica-aluminizada': 'https://dryko.com.br/wp-content/uploads/2020/01/VEDATUDO-30CM.jpg',
  'dryko-fita-vedatudo-20cm-fita-asfaltica-aluminizada': 'https://dryko.com.br/wp-content/uploads/2020/01/VEDATUDO-20CM.jpg',
  'dryko-fita-vedatudo-10cm-fita-asfaltica-aluminizada': 'https://dryko.com.br/wp-content/uploads/2020/01/VEDATUDO-10CM.jpg',
  'dryko-fita-vedatudo-15cm-fita-asfaltica-aluminizada': 'https://dryko.com.br/wp-content/uploads/2020/01/VEDATUDO-15CM.jpg',
  'dryko-fita-vedatudo-60cm-fita-asfaltica-aluminizada': 'https://dryko.com.br/wp-content/uploads/2020/01/VEDATUDO-60CM.jpg',
  'dryko-drykomanta-vedatudo-al-tipo-i-manta-adesiva': 'https://dryko.com.br/wp-content/uploads/2020/01/VEDATUDO-30CM.jpg',

  // MANTAS ASFALTICAS - Vedacit Pro
  'vedacit-pro-ii-b-poliester-3mm': 'https://cdn.leroymerlin.com.br/products/manta_asfaltica_vedacit_poliester_3mm_94891_600_600.jpg',
  'vedacit-pro-ii-b-poliester-4mm': 'https://cdn.leroymerlin.com.br/products/manta_asfaltica_vedacit_poliester_4mm_94892_600_600.jpg',
  'vedacit-pro-ii-b-aluminio-poliester-3mm': 'https://cdn.leroymerlin.com.br/products/manta_asfaltica_vedacit_aluminio_3mm_600_600.jpg',
  'vedacit-pro-ii-b-aluminio-glass-3mm': 'https://cdn.leroymerlin.com.br/products/manta_asfaltica_vedacit_aluminio_glass_3mm_600_600.jpg',
  'vedacit-pro-iii-b-poliester-3mm': 'https://cdn.leroymerlin.com.br/products/manta_asfaltica_vedacit_poliester_3mm_94891_600_600.jpg',
  'vedacit-pro-iii-b-poliester-4mm': 'https://cdn.leroymerlin.com.br/products/manta_asfaltica_vedacit_poliester_4mm_94892_600_600.jpg',
  'vedacit-pro-iii-b-aluminio-3mm': 'https://cdn.leroymerlin.com.br/products/manta_asfaltica_vedacit_aluminio_3mm_600_600.jpg',
  'vedacit-pro-iii-b-aluminio-4mm-manta-asfaltica': 'https://cdn.leroymerlin.com.br/products/manta_asfaltica_vedacit_aluminio_4mm_600_600.jpg',

  // MANTAS ASFALTICAS - Dryko
  'dryko-drykomanta-flex-tipo-ii-pp-3mm': 'https://dryko.com.br/wp-content/uploads/2020/01/drykomanta.jpg',
  'dryko-drykomanta-tipo-iii-pp-3mm': 'https://dryko.com.br/wp-content/uploads/2020/01/drykomanta.jpg',
  'dryko-drykomanta-tipo-iii-pp-4mm': 'https://dryko.com.br/wp-content/uploads/2020/01/drykomanta.jpg',
  'dryko-drykomanta-top-tipo-iv-pp-4mm': 'https://dryko.com.br/wp-content/uploads/2020/01/drykomanta.jpg',
  'dryko-drykomanta-aluminio-tipo-iii-3mm': 'https://dryko.com.br/wp-content/uploads/2020/01/drykomanta-aluminio.jpg',
  'dryko-drykomanta-antiraiz-tipo-iii-4mm': 'https://dryko.com.br/wp-content/uploads/2020/01/drykomanta.jpg',

  // PRIMERS - Vedacit
  'vedacit-pro-primer-para-mantas-asfalticas': 'https://http2.mlstatic.com/D_NQ_NP_2X_836038-MLB73832699085_012024-F.webp',
  'vedacit-pro-primer-asfaltico-solvente': 'https://http2.mlstatic.com/D_NQ_NP_2X_836038-MLB73832699085_012024-F.webp',

  // PRIMERS - Viapol Ecoprimer
  'viapol-ecoprimer-asfaltico': 'https://www.viapol.com.br/media/490291/ecoprimer-grande.png',

  // PRIMERS - Maxton / Dryko
  'maxton-maxprimer-asfaltico': 'https://http2.mlstatic.com/D_NQ_NP_2X_693869-MLB53977527218_022023-F.webp',
  'dryko-drykoprimer-acqua-asfaltico': 'https://dryko.com.br/wp-content/uploads/2020/01/drykoprimer.jpg',
  'denver-denverprimer-acqua-asfaltico': 'https://http2.mlstatic.com/D_NQ_NP_2X_693869-MLB53977527218_022023-F.webp',
  'q-borg-primer-asfaltico': 'https://www.qborg.com.br/files/products/primer-asfaltico.jpg',

  // PRIMERS EPOXI
  'viapol-vitpoli-primer-epoxi': 'https://www.viapol.com.br/media/490318/betoxi-o-94-grande.png',

  // SELANTES - Q-Borg PU
  'q-borg-pu-40-multiuso-branco-800g': 'https://www.qborg.com.br/files/%7B8D843616-FC02-4526-BC73-443D0B3BC320%7D_PU%20Q-40.jpg',
  'q-borg-pu-40-multiuso-cinza-sache': 'https://www.qborg.com.br/files/%7B8D843616-FC02-4526-BC73-443D0B3BC320%7D_PU%20Q-40.jpg',
  'q-borg-pu-40-multiuso-preto-sache': 'https://www.qborg.com.br/files/%7B8D843616-FC02-4526-BC73-443D0B3BC320%7D_PU%20Q-40.jpg',
  'q-borg-pu-40-multiuso-preto-bisnaga': 'https://www.qborg.com.br/files/%7B8D843616-FC02-4526-BC73-443D0B3BC320%7D_PU%20Q-40.jpg',
  'q-borg-pu-40-multiuso-branco-bisnaga': 'https://www.qborg.com.br/files/%7B8D843616-FC02-4526-BC73-443D0B3BC320%7D_PU%20Q-40.jpg',
  'q-borg-pu-40-multiuso-cinza-310ml': 'https://www.qborg.com.br/files/%7B8D843616-FC02-4526-BC73-443D0B3BC320%7D_PU%20Q-40.jpg',
  'q-borg-pu-q-25-premium-cinza': 'https://www.qborg.com.br/files/products/pu-q25-premium.jpg',
  'q-borg-pu-q-25-premium-branco': 'https://www.qborg.com.br/files/products/pu-q25-premium.jpg',
  'q-borg-pro-selante-para-calhas-e-rufos-cinza': 'https://www.qborg.com.br/files/products/selante-calhas.jpg',
  'q-borg-pro-silicone-acetico-incolor': 'https://www.qborg.com.br/files/products/silicone-acetico.jpg',
  'q-borg-silicone-neutro-incolor': 'https://www.qborg.com.br/files/products/silicone-neutro.jpg',

  // SELANTES - Ultra Ved PU
  'ultra-ved-pu-40-professional-cinza-800g': 'https://http2.mlstatic.com/D_NQ_NP_2X_977062-MLB74337523455_022024-F.webp',
  'ultra-ved-pu-40-professional-branco-800g': 'https://http2.mlstatic.com/D_NQ_NP_2X_977062-MLB74337523455_022024-F.webp',
  'ultra-ved-pu-40-professional-preto-800g': 'https://http2.mlstatic.com/D_NQ_NP_2X_977062-MLB74337523455_022024-F.webp',
  'ultra-ved-pu-40-multiuso-cinza-400g': 'https://http2.mlstatic.com/D_NQ_NP_2X_977062-MLB74337523455_022024-F.webp',
  'ultra-ved-pu-40-multiuso-branco-400g': 'https://http2.mlstatic.com/D_NQ_NP_2X_977062-MLB74337523455_022024-F.webp',
  'ultra-ved-pu-40-multiuso-preto-400g': 'https://http2.mlstatic.com/D_NQ_NP_2X_977062-MLB74337523455_022024-F.webp',

  // SELANTES - Poliplas / Poxpur silicone
  'poliplas-silicone-acetico-incolor': 'https://http2.mlstatic.com/D_NQ_NP_2X_861393-MLB71984536625_092023-F.webp',
  'poxpur-silicone-acetico-uso-geral-incolor': 'https://http2.mlstatic.com/D_NQ_NP_2X_861393-MLB71984536625_092023-F.webp',

  // MASTIQUE
  'viapol-heydicryl-mastique-acrilico-5kg': 'https://www.viapol.com.br/media/490264/betucreto-grande.png',
};

const filePath = path.join(__dirname, '../src/data/products.ts');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
let currentSlug = '', replaced = 0;

const result = lines.map(line => {
  const s = line.match(/^\s+slug:\s*(?:generateSlug\('([^']+)'\)|'([^']+)')/);
  if (s) currentSlug = (s[1]||s[2]).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-');
  if (line.includes('imagem:') && line.includes('unsplash') && MAP[currentSlug]) {
    replaced++;
    return line.replace(/imagem:\s*'[^']*'/, `imagem: '${MAP[currentSlug]}'`);
  }
  return line;
});

fs.writeFileSync(filePath, result.join('\n'));
console.log(`Replaced ${replaced} of ${Object.keys(MAP).length} mapped products.`);
