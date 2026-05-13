#!/usr/bin/env node
/**
 * scripts/backup-products.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Backup automático do catálogo MDI.
 * Exporta: products.ts + Supabase (products, analytics_events, leads)
 * Salva JSONs timestampados em /backups/
 *
 * Uso:
 *   node scripts/backup-products.cjs          → backup completo
 *   node scripts/backup-products.cjs --local  → só products.ts (sem Supabase)
 *   node scripts/backup-products.cjs --keep 7 → mantém N backups (padrão: 30)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Deps opcionais ────────────────────────────────────────────────────────────
let createClient;
try { ({ createClient } = require('@supabase/supabase-js')); } catch { /* offline */ }

// ── Args ─────────────────────────────────────────────────────────────────────
const args       = process.argv.slice(2);
const LOCAL_ONLY = args.includes('--local');
const KEEP_IDX   = args.indexOf('--keep');
const KEEP_COUNT = KEEP_IDX !== -1 ? parseInt(args[KEEP_IDX + 1], 10) || 30 : 30;

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT        = path.resolve(__dirname, '..');
const BACKUPS_DIR = path.join(ROOT, 'backups');
const PRODUCTS_TS = path.join(ROOT, 'src', 'data', 'products.ts');
const ENV_FILE    = path.join(ROOT, '.env');

// ── Helpers ───────────────────────────────────────────────────────────────────
const now = new Date();
const TIMESTAMP = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // 2026-05-12T17-30-00
const DATE_LABEL = now.toISOString().slice(0, 10);                      // 2026-05-12

function log(msg, type = 'info') {
  const icons = { info: 'ℹ', ok: '✅', warn: '⚠️', error: '❌' };
  console.log(`${icons[type] || 'ℹ'}  ${msg}`);
}

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const env = {};
  fs.readFileSync(ENV_FILE, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.trim().split('=');
    if (k && !k.startsWith('#')) env[k.trim()] = v.join('=').trim();
  });
  return env;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function saveJSON(filename, data) {
  const filepath = path.join(BACKUPS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  const kb = Math.round(fs.statSync(filepath).size / 1024);
  log(`Salvo: ${filename} (${kb}KB)`, 'ok');
  return filepath;
}

function pruneOldBackups() {
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  // Agrupa por prefixo (products, analytics, leads, full)
  const groups = {};
  files.forEach(f => {
    const prefix = f.name.split('-2')[0]; // tudo antes da data
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(f);
  });

  let pruned = 0;
  Object.values(groups).forEach(group => {
    if (group.length > KEEP_COUNT) {
      group.slice(KEEP_COUNT).forEach(f => {
        fs.unlinkSync(path.join(BACKUPS_DIR, f.name));
        pruned++;
      });
    }
  });
  if (pruned > 0) log(`Poda: ${pruned} backup(s) antigo(s) removido(s)`, 'warn');
}

// ── Backup local: products.ts ────────────────────────────────────────────────
function backupProductsTs() {
  if (!fs.existsSync(PRODUCTS_TS)) {
    log('products.ts não encontrado!', 'error');
    return;
  }
  const content = fs.readFileSync(PRODUCTS_TS, 'utf8');
  const filename = `products-ts-${DATE_LABEL}.ts.bak`;
  const filepath = path.join(BACKUPS_DIR, filename);
  fs.writeFileSync(filepath, content, 'utf8');
  const kb = Math.round(content.length / 1024);
  log(`Salvo: ${filename} (${kb}KB) — source TypeScript`, 'ok');

  // Também exportar como JSON parseando os slugs
  const slugMatches = [...content.matchAll(/slug:\s*'([^']+)'/g)].map(m => m[1]);
  const nameMatches = [...content.matchAll(/nome:\s*'([^']+)'/g)].map(m => m[1]);
  const summary = {
    exportedAt: now.toISOString(),
    totalProducts: slugMatches.length,
    slugs: slugMatches,
    names: nameMatches,
    sourceFile: 'src/data/products.ts',
  };
  saveJSON(`products-catalog-${DATE_LABEL}.json`, summary);
}

// ── Backup Supabase ───────────────────────────────────────────────────────────
async function backupSupabase(supabase) {
  const tables = ['products', 'analytics_events', 'leads', 'categories'];
  const results = {};
  let total = 0;

  for (const table of tables) {
    try {
      // Supabase free tier: max 1000 rows por query, paginar se necessário
      let allRows = [];
      let from = 0;
      const PAGE_SIZE = 1000;

      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .range(from, from + PAGE_SIZE - 1)
          .order('id', { ascending: true });

        if (error) {
          if (error.code === '42P01') {
            log(`Tabela '${table}' não existe no Supabase — pulando`, 'warn');
          } else {
            log(`Erro ao exportar '${table}': ${error.message}`, 'warn');
          }
          break;
        }

        if (!data || data.length === 0) break;
        allRows = allRows.concat(data);
        total += data.length;
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (allRows.length > 0) {
        results[table] = allRows;
        saveJSON(`${table}-${DATE_LABEL}.json`, {
          exportedAt: now.toISOString(),
          table,
          rowCount: allRows.length,
          rows: allRows,
        });
      }
    } catch (e) {
      log(`Falha em '${table}': ${e.message}`, 'error');
    }
  }

  // Full backup consolidado
  if (Object.keys(results).length > 0) {
    saveJSON(`full-backup-${TIMESTAMP}.json`, {
      exportedAt: now.toISOString(),
      tables: Object.fromEntries(
        Object.entries(results).map(([k, v]) => [k, { rowCount: v.length, rows: v }])
      ),
    });
  }

  log(`Total de registros Supabase exportados: ${total}`, 'ok');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  MDI — Backup Automático do Catálogo');
  console.log(`  ${now.toLocaleString('pt-BR')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  ensureDir(BACKUPS_DIR);

  // 1. Backup local (products.ts)
  log('Exportando catálogo local (products.ts)…');
  backupProductsTs();

  // 2. Backup Supabase
  if (!LOCAL_ONLY && createClient) {
    const env = loadEnv();
    const url = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (url && key) {
      log('Conectando ao Supabase…');
      const supabase = createClient(url, key);
      await backupSupabase(supabase);
    } else {
      log('Credenciais Supabase não encontradas — apenas backup local', 'warn');
    }
  } else if (LOCAL_ONLY) {
    log('Modo --local: Supabase ignorado', 'warn');
  }

  // 3. Poda de backups antigos
  pruneOldBackups();

  // 4. Índice dos backups
  const allBackups = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.endsWith('.json') || f.endsWith('.bak'))
    .map(f => {
      const stat = fs.statSync(path.join(BACKUPS_DIR, f));
      return { file: f, size: `${Math.round(stat.size / 1024)}KB`, created: stat.birthtime.toISOString().slice(0, 10) };
    })
    .sort((a, b) => b.created.localeCompare(a.created));

  saveJSON('_index.json', { updatedAt: now.toISOString(), backups: allBackups });

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ✅ Backup concluído → /backups/`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

main().catch(e => {
  console.error('❌ Backup falhou:', e.message);
  process.exit(1);
});
