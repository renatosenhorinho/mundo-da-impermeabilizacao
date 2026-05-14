// ─── Enums e Constantes ───────────────────────────────────────────────────────

export type Unidade = 'm²' | 'm³' | 'm' | 'kg' | 'L' | 'un' | 'gl' | 'cx' | 'bd' | 'sc';

export type Marca =
  | 'Vedacit'
  | 'Viapol'
  | 'Dryko'
  | 'Soprema'
  | 'Quartzolit'
  | 'Qborg'
  | 'Sika'
  | 'Mapei'
  | string;

export type CategoriaSlug =
  | 'impermeabilizantes-cimenticios'
  | 'manta-liquida'
  | 'manta-asfaltica'
  | 'primer'
  | 'fitas-aluminizadas'
  | 'selantes'
  | 'aditivos'
  | 'adesivos-e-epoxi'
  | 'graute-e-reparacao-estrutural'
  | 'desmoldantes-e-cura'
  | 'drenagem-e-geotexteis'
  | 'ferramentas-e-acessorios'
  | string;

import { getSessionId } from '../lib/analytics';
import { resolveBrand } from '../constants/brands';

// ─── Interface Principal ──────────────────────────────────────────────────────

export interface Product {
  /** UUID primário do banco de dados (gerado no Supabase) */
  id?: string;

  /** Código interno / SKU. Exemplo: "VDC-MA-3MM" */
  codigo: string;

  /** Nome exato do fabricante (conforme embalagem) */
  nomeOriginal: string;

  /** Nome comercial de exibição no site */
  nome: string;

  /**
   * URL slug único gerado automaticamente.
   * Gerado via `generateSlug()` e garantido único por `deduplicateSlugs()`.
   * Exemplo: "manta-asfaltica-vedacit-3mm", "produto-x-2"
   */
  slug: string;

  /** Slug da categoria principal */
  categoria: CategoriaSlug;

  /** Rótulo legível da categoria */
  categoriaLabel: string;

  /** Slug da subcategoria (opcional) */
  subcategoria?: string;

  /** Rótulo legível da subcategoria */
  subcategoriaLabel?: string;

  /** Marca do produto */
  marca: Marca;

  /** Descrição da embalagem. Exemplos: "Rolo 10m × 1m", "Balde 18L" */
  embalagem: string;

  /** Unidade de venda/aplicação */
  unidade: Unidade;

  /** Quantidade em estoque. 0 = fora de estoque */
  quantidadeEstoque: number;

  /**
   * Caminho da imagem principal.
   * Se não definido manualmente, é gerado automaticamente via slug e categoria.
   */
  imagem?: string;

  /**
   * Lista de caminhos de todas as imagens do produto (para carrossel).
   * Gerado automaticamente pelo script de otimização.
   */
  imagens?: string[];

  /** Descrição curta para card (~120 chars) */
  resumo: string;

  /** Tipos normatizados do produto para filtros dinâmicos (slugs) */
  tipo?: string[];

  /** Onde/como o produto é aplicado — renderizado como <ul> ou usado para filtros */
  aplicacao: string[];

  /** Passo a passo de uso — renderizado como <ol> numerada */
  comoUsar: string[];

  /** URL do PDF da ficha técnica (nunca auto-carregado) */
  fichaTecnica?: string;

  /** Especificações técnicas: tabela chave → valor */
  especificacoes?: Record<string, string>;

  /** Se true, aparece em destaque na home ou topo do catálogo */
  destaque: boolean;

  /** Se false, fica oculto do catálogo (descontinuado ou indisponível) */
  ativo: boolean;

  /** Ordem de exibição dentro da categoria (menor = primeiro) */
  ordem: number;

  /**
   * ID do produto "pai" para agrupar variações.
   * Exemplo: manta 3mm e manta 4mm podem ter parentId: "manta-asfaltica-vedacit"
   * Permite exibir variações juntas na página de detalhe.
   */
  parentId?: string;

  /**
   * Palavras-chave extras para melhorar a busca interna.
   * Exemplos: ["manta", "telhado", "laje", "NBR 9952"]
   * Não exibidas ao usuário — só usadas pelo searchByName().
   */
  palavrasChave?: string[];
}

// ─── Tipos Auxiliares ─────────────────────────────────────────────────────────

export interface CategoryMeta {
  slug: CategoriaSlug;
  nome: string;
  descricao: string;
  metaTitle: string;
  metaDescription: string;
}

