/**
 * ============================================================
 * MDI — Analytics Events Migration Script
 * ============================================================
 * OBJETIVO: Enriquecer eventos antigos do Supabase que possuem
 *   apenas: event_data.product = "slug-do-produto"
 * com os metadados completos:
 *   product_slug, product_name, category, brand, source_page
 *
 * CARACTERÍSTICAS:
 *   ✅ Idempotente — ignora eventos já migrados
 *   ✅ Não apaga eventos
 *   ✅ Não altera created_at
 *   ✅ Não duplica dados
 *   ✅ Logs detalhados de sucesso/falha/skip
 *
 * USO:
 *   node scripts/migrate-analytics-events.mjs
 *
 * REQUISITOS:
 *   Node >= 18 (fetch nativo)
 *   .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
 * ============================================================
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Ler .env manualmente (sem depender de dotenv) ────────────────────────────
function loadEnv() {
  try {
    const envPath = resolve(ROOT, '.env');
    const raw = readFileSync(envPath, 'utf-8');
    const env = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
    return env;
  } catch (e) {
    console.error('❌ Não foi possível ler o .env:', e.message);
    process.exit(1);
  }
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontrados no .env');
  process.exit(1);
}

// ── Catálogo de produtos (inline — extraído de src/data/products.ts) ─────────
// Em vez de importar o TS diretamente, criamos um mapa slug → metadados
// usando os dados reais do arquivo de produtos.
// O script lê o arquivo TS e extrai as entradas via regex de slug/nome/categoria/marca.

function buildProductCatalog() {
  const catalog = new Map(); // slug → { product_name, category, brand }

  try {
    const productsPath = resolve(ROOT, 'src', 'data', 'products.ts');
    const content = readFileSync(productsPath, 'utf-8');

    // Extrai o bloco rawProducts (pode ser muito grande)
    const rawProductsMatch = content.match(/const rawProducts[^=]*=\s*\[([\s\S]*?)\];\s*\n/);
    if (!rawProductsMatch) {
      console.warn('⚠️  Não foi possível encontrar rawProducts no products.ts — usando catálogo vazio');
      return catalog;
    }

    const rawBlock = rawProductsMatch[1];

    // Estratégia: extração por linha com estado
    // Varre cada produto e coleta: nome, slug (arg do generateSlug), categoria, categoriaLabel, marca
    const lines = rawBlock.split('\n');

    let currentNome = null;
    let currentSlugArg = null;
    let currentCategoria = null;
    let currentCategoriaLabel = null;
    let currentMarca = null;
    let depth = 0;
    let inProduct = false;
    let count = 0;

    const flush = () => {
      if (currentSlugArg && currentNome && currentCategoria && currentMarca) {
        const slug = generateSlug(currentSlugArg);
        catalog.set(slug, {
          product_name: currentNome,
          category: currentCategoriaLabel || currentCategoria,
          brand: currentMarca,
        });
        count++;
      }
      currentNome = null;
      currentSlugArg = null;
      currentCategoria = null;
      currentCategoriaLabel = null;
      currentMarca = null;
      inProduct = false;
    };

    for (const line of lines) {
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      const prevDepth = depth;
      depth += opens - closes;

      // Novo produto começa quando depth vai de 0 → 1
      if (prevDepth === 0 && depth === 1) {
        inProduct = true;
      }
      // Produto termina quando depth volta a 0
      if (prevDepth === 1 && depth === 0 && inProduct) {
        flush();
      }

      if (!inProduct) continue;

      // Extrai nome: nome: 'Xxx' ou nome: "Xxx"
      const nomeM = line.match(/\bnome:\s*['"`]([^'"`]+)['"`]/);
      if (nomeM) currentNome = nomeM[1].trim();

      // Extrai slug: generateSlug('Xxx') ou generateSlug("Xxx") ou slug: 'xxx'
      const slugGenM = line.match(/\bslug:\s*generateSlug\(['"`]([^'"`]+)['"`]\)/);
      if (slugGenM) {
        currentSlugArg = slugGenM[1].trim();
      } else {
        const slugLitM = line.match(/\bslug:\s*['"`]([^'"`]+)['"`]/);
        if (slugLitM) currentSlugArg = slugLitM[1].trim();
      }

      // Extrai categoria
      const catM = line.match(/\bcategoria:\s*['"`]([^'"`]+)['"`]/);
      if (catM && !line.includes('categoriaLabel')) currentCategoria = catM[1].trim();

      // Extrai categoriaLabel
      const catLabelM = line.match(/\bcategoriaLabel:\s*['"`]([^'"`]+)['"`]/);
      if (catLabelM) currentCategoriaLabel = catLabelM[1].trim();

      // Extrai marca
      const marcaM = line.match(/\bmarca:\s*['"`]([^'"`]+)['"`]/);
      if (marcaM) currentMarca = marcaM[1].trim();
    }
    // Flush do último produto caso não haja linha fechando
    flush();

    console.log(`📦 Catálogo carregado: ${count} produtos indexados.`);
  } catch (e) {
    console.warn('⚠️  Erro ao ler products.ts:', e.message);
  }

  return catalog;
}

/** Replica a função generateSlug do TS (deve ser idêntica) */
function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .replace(/[^a-z0-9\s-]/g, ' ')   // caracteres especiais → espaço
    .trim()
    .replace(/\s+/g, '-')            // espaços → hífens
    .replace(/-+/g, '-')             // hífens duplos → simples
    .replace(/(^-|-$)/g, '');        // remove hífens nas pontas
}

