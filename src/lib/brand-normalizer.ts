// Map of brand aliases -> Standard Brand
export const BRAND_ALIASES: Record<string, string> = {
  'viaplus': 'VIAPOL',
  'viabit': 'VIAPOL',
  'vedalage': 'VIAPOL',
  'betumanta': 'VIAPOL',
  'drykomanta': 'DRYKO',
  'drykoprimer': 'DRYKO',
  'denvertec': 'DENVER',
  'denvermanta': 'DENVER',
  'maxpren': 'MAXTON',
  'colamax': 'MAXTON',
  'veda facil': 'VEDACIT',
  'ultra ved': 'ULTRAVED',
  'ultraved': 'ULTRAVED',
};

// Map of common prefixes in product names -> Standard Brand
// Used for inference if the brand is empty or fake
export const INFERENCE_PREFIXES = [
  { prefix: 'BAUTECH', brand: 'BAUTECH' },
  { prefix: 'BRANYL', brand: 'BRANYL' },
  { prefix: 'ALSAN ACRIL', brand: 'DENVER' },
  { prefix: 'DENVER', brand: 'DENVER' },
  { prefix: 'IMPERMANTA', brand: 'DENVER' },
  { prefix: 'DRYKO', brand: 'DRYKO' },
  { prefix: 'EUCON', brand: 'EUCON' },
  { prefix: 'FUSEPROTEC', brand: 'FUSEPROTEC' },
  { prefix: 'MACTEX', brand: 'MACTEX' },
  { prefix: 'COLAMAX', brand: 'MAXTON' },
  { prefix: 'DESMOLTON', brand: 'MAXTON' },
  { prefix: 'KALFACIL', brand: 'MAXTON' },
  { prefix: 'MAXPREN', brand: 'MAXTON' },
  { prefix: 'SELATON', brand: 'MAXTON' },
  { prefix: 'VEDA FACIL', brand: 'VEDACIT' }, // Explicit rule #4 overrides others
  { prefix: 'MUNDO FLEX', brand: 'MUNDO FLEX' },
  { prefix: 'BETUMANTA', brand: 'VIAPOL' },
  { prefix: 'FITA QUALITAPE', brand: 'ADELBRAS' },
  { prefix: 'FITA MULTI USO TIPO SILVER TAPE', brand: 'ADELBRAS' },
  { prefix: 'Q-BORG', brand: 'Q-BORG' },
  { prefix: 'SELANTE Q-BORG', brand: 'Q-BORG' },
  { prefix: 'ACRIFAST QUARTZOLIT', brand: 'QUARTZOLIT' },
  { prefix: 'QUARTZOLIT', brand: 'QUARTZOLIT' },
  { prefix: 'SUPERGRAUTE', brand: 'QUARTZOLIT' },
  { prefix: 'TECBOND', brand: 'QUARTZOLIT' },
  { prefix: 'REPARO ESTRUTURAL', brand: 'QUARTZOLIT' },
  { prefix: 'SIKA', brand: 'SIKA' },
  { prefix: 'ARG. COLANTE', brand: 'DO MESTRE' },
  { prefix: 'POXPUR', brand: 'POXPUR' },
  { prefix: 'CURATON', brand: 'CURATON' },
  { prefix: 'ETANIZ', brand: 'ETANIZ' },
  { prefix: 'PLASTIBAND', brand: 'PLASTIBAND' },
  { prefix: 'MAXPRIMER', brand: 'MAXPRIMER' },
  { prefix: 'ULTRA VED', brand: 'ULTRAVED' },
  { prefix: 'ULTRAVED', brand: 'ULTRAVED' },
  { prefix: 'VASELINA EMCAPLUS', brand: 'EMCAPLUS' },
  { prefix: 'TECHDRENO', brand: 'TECHDRENO' },
  { prefix: 'TECHDUTO', brand: 'TECHDUTO' },
  { prefix: 'TEGAF', brand: 'TEGAF' },
  { prefix: 'VEDACIT', brand: 'VEDACIT' },
  { prefix: 'COMPOUND', brand: 'VEDACIT' },
  { prefix: 'BETUFITA', brand: 'VIAPOL' },
  { prefix: 'DESFORMA PLUS', brand: 'VIAPOL' },
  { prefix: 'VEDALAGE', brand: 'VIAPOL' },
  { prefix: 'VIABIT', brand: 'VIAPOL' },
  { prefix: 'VIACAL', brand: 'VIAPOL' },
  { prefix: 'VIAFIX', brand: 'VIAPOL' },
  { prefix: 'VIAPLUS', brand: 'VIAPOL' },
  { prefix: 'VIAPOL', brand: 'VIAPOL' },
  { prefix: 'VITPOLI', brand: 'VIAPOL' },
  { prefix: 'ADEFLEX', brand: 'VIAPOL' },
  { prefix: 'EUCOREPAIR', brand: 'VIAPOL' },
  { prefix: 'BETUFRIO', brand: 'VIAPOL' },
  { prefix: 'BETUPLAST', brand: 'VIAPOL' },
  { prefix: 'CURACRETO', brand: 'VIAPOL' },
  { prefix: 'ECOPRIMER', brand: 'VIAPOL' },
  { prefix: 'SUPERSTOP', brand: 'VIAPOL' },
  { prefix: 'VEDAMAT', brand: 'VIAPOL' },
  { prefix: 'VIABOC', brand: 'VIAPOL' },
  { prefix: 'VIAFLEX', brand: 'VIAPOL' },
  { prefix: 'REMOX', brand: 'REMOX' },
  { prefix: 'SALVATUDO', brand: 'SALVATUDO' },
];

const INVALID_BRANDS = [
  'MUNDO DA IMPERMEABILIZAÇÃO',
  'MARCA PRÓPRIA',
  'MARCA PROPRIA',
  'SEM MARCA',
];

export function cleanString(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .trim()
    .toUpperCase();
}

/**
 * Normalizes a brand name. 
 * Resolves aliases, fixes casing/accents.
 * Returns null if the brand is empty or considered "fake" (Mundo da Impermeabilização).
 */
export function normalizeBrand(rawBrand: string | null | undefined): string | null {
  if (!rawBrand) return null;
  const cleaned = cleanString(rawBrand);
  if (!cleaned) return null;

  if (INVALID_BRANDS.includes(cleaned)) {
    return null;
  }

  const lowerAlias = cleaned.toLowerCase();
  if (BRAND_ALIASES[lowerAlias]) {
    return BRAND_ALIASES[lowerAlias];
  }

  // Also check if any alias is contained entirely or prefix matched
  for (const [alias, realBrand] of Object.entries(BRAND_ALIASES)) {
    if (lowerAlias === alias) {
      return realBrand;
    }
  }

  return cleaned;
}

/**
 * Infers a brand from a product name using known prefixes.
 */
export function inferBrandFromName(productName: string): string | null {
  if (!productName) return null;
  const cleanedName = cleanString(productName);

  for (const item of INFERENCE_PREFIXES) {
    if (cleanedName.startsWith(cleanString(item.prefix))) {
      return item.brand;
    }
  }

  return null;
}

/**
 * Full pipeline: tries to normalize existing brand. If invalid/missing, falls back to inferBrandFromName.
 */
export function resolveFinalBrand(rawBrand: string | null | undefined, productName: string): string | null {
  const normalized = normalizeBrand(rawBrand);
  if (normalized) {
    return normalized;
  }
  
  // If no valid brand exists, infer from name
  return inferBrandFromName(productName);
}