export interface Categoria extends CategoryMeta {
  count: number;
}

// ─── Dados Fixos de Categorias (SEO & Títulos) ─────────────────────────────────

export const CATEGORIAS: Record<string, CategoryMeta> = {
  'impermeabilizantes-cimenticios': {
    slug: 'impermeabilizantes-cimenticios',
    nome: 'Impermeabilizantes Cimentícios',
    descricao: 'Soluções em pó para mistura. Ideais para áreas úmidas submersas ou sujeitas à pressão da água, como caixas d\'água, piscinas e poços de elevador.',
    metaTitle: 'Impermeabilizantes Cimentícios: Piscinas e Caixas D\'Água | Mundo da Impermeabilização',
    metaDescription: 'Evite vazamentos em caixas d\'água e piscinas com impermeabilizantes cimentícios de alta resistência. Soluções definitivas contra umidade e pressão estrutural.',
  },
  'manta-liquida': {
    slug: 'manta-liquida',
    nome: 'Manta Líquida',
    descricao: 'Proteção contínua e sem emendas. Impermeabilizantes flexíveis de fácil aplicação para lajes residenciais, marquises e telhados com exposição ao sol.',
    metaTitle: 'Manta Líquida para Lajes e Telhados | Mundo da Impermeabilização',
    metaDescription: 'Blinde sua laje contra infiltrações com Manta Líquida. Aplicação prática a frio, formando uma membrana elástica, sem juntas e resistente ao sol.',
  },
  'manta-asfaltica': {
    slug: 'manta-asfaltica',
    nome: 'Manta Asfáltica',
    descricao: 'O sistema mais tradicional e eficiente do mercado. Máxima durabilidade para lajes de grande porte, coberturas e áreas de alta movimentação estrutural.',
    metaTitle: 'Manta Asfáltica: Proteção Máxima para Lajes | Mundo da Impermeabilização',
    metaDescription: 'Acabe com a infiltração grave. Mantas asfálticas elastoméricas com alto poder de vedação para lajes, telhados e baldrames. Compre com quem entende.',
  },
  'primer': {
    slug: 'primer',
    nome: 'Primers e Imprimações',
    descricao: 'O primeiro passo para uma impermeabilização segura. Promotores de aderência que preparam o concreto para receber as mantas ou membranas asfálticas.',
    metaTitle: 'Primer Asfáltico para Imprimação e Aderência | Mundo da Impermeabilização',
    metaDescription: 'Garanta a adesão perfeita da sua impermeabilização. Primers asfálticos à base de água ou solvente para o preparo ideal de lajes, baldrames e contrapisos.',
  },
  'fitas-aluminizadas': {
    slug: 'fitas-aluminizadas',
    nome: 'Fitas Aluminizadas',
    descricao: 'Reparos rápidos e definitivos. Fitas asfálticas autoadesivas ideais para vedar goteiras em telhados, calhas, rufos e dutos de ar condicionado instantaneamente.',
    metaTitle: 'Fita Asfáltica Aluminizada e Autoadesiva | Mundo da Impermeabilização',
    metaDescription: 'Vede goteiras e trincas de forma simples e imediata. Fitas aluminizadas super colantes para conserto de telhados, calhas e toldos com aplicação a frio.',
  },
  'selantes': {
    slug: 'selantes',
    nome: 'Selantes e Mástiques',
    descricao: 'Acabamento e vedação profissional. Selantes de Poliuretano (PU), silicones e acrílicos desenvolvidos para preencher trincas e juntas de dilatação com flexibilidade.',
    metaTitle: 'Selantes PU e Mástiques para Juntas e Trincas | Mundo da Impermeabilização',
    metaDescription: 'Bloqueie a passagem de água por rachaduras e juntas estruturais. Selantes de PU elásticos, resistentes a intempéries e de altíssima durabilidade.',
  },
  'aditivos': {
    slug: 'aditivos',
    nome: 'Aditivos Impermeabilizantes',
    descricao: 'Proteção direto na massa. Aditivos incorporados ao concreto ou argamassa para evitar que a umidade de solo suba fatalmente pela alvenaria e alicerces.',
    metaTitle: 'Aditivos para Concreto e Argamassa | Mundo da Impermeabilização',
    metaDescription: 'Previna a umidade de rodapé e reboco descascando. Aditivos impermeabilizantes hidrorepelentes para misturar direto na massa da sua obra.',
  },
  'adesivos-e-epoxi': {
    slug: 'adesivos-e-epoxi',
    nome: 'Adesivos e Epóxi',
    descricao: 'Colagem e ancoragem de alta resistência. Resinas epóxi e adesivos estruturais robustos para colar concreto novo no antigo ou chumbamento de ferragens.',
    metaTitle: 'Resina Epóxi e Adesivos Estruturais | Mundo da Impermeabilização',
    metaDescription: 'Colagem ultrarresistente para construção civil. Adesivos estruturais e resina epóxi para junção de concreto, emendas de laje e chumbamento químico.',
  },
  'graute-e-reparacao-estrutural': {
    slug: 'graute-e-reparacao-estrutural',
    nome: 'Graute e Reparação Estrutural',
    descricao: 'Recuperação resistente da estrutura de concreto. Minimizam defeitos estruturais e garantem o preenchimento autonivelante de falhas ou bases de máquinas.',
    metaTitle: 'Grauteamento e Recuperação de Concreto | Mundo da Impermeabilização',
    metaDescription: 'Recupere vigas, pilares e lajes de concreto com segurança total. Massa para reparo estrutural e graute fluido de altíssima resistência inicial e final.',
  },
  'desmoldantes-e-cura': {
    slug: 'desmoldantes-e-cura',
    nome: 'Desmoldantes e Agentes de Cura',
    descricao: 'Perfeição no acabamento. Evitam que o concreto grude nas formas, além de assegurar o controle químico da cura para prevenir indesejáveis fissuras de retração.',
    metaTitle: 'Agentes de Cura Química e Desmoldantes | Mundo da Impermeabilização',
    metaDescription: 'Aumente a vida útil das formas de madeira e evite fissuras termoplásticas no concreto. Desmoldantes práticos e agentes de cura química de alta performance.',
  },
  'drenagem-e-geotexteis': {
    slug: 'drenagem-e-geotexteis',
    nome: 'Drenagem e Geotêxteis',
    descricao: 'Controle inteligente do fluxo subterrâneo de água. Mantas geotêxteis (bidim) que cumprem o papel vital no sistema de drenagem e na proteção mecânica da impermeabilização.',
    metaTitle: 'Manta Bidim Geotêxtil e Sistemas de Drenagem | Mundo da Impermeabilização',
    metaDescription: 'Escoamento de água eficiente sem perder terra. Mantas geotêxteis filtrantes para drenagem de jardins, vasos, muros de arrimo e proteção sobre a manta asfáltica.',
  },
  'ferramentas-e-acessorios': {
    slug: 'ferramentas-e-acessorios',
    nome: 'Ferramentas e Acessórios',
    descricao: 'Tudo o que o aplicador precisa para trabalhar. Ralos práticos, maçaricos intensos, trinchas e espátulas exigidos para um acabamento liso e estanque.',
    metaTitle: 'Ferramentas para Impermeabilização e Acessórios | Mundo da Impermeabilização',
    metaDescription: 'Garanta o resultado perfeito. Ferramentas essenciais como maçarico para manta asfáltica, rolos especiais e ralos redondos para aplicação profissional profunda.',
  }
};

