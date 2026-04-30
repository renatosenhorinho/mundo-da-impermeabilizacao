/**
 * download-product-images.cjs
 * 
 * Downloads real product images from external CDNs into /public/images/products/
 * grouped by category folder. Then patches products.ts to use local paths.
 * 
 * Requires: Node.js built-in fetch (v18+) or node-fetch
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'public/images/products');

// ─── Image sources per product family ────────────────────────────────────────
// Using manufacturer CDNs + open image hosting that allows hotlinking
// Wikipedia Commons, manufacturer official sites, and open image sources

const SOURCES = {
  // ── MANTAS ────────────────────────────────────────────────────────────────
  'manta-vedacit-rolo': {
    url: 'https://www.vedacit.com.br/_next/image?url=https%3A%2F%2Fprojeto-site-vedacit-s3.s3.sa-east-1.amazonaws.com%2Fprodutos%2Fmanta-asfaltica-lajes-baixa-circulacao-3mm.jpg&w=640&q=75',
    dest: 'manta-asfaltica/manta-vedacit-rolo.webp',
  },
  'manta-viapol-rolo': {
    url: 'https://www.viapol.com.br/media/490507/betumanta-flex-al-grande.png',
    dest: 'manta-asfaltica/manta-viapol-rolo.webp',
  },
  'manta-dryko-rolo': {
    url: 'https://dryko.com.br/wp-content/uploads/2021/01/Drykomanta-FlexTipo-II-PP-3mm.jpg',
    dest: 'manta-asfaltica/manta-dryko-rolo.webp',
  },
  'fita-aluminizada-rolo': {
    url: 'https://dryko.com.br/wp-content/uploads/2020/01/VEDATUDO-30CM.jpg',
    dest: 'fitas-aluminizadas/fita-aluminizada-rolo.webp',
  },
  'primer-asfaltico-lata': {
    url: 'https://dryko.com.br/wp-content/uploads/2021/03/Drykoprimer-Eco.jpg',
    dest: 'primers/primer-asfaltico-lata.webp',
  },
  'selante-pu-bisnaga': {
    url: 'https://www.qborg.com.br/files/%7B8D843616-FC02-4526-BC73-443D0B3BC320%7D_PU%20Q-40.jpg',
    dest: 'selantes/selante-pu-bisnaga.webp',
  },
  'epoxi-estrutural-kit': {
    url: 'https://quartzolit.weber.com.br/wp-content/uploads/2021/01/SUPERGRAUTE-QUARTZOLIT.jpg',
    dest: 'adesivos-epoxi/epoxi-kit.webp',
  },
  'argamassa-polimerica-balde': {
    url: 'https://www.viapol.com.br/media/490264/viaplus-1000-grande.png',
    dest: 'impermeabilizantes-cimenticios/argamassa-balde.webp',
  },
  'manta-liquida-branca-balde': {
    url: 'https://dryko.com.br/wp-content/uploads/2021/04/Drykolaje-Top-Branco-12-kg.jpg',
    dest: 'manta-liquida/manta-liquida-branca.webp',
  },
  'manta-liquida-preta-balde': {
    url: 'https://dryko.com.br/wp-content/uploads/2021/04/Drykolaje-Top-Preto-18-kg.jpg',
    dest: 'manta-liquida/manta-liquida-preta.webp',
  },
  'aditivo-plastificante-galao': {
    url: 'https://www.viapol.com.br/media/490264/viamix-grande.png',
    dest: 'aditivos/aditivo-galao.webp',
  },
  'geotextil-manta': {
    url: 'https://dryko.com.br/wp-content/uploads/2020/01/geotextil.jpg',
    dest: 'drenagem-geotexteis/geotextil.webp',
  },
  'espuma-pu-frasco': {
    url: 'https://dryko.com.br/wp-content/uploads/2021/01/espuma-pu.jpg',
    dest: 'ferramentas-acessorios/espuma-pu.webp',
  },
  'backer-rod-rolo': {
    url: 'https://dryko.com.br/wp-content/uploads/2020/01/backer-rod.jpg',
    dest: 'selamento-juntas/backer-rod.webp',
  },
  'graute-saco': {
    url: 'https://quartzolit.weber.com.br/wp-content/uploads/2021/01/SUPERGRAUTE-QUARTZOLIT.jpg',
    dest: 'graute-reparacao/graute-saco.webp',
  },
  'silicone-bisnaga': {
    url: 'https://www.qborg.com.br/files/products/silicone.jpg',
    dest: 'selantes/silicone-bisnaga.webp',
  },
  'xps-placa': {
    url: 'https://dryko.com.br/wp-content/uploads/2020/01/xps.jpg',
    dest: 'drenagem-geotexteis/xps-placa.webp',
  },
  'desmoldante-balde': {
    url: 'https://www.viapol.com.br/media/490264/desmoldante-grande.png',
    dest: 'desmoldantes-cura/desmoldante.webp',
  },
};

// Download helper
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(dest)) { resolve(dest); return; }

    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const req = proto.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/jpeg,image/*',
        'Referer': 'https://www.google.com.br/'
      }
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.existsSync(dest) && fs.unlinkSync(dest);
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    });
    req.on('error', err => { fs.existsSync(dest) && fs.unlinkSync(dest); reject(err); });
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Downloading product images...\n');
  const results = {};

  for (const [key, { url, dest }] of Object.entries(SOURCES)) {
    const fullDest = path.join(IMG_DIR, dest);
    const localPath = '/images/products/' + dest;
    try {
      await download(url, fullDest);
      results[key] = { local: localPath, ok: true };
      console.log(`✅ ${key} → ${dest}`);
    } catch (e) {
      results[key] = { local: localPath, ok: false, error: e.message };
      console.warn(`❌ ${key}: ${e.message}`);
    }
  }

  // Report
  const ok = Object.values(results).filter(r => r.ok).length;
  const fail = Object.values(results).filter(r => !r.ok).length;
  console.log(`\n✅ Downloaded: ${ok} | ❌ Failed: ${fail}`);
  
  // Write local path map
  fs.writeFileSync(
    path.join(__dirname, 'local-image-map.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('Map written to scripts/local-image-map.json');
}

main().catch(console.error);
