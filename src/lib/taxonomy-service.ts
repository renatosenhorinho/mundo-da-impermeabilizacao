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

if (typeof window !== 'undefined') {
  fetchTaxonomy().catch(err => console.error('[taxonomy-service] Initial fetch failed:', err));
}