/**
 * Mapeamento entre o slug da categoria e a pasta física das imagens.
 * Isso permite que a estrutura de pastas seja independente dos slugs de URL.
 */
export const CATEGORY_IMAGE_FOLDERS: Record<string, string> = {
  'impermeabilizantes-cimenticios': 'impermeabilizantes-cimenticios',
  'manta-liquida': 'manta-liquida',
  'manta-asfaltica': 'manta-asfaltica',
  'primer': 'primer',
  'fitas-aluminizadas': 'fitas-aluminizadas',
  'selantes': 'selantes',
  'aditivos': 'aditivos',
  'adesivos-e-epoxi': 'adesivos-e-epoxi',
  'graute-e-reparacao-estrutural': 'graute-e-reparacao-estrutural',
  'desmoldantes-e-cura': 'desmoldantes-e-cura',
  'drenagem-e-geotexteis': 'drenagem-e-geotexteis',
  'ferramentas-e-acessorios': 'ferramentas-e-acessorios',
};

export interface Brand {
  slug: string;
  label: string;
  count: number;
}

// ─── Helpers: Normalização de Texto ──────────────────────────────────────────

/**
 * Normaliza texto para comparação insensível a:
 * - acentos/diacríticos
 * - maiúsculas/minúsculas
 * - hífens, underscores e espaços (todos viram string vazia para matching)
 *
 * @example
 * normalizeForSearch("Vedacít")  → "vedacit"
 * normalizeForSearch("Veda Cit") → "vedacit"
 * normalizeForSearch("veda-cit") → "vedacit"
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .replace(/[\s\-_]+/g, '')        // remove espaços, hífens, underscores
    .replace(/[^a-z0-9]/g, '');      // remove qualquer outro caractere especial
}

/**
 * Converte qualquer texto em slug URL-safe.
 * Remove acentos, converte para minúsculas, substitui espaços/especiais por hífens.
 * NÁO garante unicidade — use `deduplicateSlugs()` para isso.
 *
 * @example
 * generateSlug("Manta Asfáltica Vedacit 3mm") → "manta-asfaltica-vedacit-3mm"
 * generateSlug("Produto (Versão A)")           → "produto-versao-a"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .replace(/[^a-z0-9\s-]/g, ' ')  // caracteres especiais → espaço
    .trim()
    .replace(/\s+/g, '-')           // espaços → hífens
    .replace(/-+/g, '-')            // hífens duplos → simples
    .replace(/(^-|-$)/g, '');       // remove hífens nas pontas
}

/**
 * Garante unicidade de slugs dentro de um array de produtos.
 * Se dois produtos gerarem o mesmo slug base, o segundo recebe "-2",
 * o terceiro "-3", e assim por diante.
 *
 * Uso interno ao construir o catálogo — não chamar manualmente.
 *
 * @example
 * // Input:  [{slug:"produto-x"}, {slug:"produto-x"}, {slug:"produto-x"}]
 * // Output: [{slug:"produto-x"}, {slug:"produto-x-2"}, {slug:"produto-x-3"}]
 */
