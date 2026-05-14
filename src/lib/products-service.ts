import { supabase } from './supabase';
import { z } from 'zod';
import { logger } from './logger';
import {
  products as fallbackProducts,
  type Product,
  type Categoria,
  type Brand,
  CATEGORIAS,
  generateSlug,
  normalizeForSearch,
  updateMemoryProducts,
  catalogStore,
} from '../data/products';

import { normalizeBrandName, resolveBrand } from '../constants/brands';

// ─── Cache ────────────────────────────────────────────────────────────────────
let productsCache: Product[] | null = null;
let lastFetch = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 min — only between user actions

// ─── Store for React subscriptions (useSyncExternalStore) ────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const productsStore = {
  getSnapshot: (): Product[] => productsCache ?? fallbackProducts,
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/**
 * Invalida o cache completamente.
 * Deve ser chamado após qualquer write (save, delete, toggle, upload).
 */
export function invalidateProductsCache(): void {
  productsCache = null;
  lastFetch = 0;
}

/**
 * Invalida e refaz o fetch imediatamente.
 * Chame após um save do Admin para garantir sincronização instantânea.
 */
export async function revalidateProducts(): Promise<void> {
  invalidateProductsCache();
  await fetchProducts();
}

// ─── Zod Validation ─────────────────────────────────────────────────────────────

const ProductSchema = z.object({
  id: z.string().optional(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  brand: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  description: z.string().nullable().optional(),
  highlight: z.boolean().nullable().optional(),
  active: z.boolean().nullable().optional(),
  available: z.boolean().nullable().optional(),
  tipo: z.array(z.string()).nullable().optional(),
  aplicacao: z.array(z.string()).nullable().optional(),
  como_usar: z.array(z.string()).nullable().optional(),
  specs: z.record(z.string()).nullable().optional(),
  parent_id: z.string().nullable().optional(),
});

// ─── Helper: Sanitize Arrays ───────────────────────────────────────────────────
function sanitizeStringArray(arr: any[] | null | undefined): string[] {
  if (!Array.isArray(arr)) return [];
  const result: string[] = [];
  for (const item of arr) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            result.push(...parsed.filter(i => typeof i === 'string'));
            continue;
          }
        } catch (e) {
          // Fall through
        }
      }
      if (trimmed) result.push(trimmed);
    }
  }
  return result;
}

// ─── DB Row Mapper ────────────────────────────────────────────────────────────

function mapToProduct(rawRow: any, staticMatch?: Product): Product {
  // Safe Parse via Zod to ensure runtime safety
  const parseResult = ProductSchema.safeParse(rawRow);
  const dbRow = parseResult.success ? parseResult.data : rawRow; // Graceful fallback

  if (!parseResult.success && DEV) {
    logger.warn(`Zod validation failed for product ${rawRow.slug}`, { error: parseResult.error });
  }

  // Parse images array robustly
  let images: string[] = [];
  if (Array.isArray(dbRow.images) && dbRow.images.length > 0) {
    images = dbRow.images.filter(Boolean);
  } else if (dbRow.image) {
    images = [dbRow.image];
  }

  const base = staticMatch ?? {} as Partial<Product>;

  return {
    id: dbRow.id || (base as Product).id,
    // Preserve rich static data, override with live DB values
    codigo: (base as Product).codigo || `DB-${(dbRow.id || '').substring(0, 6).toUpperCase()}`,
    nomeOriginal: dbRow.name || (base as Product).nomeOriginal || '',
    nome: dbRow.name || (base as Product).nome || '',
    slug: dbRow.slug || dbRow.id || '',
    categoria: dbRow.category || (base as Product).categoria || '',
    categoriaLabel: CATEGORIAS[dbRow.category]?.nome || dbRow.category || (base as Product).categoriaLabel || '',
    subcategoria: (base as Product).subcategoria || '',
    subcategoriaLabel: (base as Product).subcategoriaLabel || '',
    // DB brand takes priority; fall back to static; final fallback is generic
    marca: resolveBrand(dbRow.brand || (base as Product).marca || ''),
    embalagem: (base as Product).embalagem || 'Unidade',
    unidade: (base as Product).unidade || 'un',
    quantidadeEstoque: dbRow.available !== false
      ? ((base as Product).quantidadeEstoque ?? 100)
      : 0,
    // Image: DB value takes priority. If missing, fall through to static.
    imagem: dbRow.image || (base as Product).imagem || undefined,
    imagens: images.length > 0 ? images : ((base as Product).imagens ?? []),
    resumo: dbRow.description || (base as Product).resumo || '',
    // Rich fields: DB JSON takes priority, fall back to static
    tipo: sanitizeStringArray((Array.isArray(dbRow.tipo) ? dbRow.tipo : null) ?? (base as Product).tipo ?? []),
    aplicacao: sanitizeStringArray((Array.isArray(dbRow.aplicacao) ? dbRow.aplicacao : null) ?? (base as Product).aplicacao ?? []),
    comoUsar: sanitizeStringArray((Array.isArray(dbRow.como_usar) ? dbRow.como_usar : null) ?? (base as Product).comoUsar ?? []),
    especificacoes: dbRow.specs ?? (base as Product).especificacoes,
    destaque: dbRow.highlight ?? (base as Product).destaque ?? false,
    ativo: dbRow.active !== false,
    ordem: (base as Product).ordem ?? 999,
    palavrasChave: (base as Product).palavrasChave,
    parentId: dbRow.parent_id !== undefined ? dbRow.parent_id : (base as Product).parentId,
  };
}

