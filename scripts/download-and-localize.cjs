/**
 * download-and-localize.cjs
 *
 * Downloads every external product image and patches products.ts to use local paths.
 * - Preserves existing local images (never overwrites)
 * - Uses browser-like headers to bypass hotlinking restrictions (mlstatic, etc.)
 * - Retries with alternate Referer/User-Agent on first failure
 * - Logs a clear report at the end
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

// ── Config ───────────────────────────────────────────────────────────────────
const ROOT       = path.join(__dirname, '..');
const PRODUCTS   = path.join(ROOT, 'src/data/products.ts');
const IMG_ROOT   = path.join(ROOT, 'public/images/products');
const CONCURRENCY = 4;          // parallel downloads
const TIMEOUT_MS  = 20_000;

// ── Referer map per hostname ──────────────────────────────────────────────────
const REFERER_MAP = {
  'http2.mlstatic.com' : 'https://www.mercadolivre.com.br/',
  'mlstatic.com'       : 'https://www.mercadolivre.com.br/',
  'viapol.com.br'      : 'https://www.viapol.com.br/',
  'dryko.com.br'       : 'https://dryko.com.br/',
  'qborg.com.br'       : 'https://www.qborg.com.br/',
  'vedacit.com.br'     : 'https://www.vedacit.com.br/',
  'quartzolit.com.br'  : 'https://quartzolit.weber.com.br/',
};

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept'    : 'image/webp,image/apng,image/jpeg,image/*,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
  'Cache-Control'  : 'no-cache',
  'Connection'     : 'keep-alive',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function norm(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getReferer(urlStr) {
  try {
    const host = new URL(urlStr).hostname.replace(/^www\./, '');
    return REFERER_MAP[host] || 'https://www.google.com.br/';
  } catch { return 'https://www.google.com.br/'; }
}

function isExternal(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}

function isLocal(url) {
  return url && url.startsWith('/');
}

// ── Parse products.ts ─────────────────────────────────────────────────────────
function parseProducts(content) {
  const lines = content.split('\n');
  const products = [];
  let cur = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const nome = line.match(/^\s+nome:\s*'([^']+)'/);
    if (nome) cur.nome = nome[1];

    const cat = line.match(/^\s+categoria:\s*'([^']+)'/);
    if (cat) cur.categoria = cat[1];

    // slug can be generateSlug('...') or a plain string
    const slugFn = line.match(/^\s+slug:\s*generateSlug\('([^']+)'\)/);
    const slugStr = line.match(/^\s+slug:\s*'([^']+)'/);
    if (slugFn) cur.slug = slugFn[1];
    else if (slugStr) cur.slug = slugStr[1];

    const img = line.match(/^\s+imagem:\s*'([^']+)'/);
    if (img) {
      cur.imagem    = img[1];
      cur.lineIndex = i;
      if (cur.nome) products.push({ ...cur });
    }
  }
  return products;
}

// ── Download ──────────────────────────────────────────────────────────────────
function downloadFile(url, dest, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...DEFAULT_HEADERS, Referer: getReferer(url), ...extraHeaders };
    const proto   = url.startsWith('https') ? https : http;

    const req = proto.get(url, { headers, timeout: TIMEOUT_MS }, (res) => {
      // Follow redirects (up to 5)
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location;
        if (!loc) return reject(new Error(`Redirect without Location from ${url}`));
        res.resume();
        return downloadFile(loc, dest, extraHeaders).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const contentType = res.headers['content-type'] || '';
      if (!contentType.includes('image') && !contentType.includes('octet-stream')) {
        res.resume();
        return reject(new Error(`Not an image (${contentType})`));
      }

      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const tmpDest = dest + '.tmp';
      const out = fs.createWriteStream(tmpDest);

      res.pipe(out);
      out.on('finish', () => {
        out.close(() => {
          const stat = fs.statSync(tmpDest);
          if (stat.size < 500) {
            fs.unlinkSync(tmpDest);
            return reject(new Error('Downloaded file too small (likely error page)'));
          }
          fs.renameSync(tmpDest, dest);
          resolve(dest);
        });
      });
      out.on('error', (e) => {
        fs.existsSync(tmpDest) && fs.unlinkSync(tmpDest);
        reject(e);
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ── Determine local dest path ────────────────────────────────────────────────
function localDestFor(product) {
  const cat   = norm(product.categoria || 'outros');
  const nome  = norm(product.nome || product.slug || 'produto');
  // Try to keep extension from original URL
  let ext = '.webp';
  try {
    const u = new URL(product.imagem);
    const p = u.pathname;
    const m = p.match(/\.(webp|jpg|jpeg|png)$/i);
    if (m) ext = m[0].toLowerCase();
  } catch {}

  const filename = nome.substring(0, 80) + ext;
  return {
    rel  : `/images/products/${cat}/${filename}`,
    full : path.join(IMG_ROOT, cat, filename),
  };
}

// ── Pool runner ───────────────────────────────────────────────────────────────
async function pool(tasks, limit) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: limit }, worker);
  await Promise.all(workers);
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const content  = fs.readFileSync(PRODUCTS, 'utf8');
  const products = parseProducts(content);

  // Only products with external images
  const toDownload = products.filter(p => isExternal(p.imagem));
  const alreadyLocal = products.filter(p => isLocal(p.imagem)).length;

  console.log(`\n📦 Total products      : ${products.length}`);
  console.log(`✅ Already local        : ${alreadyLocal}`);
  console.log(`🌐 External (to fix)    : ${toDownload.length}\n`);

  if (toDownload.length === 0) {
    console.log('Nothing to do!');
    return;
  }

  const successes = [];
  const failures  = [];

  // Build download tasks
  const tasks = toDownload.map((p) => async () => {
    const { rel, full } = localDestFor(p);

    // Skip if file already exists
    if (fs.existsSync(full)) {
      process.stdout.write(`⏭  [skip] ${p.nome}\n`);
      return { product: p, localPath: rel, skipped: true };
    }

    // Try primary download
    try {
      await downloadFile(p.imagem, full);
      process.stdout.write(`✅ ${p.nome}\n`);
      return { product: p, localPath: rel, ok: true };
    } catch (err1) {
      // Retry with mercadolivre referer (for any host, not just mlstatic)
      try {
        await downloadFile(p.imagem, full, { Referer: 'https://www.mercadolivre.com.br/' });
        process.stdout.write(`✅ [retry] ${p.nome}\n`);
        return { product: p, localPath: rel, ok: true };
      } catch (err2) {
        process.stdout.write(`❌ ${p.nome}: ${err2.message}\n`);
        return { product: p, localPath: rel, ok: false, error: err2.message };
      }
    }
  });

  const results = await pool(tasks, CONCURRENCY);

  // Categorize results
  for (const r of results) {
    if (!r) continue;
    if (r.ok || r.skipped) successes.push(r);
    else failures.push(r);
  }

  // Patch products.ts – replace external URLs with local paths for successes
  if (successes.filter(r => r.ok).length > 0) {
    let updated = content;
    for (const r of successes) {
      if (!r.ok) continue; // don't patch skips (they may already be patched from a prior run)
      // Escape for regex
      const escapedUrl = r.product.imagem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      updated = updated.replace(
        new RegExp(`imagem:\\s*'${escapedUrl}'`, 'g'),
        `imagem: '${r.localPath}'`
      );
    }
    // Also patch skipped ones if their local path is different from current imagem
    for (const r of successes) {
      if (!r.skipped) continue;
      const escapedUrl = r.product.imagem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      updated = updated.replace(
        new RegExp(`imagem:\\s*'${escapedUrl}'`, 'g'),
        `imagem: '${r.localPath}'`
      );
    }
    fs.writeFileSync(PRODUCTS, updated, 'utf8');
    console.log(`\n✅ products.ts patched with ${successes.filter(r=>r.ok).length} new local paths`);
  }

  // Final report
  console.log('\n══════════════════════════════════');
  console.log(`✅ Success / Skipped : ${successes.length}`);
  console.log(`❌ Failed            : ${failures.length}`);

  if (failures.length > 0) {
    console.log('\n── Failed products (need manual fix or fallback) ──');
    failures.forEach(r => {
      console.log(`  • ${r.product.nome}`);
      console.log(`    URL: ${r.product.imagem}`);
      console.log(`    Err: ${r.error}`);
    });

    // Write failures to a JSON for follow-up
    const failurePath = path.join(__dirname, 'download-failures.json');
    fs.writeFileSync(failurePath, JSON.stringify(failures.map(r => ({
      nome     : r.product.nome,
      categoria: r.product.categoria,
      slug     : r.product.slug,
      url      : r.product.imagem,
      error    : r.error,
    })), null, 2), 'utf8');
    console.log(`\n📄 Failures saved to scripts/download-failures.json`);
  }

  // Verify remaining externals
  const finalContent = fs.readFileSync(PRODUCTS, 'utf8');
  const remaining = (finalContent.match(/imagem:\s*'https?:\/\//g) || []).length;
  console.log(`\n🔍 External URLs remaining in products.ts: ${remaining}`);
}

main().catch(console.error);