export function deduplicateSlugs<T extends { slug: string }>(items: T[]): T[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = item.slug;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    if (count === 0) return item;
    return { ...item, slug: `${base}-${count + 1}` };
  });
}

// ─── Helpers: Consulta ────────────────────────────────────────────────────────

/** Retorna o produto pelo slug exato. */
export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

/**
 * Busca fulltext — insensível a acentos, maiúsculas, hífens e variações simples.
 *
 * Campos pesquisados (em ordem de relevância):
 *   nome, nomeOriginal, marca, codigo, categoriaLabel,
 *   subcategoriaLabel, resumo, palavrasChave
 *
 * @example
 * searchByName("vedacit")   // ✅ encontra "Vedacit"
 * searchByName("vedacít")   // ✅ encontra "Vedacit"
 * searchByName("Veda Cit")  // ✅ encontra "Vedacit"
 * searchByName("veda-cit")  // ✅ encontra "Vedacit"
 */
export function searchByName(query: string): Product[] {
  const q = normalizeForSearch(query);
  if (!q) return products;

  return products.filter((p) => {
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

    return fields.some((f) => f.includes(q));
  });
}

/** Filtra produtos por categoria. Retorna apenas produtos ativos. */
export function filterByCategoria(categoriaSlug: string): Product[] {
  return products.filter((p) => p.categoria === categoriaSlug);
}

/** Filtra produtos por subcategoria. Retorna apenas produtos ativos. */
export function filterBySubcategoria(subcategoriaSlug: string): Product[] {
  return products.filter((p) => p.subcategoria === subcategoriaSlug);
}

/**
 * Filtra produtos por marca — insensível a acentos e maiúsculas.
 * Aceita o slug gerado (ex: "vedacit") ou o nome exato (ex: "Vedacit").
 */
export function filterByMarca(marcaSlugOrName: string): Product[] {
  const q = normalizeForSearch(marcaSlugOrName);
  return products.filter((p) => normalizeForSearch(p.marca) === q);
}

/**
 * Retorna todas as variações de um produto pai (mesmo parentId).
 * Exclui o produto passado como argumento.
 */
export function getVariacoes(product: Product): Product[] {
  if (!product.parentId) return [];
  return products.filter(
    (p) => p.parentId === product.parentId && p.slug !== product.slug
  );
}

/** Retorna produtos relacionados da mesma categoria, ordenados por `ordem`. */
export function getRelatedProducts(product: Product, max = 3): Product[] {
  return products
    .filter((p) => p.categoria === product.categoria && p.slug !== product.slug)
    .sort((a, b) => a.ordem - b.ordem)
    .slice(0, max);
}

