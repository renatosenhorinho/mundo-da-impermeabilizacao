#!/usr/bin/env node
/**
 * scripts/restore-products.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Restauração rápida a partir de backups gerados por backup-products.cjs
 *
 * Uso:
 *   node scripts/restore-products.cjs --list
 *   node scripts/restore-products.cjs --catalog 2026-05-12   (restaura products.ts)
 *   node scripts/restore-products.cjs --supabase 2026-05-12  (restaura tabela products)
 *   node scripts/restore-products.cjs --full 2026-05-12T17-30-00 (restaura tudo)
 *   node scripts/restore-products.cjs --dry-run [...]         (simula sem gravar)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');

let createClient;
try { ({ createClient } = require('@supabase/supabase-js')); } catch { /* offline */ }

// ── Args ─────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIST    = args.includes('--list');

const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT        = path.resolve(__dirname, '..');
const BACKUPS_DIR = path.join(ROOT, 'backups');
const PRODUCTS_TS = path.join(ROOT, 'src', 'data', 'products.ts');
const ENV_FILE    = path.join(ROOT, '.env');

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg, type = 'info') {
  const icons = { info: 'ℹ', ok: '✅', warn: '⚠️', error: '❌', dry: '🔵' };
  const prefix = DRY_RUN ? '[DRY-RUN] ' : '';
  console.log(`${icons[type] || 'ℹ'}  ${prefix}${msg}`);
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

function readJSON(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function findBackup(prefix, dateHint) {
  if (!fs.existsSync(BACKUPS_DIR)) {
    log('Pasta /backups/ não encontrada. Execute backup-products.cjs primeiro.', 'error');
    return null;
  }
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith(prefix) && f.includes(dateHint))
    .sort()
    .reverse(); // mais recente primeiro
  return files.length > 0 ? path.join(BACKUPS_DIR, files[0]) : null;
}

// ── List backups ──────────────────────────────────────────────────────────────
function listBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    log('Nenhum backup encontrado. Execute: node scripts/backup-products.cjs', 'warn');
    return;
  }

  const indexFile = path.join(BACKUPS_DIR, '_index.json');
  if (fs.existsSync(indexFile)) {
    const index = readJSON(indexFile);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Backups disponíveis:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    index.backups.forEach(b => {
      console.log(`  📦 ${b.file.padEnd(50)} ${b.size.padStart(8)}  ${b.created}`);
    });
    console.log(`\n  Última atualização: ${index.updatedAt}\n`);
  } else {
    const files = fs.readdirSync(BACKUPS_DIR).sort().reverse();
    console.log('\n  Arquivos em /backups/:\n');
    files.forEach(f => {
      const stat = fs.statSync(path.join(BACKUPS_DIR, f));
      console.log(`  📦 ${f.padEnd(50)} ${Math.round(stat.size / 1024)}KB`);
    });
    console.log('');
  }
}

// ── Restore catalog (products.ts) ─────────────────────────────────────────────
function restoreCatalog(dateHint) {
  const bakFile = findBackup('products-ts-', dateHint);
  if (!bakFile) {
    log(`Nenhum backup de products.ts encontrado para data: ${dateHint}`, 'error');
    return false;
  }

  log(`Restaurando: ${path.basename(bakFile)} → src/data/products.ts`);

  if (!DRY_RUN) {
    // Criar backup do arquivo atual antes de sobrescrever
    const current = fs.readFileSync(PRODUCTS_TS, 'utf8');
    const safetyBak = path.join(BACKUPS_DIR, `products-ts-pre-restore-${Date.now()}.ts.bak`);
    fs.writeFileSync(safetyBak, current, 'utf8');
    log(`Safety backup criado: ${path.basename(safetyBak)}`, 'warn');

    // Restaurar
    const content = fs.readFileSync(bakFile, 'utf8');
    fs.writeFileSync(PRODUCTS_TS, content, 'utf8');
  }

  log(`products.ts restaurado com sucesso!`, 'ok');
  return true;
}

// ── Restore Supabase ──────────────────────────────────────────────────────────
async function restoreSupabase(dateHint, supabase) {
  // Tenta full backup primeiro, depois por tabela
  const fullFile = findBackup('full-backup-', dateHint);
  const productFile = findBackup('products-', dateHint);

  if (!fullFile && !productFile) {
    log(`Nenhum backup Supabase encontrado para: ${dateHint}`, 'error');
    return false;
  }

  const sourceFile = fullFile || productFile;
  log(`Restaurando Supabase a partir de: ${path.basename(sourceFile)}`);

  const backup = readJSON(sourceFile);

  // Determinar estrutura
  let tablesData = {};
  if (backup.tables) {
    // full-backup format
    tablesData = Object.fromEntries(
      Object.entries(backup.tables).map(([k, v]) => [k, v.rows || []])
    );
  } else if (backup.rows) {
    // single-table format
    tablesData[backup.table] = backup.rows;
  }

  for (const [table, rows] of Object.entries(tablesData)) {
    if (!rows || rows.length === 0) continue;
    log(`Restaurando tabela '${table}' (${rows.length} registros)…`);

    if (!DRY_RUN) {
      // Upsert em lotes de 100
      const BATCH = 100;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
        if (error) {
          log(`Erro ao restaurar '${table}' lote ${i / BATCH + 1}: ${error.message}`, 'error');
        }
      }
    }
    log(`'${table}' restaurado (${rows.length} rows)`, 'ok');
  }
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  MDI — Restauração de Catálogo');
  if (DRY_RUN) console.log('  🔵 MODO DRY-RUN: nenhuma gravação será feita');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (LIST || args.length === 0) {
    listBackups();
    console.log('  Uso:');
    console.log('    node scripts/restore-products.cjs --catalog 2026-05-12');
    console.log('    node scripts/restore-products.cjs --supabase 2026-05-12');
    console.log('    node scripts/restore-products.cjs --full 2026-05-12T17-30-00');
    console.log('    node scripts/restore-products.cjs --dry-run --catalog 2026-05-12\n');
    return;
  }

  const catalogDate  = getArg('--catalog');
  const supabaseDate = getArg('--supabase');
  const fullDate     = getArg('--full');

  if (catalogDate || fullDate) {
    restoreCatalog(catalogDate || fullDate);
  }

  if (supabaseDate || fullDate) {
    if (!createClient) {
      log('@supabase/supabase-js não instalado — restauração Supabase ignorada', 'warn');
    } else {
      const env = loadEnv();
      const url = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const key = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

      if (!url || !key) {
        log('Credenciais Supabase não encontradas', 'error');
      } else {
        const supabase = createClient(url, key);
        await restoreSupabase(supabaseDate || fullDate, supabase);
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Restauração concluída.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(e => {
  console.error('❌ Restore falhou:', e.message);
  process.exit(1);
});
