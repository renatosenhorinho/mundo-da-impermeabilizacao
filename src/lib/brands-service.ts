import { supabase } from './supabase';
import { productsStore, revalidateProducts } from './products-service';
import { normalizeBrandName, resolveBrand } from '@/constants/brands';
import { generateSlug } from '@/data/products';

export interface BrandStats {
  slug: string;
  label: string;
  count: number;
}

/**
 * Retorna todas as marcas ativas no sistema derivadas dos produtos atuais.
 */
export function getBrands(): BrandStats[] {
  const all = productsStore.getSnapshot();
  const map = new Map<string, number>();
  
  for (const p of all) {
    if (p.ativo !== false) {
      const resolved = resolveBrand(p.marca || '', p.nome);
      if (resolved && resolved !== 'MUNDO DA IMPERMEABILIZAÇÃO') {
        map.set(resolved, (map.get(resolved) ?? 0) + 1);
      }
    }
  }
  
  return Array.from(map, ([label, count]) => ({
    slug: generateSlug(label),
    label,
    count,
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Tenta remover uma marca do sistema (definindo como NULL/vazio todos os produtos que a usam).
 * Caso não haja produtos usando, a marca já não existe virtualmente.
 */
export async function deleteBrand(brandLabel: string): Promise<void> {
  const normalized = normalizeBrandName(brandLabel);
  if (!normalized) throw new Error('Marca inválida.');

  if (!supabase) {
    throw new Error('Supabase não configurado. Impossível remover marca de forma persistente.');
  }

  // 1. Atualizar banco de dados: todos os produtos com essa marca ficam sem marca
  const { error } = await supabase
    .from('products')
    .update({ brand: null })
    .ilike('brand', normalized);

  if (error) {
    throw new Error(`Erro ao deletar marca: ${error.message}`);
  }

  // 2. Invalidar cache e recarregar
  await revalidateProducts();
}

/**
 * Mescla uma marca (oldBrand) para outra (newBrand), transferindo todos os produtos.
 */
export async function mergeBrands(oldBrand: string, newBrand: string): Promise<void> {
  const normalizedOld = normalizeBrandName(oldBrand);
  const normalizedNew = normalizeBrandName(newBrand);
  
  if (!normalizedOld || !normalizedNew) {
    throw new Error('Nomes de marca inválidos.');
  }
  if (normalizedOld === normalizedNew) {
    throw new Error('As marcas são idênticas.');
  }

  if (!supabase) {
    throw new Error('Supabase não configurado. Impossível mesclar marcas de forma persistente.');
  }

  // 1. Atualizar produtos
  const { error } = await supabase
    .from('products')
    .update({ brand: normalizedNew })
    .ilike('brand', normalizedOld);

  if (error) {
    throw new Error(`Erro ao mesclar marcas: ${error.message}`);
  }

  // 2. Invalidar cache
  await revalidateProducts();
}