// ─── Core fetch ──────────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const now = Date.now();

  // Only serve cache if it's fresh and exists
  if (productsCache && (now - lastFetch < CACHE_TTL)) {
    return productsCache;
  }

  if (!supabase) {
    if (DEV) console.info('[products-service] No Supabase — using fallback.');
    productsCache = fallbackProducts;
    lastFetch = now;
    emitChange();
    return productsCache;
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (data && data.length > 0) {
      const staticMap = new Map(fallbackProducts.map(p => [p.slug, p]));

      const mergedProducts: Product[] = data.map(dbItem => {
        const staticMatch = staticMap.get(dbItem.slug) || staticMap.get(dbItem.id);
        return mapToProduct(dbItem, staticMatch);
      });

      // Merge in static products that have no Supabase row yet (pure fallback data)
      const supabaseSlugs = new Set(mergedProducts.map(p => p.slug));
      const missingStatic = fallbackProducts.filter(
        p => p.ativo !== false && !supabaseSlugs.has(p.slug)
      );

      productsCache = [...mergedProducts, ...missingStatic].sort(
        (a, b) => (a.ordem ?? 999) - (b.ordem ?? 999)
      );
      lastFetch = now;

      // Keep catalogStore (products.ts) in sync so admin dashboard sees same data
      updateMemoryProducts(productsCache);

      emitChange();
      if (DEV) console.info(`[products-service] Fetched ${productsCache.length} products from Supabase.`);
      return productsCache;
    }

    // Supabase returned empty — use static fallback but don't cache aggressively
    if (DEV) logger.info('Supabase returned 0 products — falling back to static.');
  } catch (err) {
    logger.error(err as Error, { source: 'fetchProducts', detail: 'Supabase fetch failed, using fallback' });
  }

  // Resilient fallback
  productsCache = fallbackProducts;
  lastFetch = now;
  updateMemoryProducts(productsCache);
  emitChange();
  return productsCache;
}

// ─── RPC GIN Search ────────────────────────────────────────────────────────

/**
 * Executes a server-side search using the GIN JSONB index and Postgres ?| / @> operators.
 * Used for deep backend filtering (SEO/SSR safe)
 */
export async function searchCatalogViaRPC(tipos: string[] = [], aplicacoes: string[] = [], matchAll = false): Promise<Product[]> {
  if (!supabase) return productsStore.getSnapshot();

  const { data, error } = await supabase.rpc('search_catalog', {
    p_tipos: tipos,
    p_aplicacoes: aplicacoes,
    p_match_all: matchAll
  });

  if (error) {
    logger.error(error as Error, { source: 'searchCatalogViaRPC', message: 'RPC Search Failed, falling back to memory filtering' });
    const snapshot = productsStore.getSnapshot();
    return snapshot.filter(p => {
      let pass = true;
      if (tipos.length > 0) {
        if (!p.tipo || p.tipo.length === 0) pass = false;
        else {
          const normTipos = p.tipo.map(generateSlug);
          if (matchAll && !tipos.every(t => normTipos.includes(t))) pass = false;
          else if (!matchAll && !tipos.some(t => normTipos.includes(t))) pass = false;
        }
      }
      if (pass && aplicacoes.length > 0) {
        if (!p.aplicacao || p.aplicacao.length === 0) pass = false;
        else {
          const normAplicacoes = p.aplicacao.map(generateSlug);
          if (matchAll && !aplicacoes.every(a => normAplicacoes.includes(a))) pass = false;
          else if (!matchAll && !aplicacoes.some(a => normAplicacoes.includes(a))) pass = false;
        }
      }
      return pass;
    });
  }

  const staticMap = new Map(fallbackProducts.map(p => [p.slug, p]));
  return data.map((dbItem: any) => {
    const staticMatch = staticMap.get(dbItem.slug) || staticMap.get(dbItem.id);
    return mapToProduct(dbItem, staticMatch);
  });
}

