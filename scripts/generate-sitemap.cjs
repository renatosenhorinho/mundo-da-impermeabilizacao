#!/usr/bin/env node
/**
 * scripts/generate-sitemap.cjs
 * Gera /public/sitemap.xml automaticamente a partir dos slugs do catálogo.
 * Uso: node scripts/generate-sitemap.cjs
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '..');
const PRODUCTS_TS = path.join(ROOT, 'src', 'data', 'products.ts');
const OUTPUT      = path.join(ROOT, 'public', 'sitemap.xml');
const BASE_URL    = 'https://mundodaimpermeabilizacao.com.br';
const TODAY       = new Date().toISOString().slice(0, 10);

const source = fs.readFileSync(PRODUCTS_TS, 'utf8');

// Extrair todos os slugs do catálogo (produtos ativos e inativos vão pro sitemap — filtramos deleted_at)
const slugs = [...source.matchAll(/\bslug:\s*['"`]([^'"`]+)['"`]/g)]
  .map(m => m[1])
  .filter(s => s && !s.includes('placeholder') && s.length > 2);


// Páginas estáticas
const staticPages = [
  { url: '/', priority: '1.0', changefreq: 'weekly' },
  { url: '/produtos.html', priority: '0.9', changefreq: 'daily' },
  { url: '/quem-somos.html', priority: '0.7', changefreq: 'monthly' },
  { url: '/contato.html', priority: '0.7', changefreq: 'monthly' },
];

// Gerar XML
const urls = [
  ...staticPages.map(p => `
  <url>
    <loc>${BASE_URL}${p.url}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`),
  ...slugs.map(slug => `
  <url>
    <loc>${BASE_URL}/produtos/${slug}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`),
].join('');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`.trim();

fs.writeFileSync(OUTPUT, xml, 'utf8');
console.log(`✅ sitemap.xml gerado: ${staticPages.length} páginas + ${slugs.length} produtos = ${staticPages.length + slugs.length} URLs`);