/** Retorna produtos em destaque, ordenados por `ordem`. */
export function getDestaques(): Product[] {
  return products.filter((p) => p.destaque).sort((a, b) => a.ordem - b.ordem);
}

/**
 * Retorna todas as categorias ativas (com count > 0) + aquelas em CATEGORIAS mesmo com count 0
 * para manter o menu sempre estruturado.
 */
export function getCategorias(): Categoria[] {
  const map = new Map<string, number>();

  // Contagem real
  for (const p of products) {
    if (p.ativo) {
      map.set(p.categoria, (map.get(p.categoria) ?? 0) + 1);
    }
  }

  // Montagem final unindo nossa base estática com as dinâmicas não catalogadas
  const response: Categoria[] = [];
  const knownDynamicCats = new Set<string>();

  for (const [slug, count] of map.entries()) {
    knownDynamicCats.add(slug);
    if (CATEGORIAS[slug]) {
      response.push({ ...CATEGORIAS[slug], count });
    } else {
      // Caso tenham cadastrado um produto com slug de categoria que foge da lista
      const productSample = products.find(p => p.categoria === slug);
      response.push({
        slug,
        nome: productSample?.categoriaLabel ?? slug,
        descricao: 'Navegue pelos produtos desta categoria.',
        metaTitle: `${productSample?.categoriaLabel ?? slug} | Mundo da Impermeabilização`,
        metaDescription: 'Veja as melhores soluções para sua obra.',
        count
      });
    }
  }

  // Preenche categorias estáticas que ficaram com zero estoque/produtos (opcional, pode ser comentado para ocultar vazias)
  for (const cat of Object.values(CATEGORIAS)) {
    if (!knownDynamicCats.has(cat.slug)) {
      response.push({ ...cat, count: 0 });
    }
  }

  // Ordena por quantidade, colocando os dinâmicos em último ou alfabético
  return response.sort((a, b) => b.count - a.count || a.nome.localeCompare(b.nome));
}

/**
 * Retorna todas as marcas únicas com contagem de produtos ativos.
 * Ordenadas por contagem decrescente.
 */
export function getMarcas(): Brand[] {
  const map = new Map<string, number>();
  for (const p of products) {
    map.set(p.marca, (map.get(p.marca) ?? 0) + 1);
  }
  return Array.from(map, ([label, count]) => ({
    slug: generateSlug(label),
    label,
    count,
  })).sort((a, b) => b.count - a.count);
}


// ─── Dados de Exemplo ─────────────────────────────────────────────────────────
// Para catálogos grandes, divida em arquivos por categoria:
//
//   src/data/products/mantas-asfalticas.ts    → export const mantasAsfalticas: Product[]
//   src/data/products/impermeabilizantes.ts   → export const impermeabilizantes: Product[]
//   src/data/products/index.ts                → export const products = [...mantasAsfalticas, ...]

// rawProducts removed, now only Supabase is the source of truth.

// ─── Exportação com Slugs Únicos ─────────────────────────────────────────────
// 1. Filtra inativos
// 2. Ordena por categoria e depois por ordem
// 3. Garante unicidade de slugs via deduplicateSlugs()



const staticProducts: Product[] = [];