/**
 * Salva um único produto no Supabase e invalida o cache imediatamente.
 * Substitui o uso direto de saveCustomProducts para edições individuais do Admin.
 */
export async function saveProductToSupabase(product: Product): Promise<void> {
  if (!supabase) return;

  const row = productToDbRow(product);
  const { error } = await supabase
    .from('products')
    .upsert(row, { onConflict: 'slug' });

  if (error) {
    logger.error(error as Error, { source: 'saveProductToSupabase', productSlug: product.slug });
    throw new Error(error.message);
  }
}

function productToDbRow(p: Product): Record<string, unknown> {
  const parentExists = p.parentId && productsStore.getSnapshot().some(prod => prod.id === p.parentId || prod.slug === p.parentId);

  const row: Record<string, unknown> = {
    slug: p.slug,
    name: p.nome,
    category: p.categoria,
    brand: p.marca || null,
    image: p.imagem || null,
    images: p.imagens && p.imagens.length > 0 ? p.imagens : null,
    description: p.resumo || null,
    highlight: p.destaque ?? false,
    active: p.ativo !== false,
    available: (p.quantidadeEstoque ?? 0) > 0,
    tipo: p.tipo ? p.tipo : [],
    aplicacao: p.aplicacao ? p.aplicacao : [],
    como_usar: p.comoUsar ? p.comoUsar : [],
    specs: p.especificacoes ?? null,
    parent_id: parentExists ? p.parentId.trim() : null,
    updated_at: new Date().toISOString(),
  };

  row.id = p.id || p.slug;

  return row;
}

// ─── Initial load on module mount ────────────────────────────────────────────

const DEV = import.meta.env.DEV;

if (typeof window !== 'undefined') {
  fetchProducts().catch(err => {
    if (DEV) console.error('[products-service] Initial fetch failed:', err);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getProductBySlug(slug: string): Product | undefined {
  return productsStore.getSnapshot().find(p => p.slug === slug);
}

export function getFeaturedProducts(): Product[] {
  return productsStore.getSnapshot()
    .filter(p => p.destaque && p.ativo !== false)
    .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
}

export function getProductsByCategory(category: string): Product[] {
  return productsStore.getSnapshot()
    .filter(p => p.categoria === category && p.ativo !== false)
    .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
}

export function getRelatedProducts(product: Product, max = 3): Product[] {
  return productsStore.getSnapshot()
    .filter(p => p.categoria === product.categoria && p.slug !== product.slug && p.ativo !== false)
    .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999))
    .slice(0, max);
}

export function getVariacoes(product: Product): Product[] {
  if (!product.parentId) return [];
  return productsStore.getSnapshot().filter(
    p => p.parentId === product.parentId && p.slug !== product.slug
  );
}

export function getCategorias(): Categoria[] {
  const all = productsStore.getSnapshot();
  const map = new Map<string, number>();

  for (const p of all) {
    if (p.ativo !== false) {
      map.set(p.categoria, (map.get(p.categoria) ?? 0) + 1);
    }
  }

  const response: Categoria[] = [];
  const knownDynamicCats = new Set<string>();

  for (const [slug, count] of map.entries()) {
    knownDynamicCats.add(slug);
    if (CATEGORIAS[slug]) {
      response.push({ ...CATEGORIAS[slug], count });
    } else {
      const productSample = all.find(p => p.categoria === slug);
      response.push({
        slug,
        nome: productSample?.categoriaLabel ?? slug,
        descricao: 'Navegue pelos produtos desta categoria.',
        metaTitle: `${productSample?.categoriaLabel ?? slug} | Mundo da Impermeabilização`,
        metaDescription: 'Veja as melhores soluções para sua obra.',
        count,
      });
    }
  }

  for (const cat of Object.values(CATEGORIAS)) {
    if (!knownDynamicCats.has(cat.slug)) {
      response.push({ ...cat, count: 0 });
    }
  }

  return response.sort((a, b) => b.count - a.count || a.nome.localeCompare(b.nome));
}


export function searchByName(query: string): Product[] {
  const all = productsStore.getSnapshot();
  const q = normalizeForSearch(query);
  if (!q) return all;

  return all.filter(p => {
    const fields = [
      p.nome,
      p.nomeOriginal,
      p.marca,
      p.codigo,
      p.categoriaLabel,
      p.subcategoriaLabel ?? '',
      p.resumo,
      ...(p.palavrasChave ?? []),
    ].map(normalizeForSearch);
    return fields.some(f => f.includes(q));
  });
}

export type { Product };