// ── Supabase REST helpers ─────────────────────────────────────────────────────

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer': 'return=minimal',
};

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'GET',
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function supabasePatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} → ${res.status}: ${text}`);
  }
  return true;
}

// ── Migração principal ────────────────────────────────────────────────────────

async function migrate() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  MDI — Migração de Analytics Events');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Carregar catálogo local
  const catalog = buildProductCatalog();

  // 2. Buscar todos os eventos de produto do Supabase
  console.log('🔍 Buscando eventos product_click e whatsapp_click no Supabase...');

  let allEvents = [];
  try {
    // Supabase limita por padrão a 1000 linhas. Paginamos.
    let offset = 0;
    const PAGE = 1000;

    while (true) {
      const page = await supabaseGet(
        `/analytics_events?event_type=in.(product_click,whatsapp_click)&select=id,event_type,event_data,page_url&limit=${PAGE}&offset=${offset}&order=id.asc`
      );
      if (!Array.isArray(page) || page.length === 0) break;
      allEvents = allEvents.concat(page);
      if (page.length < PAGE) break;
      offset += PAGE;
    }
  } catch (e) {
    console.error('❌ Falha ao buscar eventos do Supabase:', e.message);
    console.error('   Verifique se a tabela analytics_events existe e as permissões RLS.');
    process.exit(1);
  }

  console.log(`📊 Total de eventos encontrados: ${allEvents.length}\n`);

  if (allEvents.length === 0) {
    console.log('ℹ️  Nenhum evento product_click ou whatsapp_click encontrado. Nada a migrar.\n');
    return;
  }

  // 3. Filtrar eventos que precisam de migração
  //    Critério: event_data NÃO possui product_slug (ainda não migrado)
  const toMigrate = allEvents.filter(e => {
    const ed = e.event_data;
    if (!ed || typeof ed !== 'object') return false; // sem event_data
    if (ed.product_slug) return false;                 // já migrado ✅
    // Tem legacy: event_data.product (slug antigo)
    return Boolean(ed.product);
  });

  const alreadyMigrated = allEvents.length - toMigrate.length;

  console.log(`✅ Já migrados (ignorados):    ${alreadyMigrated}`);
  console.log(`🔄 A migrar agora:             ${toMigrate.length}\n`);

  if (toMigrate.length === 0) {
    console.log('🎉 Todos os eventos já estão no novo formato! Nada a fazer.\n');
    return;
  }

  // 4. Enriquecer e atualizar
  let successCount = 0;
  let failCount = 0;
  let noMatchCount = 0;
  const failedIds = [];
  const noMatchSlugs = new Set();

  for (const event of toMigrate) {
    const legacySlug = event.event_data?.product;
    if (!legacySlug) { failCount++; continue; }

    const productMeta = catalog.get(legacySlug);

    if (!productMeta) {
      // Tentar com o slug gerado a partir do valor legado (por se for um nome, não um slug)
      const attemptedSlug = generateSlug(legacySlug);
      const byAttempt = catalog.get(attemptedSlug);

      if (!byAttempt) {
        noMatchSlugs.add(legacySlug);
        noMatchCount++;
        // Ainda assim, salvar o product_slug mínimo para que o evento seja "processado"
        // e não apareça novamente como não migrado
        const minimalMeta = {
          product_slug: legacySlug,
          product_name: legacySlug, // fallback = slug
          category: '',
          brand: '',
          source_page: event.page_url || '/',
          migrated_at: new Date().toISOString(),
          migration_note: 'slug-sem-match-no-catalogo',
        };
        try {
          await supabasePatch(
            `/analytics_events?id=eq.${event.id}`,
            { event_data: { ...event.event_data, ...minimalMeta } }
          );
        } catch (e) {
          failCount++;
          failedIds.push(event.id);
        }
        continue;
      }

      // Match pelo slug tentativo
      Object.assign(productMeta, byAttempt);
    }

    // Novo event_data: mescla o antigo + campos novos
    const newEventData = {
      ...event.event_data,
      product_slug: legacySlug,
      product_name: productMeta.product_name || legacySlug,
      category: productMeta.category || '',
      brand: productMeta.brand || '',
      source_page: event.page_url || event.event_data?.source_page || '/',
      migrated_at: new Date().toISOString(),
    };

    try {
      await supabasePatch(
        `/analytics_events?id=eq.${event.id}`,
        { event_data: newEventData }
      );
      successCount++;

      if (successCount % 50 === 0) {
        process.stdout.write(`   ⏳ ${successCount}/${toMigrate.length} migrados...\n`);
      }
    } catch (e) {
      failCount++;
      failedIds.push(event.id);
      console.warn(`   ⚠️  Falha ao atualizar evento ${event.id}: ${e.message}`);
    }
  }

  // 5. Relatório final
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  RELATÓRIO FINAL DA MIGRAÇÃO');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  ✅ Migrados com sucesso:   ${successCount}`);
  console.log(`  ⏭️  Já migrados (skipped): ${alreadyMigrated}`);
  console.log(`  🔍 Sem match no catálogo: ${noMatchCount}`);
  console.log(`  ❌ Falhas de atualização:  ${failCount}`);
  console.log(`  📊 Total processados:      ${allEvents.length}`);

  if (noMatchSlugs.size > 0) {
    console.log('\n  ⚠️  Slugs sem match no catálogo:');
    for (const s of noMatchSlugs) {
      console.log(`     - "${s}"`);
    }
  }

  if (failedIds.length > 0) {
    console.log('\n  ❌ IDs com falha de atualização:');
    console.log(`     ${failedIds.slice(0, 20).join(', ')}${failedIds.length > 20 ? ` ... (+${failedIds.length - 20} mais)` : ''}`);
  }

  console.log('\n═══════════════════════════════════════════════════\n');

  if (successCount > 0) {
    console.log('🎉 Migração concluída! O dashboard deve agora exibir nomes legíveis no ranking.');
    console.log('   Recarregue o painel /admin para ver os dados atualizados.\n');
  }
}

// ── Execução ─────────────────────────────────────────────────────────────────
migrate().catch(e => {
  console.error('\n❌ Erro inesperado na migração:', e);
  process.exit(1);
});
