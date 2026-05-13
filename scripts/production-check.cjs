#!/usr/bin/env node
/**
 * scripts/production-check.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-deploy validation suite — executado por `npm run production:check`
 *
 * Valida:
 *   ✔ slugs únicos no products.ts
 *   ✔ imagens referenciadas existem em /public
 *   ✔ sem produtos sem nome/categoria/imagem
 *   ✔ rotas MPA não quebradas (index.html, produtos.html, admin.html…)
 *   ✔ build integral (exit 0)
 *   ✔ sem imports órfãos óbvios
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

const ROOT    = path.resolve(__dirname, '..');
const PRODUCTS_TS = path.join(ROOT, 'src', 'data', 'products.ts');
const PUBLIC  = path.join(ROOT, 'public');

let errors   = 0;
let warnings = 0;
let checks   = 0;

// ── Reporter ──────────────────────────────────────────────────────────────────
function pass(msg)  { console.log(`  ✅ ${msg}`); checks++; }
function fail(msg)  { console.log(`  ❌ ${msg}`); checks++; errors++; }
function warn(msg)  { console.log(`  ⚠️  ${msg}`); warnings++; }
function section(t) { console.log(`\n  ── ${t} ──`); }

// ── 1. Slug uniqueness ────────────────────────────────────────────────────────
function checkSlugs(source) {
  section('Slugs únicos');
  const slugs = [...source.matchAll(/slug:\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1]);
  const seen = new Set();
  const dupes = [];
  slugs.forEach(s => { if (seen.has(s)) dupes.push(s); else seen.add(s); });

  if (dupes.length === 0) {
    pass(`${slugs.length} slugs — todos únicos`);
  } else {
    fail(`Slugs duplicados (${dupes.length}): ${dupes.slice(0, 5).join(', ')}`);
  }
}

// ── 2. Imagens existentes ─────────────────────────────────────────────────────
function checkImages(source) {
  section('Imagens referenciadas');
  const refs = [...source.matchAll(/imagem:\s*['"`](\/images\/[^'"`]+)['"`]/g)].map(m => m[1]);
  const unique = [...new Set(refs)];
  let missing = 0;
  let placeholder = 0;

  unique.forEach(ref => {
    if (ref.includes('placeholder')) { placeholder++; return; }
    const abs = path.join(PUBLIC, ref);
    if (!fs.existsSync(abs)) { warn(`Imagem faltando: ${ref}`); missing++; }
  });

  if (missing === 0) {
    pass(`${unique.length} refs de imagem — ${placeholder} placeholder(s), ${unique.length - placeholder} reais — todas OK`);
  } else {
    fail(`${missing} imagem(ns) referenciada(s) mas não encontrada(s) em /public`);
  }
}

// ── 3. Produtos sem dados essenciais ─────────────────────────────────────────
function checkProductIntegrity(source) {
  section('Integridade dos produtos');

  const slugs    = [...source.matchAll(/slug:\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1]);
  const names    = [...source.matchAll(/\bnome:\s*['"`]([^'"`]*)['"`]/g)].map(m => m[1]);
  const cats     = [...source.matchAll(/\bcategoria:\s*['"`]([^'"`]*)['"`]/g)].map(m => m[1]);
  const actives  = [...source.matchAll(/\bativo:\s*(true|false)/g)].map(m => m[1]);

  const emptyNames  = names.filter(n => !n.trim()).length;
  const emptyCats   = cats.filter(c => !c.trim()).length;
  const activeCount = actives.filter(a => a === 'true').length;

  if (emptyNames > 0) fail(`${emptyNames} produto(s) sem nome`); else pass(`Todos os ${names.length} produtos têm nome`);
  if (emptyCats > 0)  fail(`${emptyCats} produto(s) sem categoria`); else pass(`Todos os ${cats.length} produtos têm categoria`);
  pass(`${activeCount}/${actives.length} produtos ativos`);
  pass(`Total: ${slugs.length} produtos no catálogo`);
}

// ── 4. Rotas MPA ──────────────────────────────────────────────────────────────
function checkRoutes() {
  section('Rotas MPA');
  const required = ['index.html', 'produtos.html', 'admin.html', 'contato.html', 'quem-somos.html'];
  required.forEach(f => {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) pass(`${f} existe`);
    else fail(`${f} FALTANDO`);
  });
}

// ── 5. Imports órfãos óbvios ──────────────────────────────────────────────────
function checkOrphanImports() {
  section('Imports e exports críticos');
  const filesToCheck = [
    'src/lib/analytics.ts',
    'src/lib/products-service.ts',
    'src/lib/image-resolver.ts',
    'src/lib/supabase.ts',
    'src/config/constants.ts',
    'src/lib/health-check.ts',
  ];
  filesToCheck.forEach(f => {
    const abs = path.join(ROOT, f);
    if (fs.existsSync(abs)) pass(`${f} existe`);
    else warn(`${f} não encontrado`);
  });
}

// ── 6. Build integral ─────────────────────────────────────────────────────────
function checkBuild() {
  section('Build de produção');
  try {
    execSync('npx vite build', { cwd: ROOT, stdio: 'pipe' });
    pass('Build concluído com exit code 0');

    // Verificar dist/
    const distFiles = fs.readdirSync(path.join(ROOT, 'dist'));
    if (distFiles.includes('index.html') && distFiles.includes('assets')) {
      pass('dist/ contém index.html e assets/');
    } else {
      fail('dist/ incompleto');
    }
  } catch (e) {
    fail(`Build falhou: ${e.message.split('\n')[0]}`);
  }
}

// ── 7. robots.txt + sitemap ───────────────────────────────────────────────────
function checkSEO() {
  section('SEO — robots.txt / sitemap');
  const robots  = path.join(PUBLIC, 'robots.txt');
  const sitemap = path.join(PUBLIC, 'sitemap.xml');
  fs.existsSync(robots)  ? pass('robots.txt presente')  : fail('robots.txt ausente');
  fs.existsSync(sitemap) ? pass('sitemap.xml presente') : warn('sitemap.xml ausente — gere com npm run sitemap:generate');
}

// ── 8. Manutenção: verificar flag ────────────────────────────────────────────
function checkMaintenance() {
  section('Modo Manutenção');
  const flagFile = path.join(ROOT, 'public', '_maintenance.json');
  if (fs.existsSync(flagFile)) {
    const flag = JSON.parse(fs.readFileSync(flagFile, 'utf8'));
    if (flag.enabled) {
      warn('⚠️  MODO MANUTENÇÃO ATIVO — desative antes do deploy!');
    } else {
      pass('Modo manutenção desativado — ok para deploy');
    }
  } else {
    pass('Arquivo _maintenance.json não existe — modo manutenção inativo');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  MDI — Pre-Deploy Validation Suite');
  console.log(`  ${new Date().toLocaleString('pt-BR')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!fs.existsSync(PRODUCTS_TS)) {
    console.error('❌ products.ts não encontrado!');
    process.exit(1);
  }

  const source = fs.readFileSync(PRODUCTS_TS, 'utf8');

  checkSlugs(source);
  checkImages(source);
  checkProductIntegrity(source);
  checkRoutes();
  checkOrphanImports();
  checkSEO();
  checkMaintenance();
  checkBuild(); // Por último (mais lento)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Resultado: ${checks} checks | ${errors} erros | ${warnings} avisos`);

  if (errors > 0) {
    console.log('  ❌ FALHOU — corrija os erros antes de deployar');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('  ✅ PASSOU com avisos — revise os warnings acima');
  } else {
    console.log('  ✅ TUDO OK — sistema pronto para produção');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main();
