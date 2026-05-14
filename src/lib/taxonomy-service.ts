import { supabase } from './supabase';

export interface TaxonomyItem {
  id: string;
  group_name: 'TIPO' | 'APLICACAO';
  slug: string;
  label: string;
}

let taxonomyCache: TaxonomyItem[] | null = null;
let lastFetch = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 min

// Store for React subscriptions
type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

const EMPTY_ARRAY: TaxonomyItem[] = [];

export const taxonomyStore = {
  getSnapshot: (): TaxonomyItem[] => taxonomyCache ?? EMPTY_ARRAY,
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function invalidateTaxonomyCache() {
  taxonomyCache = null;
  lastFetch = 0;
}

export async function fetchTaxonomy(): Promise<TaxonomyItem[]> {
  const now = Date.now();
  if (taxonomyCache && now - lastFetch < CACHE_TTL) {
    return taxonomyCache;
  }

  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('catalog_taxonomy')
      .select('*')
      .order('label', { ascending: true });

    if (error) throw error;

    if (data) {
      taxonomyCache = data as TaxonomyItem[];
      lastFetch = now;
      emitChange();
      return taxonomyCache;
    }
  } catch (err) {
    console.error('[taxonomy-service] Error fetching taxonomy:', err);
  }
  return [];
}

export async function addTaxonomyItem(group_name: 'TIPO' | 'APLICACAO', label: string): Promise<TaxonomyItem | null> {
  if (!supabase) return null;
  const slug = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  
  const { data, error } = await supabase
    .from('catalog_taxonomy')
    .insert({ group_name, label, slug })
    .select()
    .single();

  if (error) {
    console.error('[taxonomy-service] Error adding taxonomy:', error);
    throw new Error(error.message);
  }

  invalidateTaxonomyCache();
  await fetchTaxonomy();
  return data as TaxonomyItem;
}

export async function removeTaxonomyItem(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('catalog_taxonomy').delete().eq('id', id);
  if (error) throw new Error(error.message);
  
  invalidateTaxonomyCache();
  await fetchTaxonomy();
}

export async function updateTaxonomyItem(id: string, label: string): Promise<void> {
  if (!supabase) return;
  const slug = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  
  const { error } = await supabase
    .from('catalog_taxonomy')
    .update({ label, slug })
    .eq('id', id);

  if (error) throw new Error(error.message);
  
  invalidateTaxonomyCache();
  await fetchTaxonomy();
}

export async function revalidateTaxonomy(): Promise<void> {
  invalidateTaxonomyCache();
  await fetchTaxonomy();
}

export async function syncProductTaxonomies(tipo: string[] = [], aplicacao: string[] = []): Promise<void> {
  if (!supabase) return;
  const currentTaxonomy = taxonomyStore.getSnapshot();
  const currentTipos = new Set(currentTaxonomy.filter(t => t.group_name === 'TIPO').map(t => t.slug));
  const currentApps = new Set(currentTaxonomy.filter(t => t.group_name === 'APLICACAO').map(t => t.slug));

  const toInsert: { group_name: 'TIPO'|'APLICACAO', label: string, slug: string }[] = [];

  for (const t of tipo) {
    const slug = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    if (!currentTipos.has(slug)) {
      toInsert.push({ group_name: 'TIPO', label: t, slug });
      currentTipos.add(slug);
    }
  }

  for (const a of aplicacao) {
    const slug = a.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    if (!currentApps.has(slug)) {
      toInsert.push({ group_name: 'APLICACAO', label: a, slug });
      currentApps.add(slug);
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('catalog_taxonomy').insert(toInsert);
    if (error) {
      console.error('[taxonomy-service] Error syncing taxonomies:', error);
    }
  }

  // Always invalidate and fetch to ensure local cache matches DB, even if there was an error (e.g. duplicate key) or no inserts needed but we just want to be sure.
  invalidateTaxonomyCache();
  await fetchTaxonomy();
}

if (typeof window !== 'undefined') {
  fetchTaxonomy().catch(err => console.error('[taxonomy-service] Initial fetch failed:', err));
}
