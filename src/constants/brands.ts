import { cleanString, resolveFinalBrand } from '@/lib/brand-normalizer';

/**
 * Normaliza o nome da marca para uppercase, trim e sem acentos,
 * evitando duplicidade de marcas similares (ex: viapol, Viapol, VIAPOL).
 */
export function normalizeBrandName(name: string): string {
  return cleanString(name) || '';
}

/**
 * Resolve o nome de uma marca para um formato canônico (uppercase).
 * As listas oficiais agora são montadas dinamicamente via getBrands().
 */
export function resolveBrand(name: string, productName: string = ''): string {
  const resolved = resolveFinalBrand(name, productName);
  if (!resolved) return 'MUNDO DA IMPERMEABILIZAÇÃO'; // Fallback final (se não houver mais nada)
  
  return resolved;
}