// Load custom products from localStorage (Admin CRUD)
const getDynamicProducts = (): Product[] => {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem('mdi_custom_products');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

let mergedProductsMemory: Product[] | null = null;

const mergeProducts = (): Product[] => {
  if (mergedProductsMemory) return mergedProductsMemory;

  const dynamicProducts = getDynamicProducts();
  const mergedMap = new Map<string, Product>();

  // 1. Add static products
  staticProducts.forEach(p => mergedMap.set(p.slug, p));

  // 2. Override/Add with dynamic products
  dynamicProducts.forEach(p => {
    if (p.ativo === false) {
      mergedMap.delete(p.slug); // Handle deletions
    } else {
      mergedMap.set(p.slug, { ...p, isCustom: true } as any);
    }
  });

  const finalArray = Array.from(mergedMap.values()).sort((a, b) => {
    // Put custom highlights first, then static highlights, then rest
    if (a.destaque !== b.destaque) return a.destaque ? -1 : 1;
    return (a.ordem || 999) - (b.ordem || 999);
  });

  mergedProductsMemory = finalArray;
  return finalArray;
};

// Export dynamically using a proxy so it always gets the latest reference
// or just export the array and reassign its contents.
export const products: Product[] = [];

// Simple global store for React components (useSyncExternalStore)
type Listener = () => void;
const listeners = new Set<Listener>();

export const catalogStore = {
  getSnapshot: () => products,
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  emitChange: () => {
    for (let listener of listeners) {
      listener();
    }
  }
};

// Initialize products array synchronously
const initialMerge = mergeProducts();
products.push(...initialMerge);

// Force update the array in-place so all references stay valid
export const updateMemoryProducts = (newProducts: Product[]) => {
  products.length = 0; // Clear existing
  products.push(...newProducts); // Fill with new
  catalogStore.emitChange();
};

import { supabase } from '../lib/supabase';

// Helper: Convert Product -> DB Row (legacy path — products-service has the canonical version)
const productToDbRow = (p: Product) => {
  const parentExists = p.parentId && products.some(prod => prod.id === p.parentId || prod.slug === p.parentId);

  const row: any = {
    slug: p.slug,
    name: p.nome,
    category: p.categoria,
    brand: p.marca || null,
    image: p.imagem || null,
    images: p.imagens && p.imagens.length > 0 ? p.imagens : null,
    description: p.resumo || null,
    highlight: p.destaque ?? false,
    active: p.ativo !== false,
    aplicacao: p.aplicacao && p.aplicacao.length > 0 ? p.aplicacao : null,
    como_usar: p.comoUsar && p.comoUsar.length > 0 ? p.comoUsar : null,
    parent_id: parentExists ? p.parentId.trim() : null,
    updated_at: new Date().toISOString(),
  };
  row.id = p.id || p.slug;
  return row;
};

// Helper: DB Row -> Product (legacy path used by syncProductsFromDB)
const dbRowToProduct = (row: any): Product => {
  let images: string[] = [];
  if (Array.isArray(row.images) && row.images.length > 0) {
    images = row.images.filter(Boolean);
  } else if (row.image) {
    images = [row.image];
  }
  return {
    id: row.id,
    slug: row.slug || row.id,
    codigo: `DB-${(row.slug || row.id || '').substring(0, 6).toUpperCase()}`,
    nome: row.name,
    nomeOriginal: row.name,
    categoria: row.category,
    categoriaLabel: CATEGORIAS[row.category]?.nome || row.category,
    // Use brand from DB — never hardcode
    marca: resolveBrand(row.brand || ''),
    embalagem: 'Unidade',
    unidade: 'un',
    quantidadeEstoque: row.available !== false ? 100 : 0,
    imagem: row.image || undefined,
    imagens: images,
    resumo: row.description || '',
    aplicacao: Array.isArray(row.aplicacao) ? row.aplicacao : [],
    comoUsar: Array.isArray(row.como_usar) ? row.como_usar : [],
    destaque: row.highlight ?? false,
    ativo: row.active !== false,
    ordem: 1,
    isCustom: true,
  } as any;
};

export const syncProductsFromDB = async () => {
  if (!supabase) return;

  try {
    // Only fetch active products — inactive ones have no business in the catalog
    const { data, error } = await supabase.from('products').select('*').eq('active', true);
    if (error) throw error;

    if (data && data.length > 0) {
      const dbProducts = data.map(dbRowToProduct);
      localStorage.setItem('mdi_custom_products', JSON.stringify(dbProducts));

      // Update memory — but only if products-service hasn't already loaded a better result
      // products-service fetchProducts() also calls updateMemoryProducts, so this is safe
      mergedProductsMemory = null;
      updateMemoryProducts(mergeProducts());
    }
  } catch (error) {
    console.error('Error syncing products from Supabase:', error);
  }
};

export const saveCustomProducts = async (newProducts: Product[]) => {
  if (typeof window === 'undefined') return;

  // 1. Update localStorage and memory store instantly (Optimistic Update)
  localStorage.setItem('mdi_custom_products', JSON.stringify(newProducts));
  mergedProductsMemory = null;
  updateMemoryProducts(mergeProducts());

  // 2. Persist to Supabase async — use slug as conflict key
  if (supabase) {
    try {
      const rows = newProducts.map(productToDbRow);
      const { error } = await supabase.from('products').upsert(rows, { onConflict: 'slug' });
      if (error) throw error;
    } catch (e) {
      console.error('Failed to save to Supabase:', e);
      // Data is safe in localStorage anyway
    }
  }
};

// Auto-sync on load
if (typeof window !== 'undefined') {
  syncProductsFromDB();
}


