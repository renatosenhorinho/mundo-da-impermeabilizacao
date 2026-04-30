import React from 'react';
import {
  products,
  catalogStore,
  getCategorias,
  getMarcas,
  searchByName,
  type Product,
} from '@/data/products';
import { useNavigate, useParams } from 'react-router-dom';

const ProductCard = React.lazy(() => import('./product-card'));

const ITEMS_PER_PAGE = 12;

const CardSkeleton = () => (
  <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-100">
    <div className="bg-slate-200 animate-pulse" style={{ aspectRatio: '4 / 3' }} />
    <div className="p-5 space-y-3">
      <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
      <div className="h-5 w-3/4 bg-slate-200 rounded animate-pulse" />
      <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
      <div className="h-4 w-2/3 bg-slate-200 rounded animate-pulse" />
      <div className="flex gap-2 pt-1">
        <div className="h-9 flex-1 bg-slate-200 rounded-xl animate-pulse" />
        <div className="h-9 flex-1 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    </div>
  </div>
);

interface CatalogGridProps {
  initialCategory?: string;
}

const CatalogGrid: React.FC = () => {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const navigate = useNavigate();
  const categorias = React.useMemo(() => getCategorias(), []);
  const marcas = React.useMemo(() => getMarcas(), []);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeCategoria, setActiveCategoria] = React.useState<string | null>(categorySlug ?? null);
  const [activeMarca, setActiveMarca] = React.useState<string | null>(null);
  const [activeAplicacao, setActiveAplicacao] = React.useState<string | null>(null);
  const [activeTipo, setActiveTipo] = React.useState<string | null>(null);
  const [sortBy, setSortBy] = React.useState<'relevance' | 'name' | 'stock'>('relevance');
  const [visibleCount, setVisibleCount] = React.useState(ITEMS_PER_PAGE);

  // Sync state with URL when browser back/forward is used
  React.useEffect(() => {
    setActiveCategoria(categorySlug ?? null);
  }, [categorySlug]);

  // Debounce — only filter after user stops typing 300ms
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Dynamic SEO meta
  React.useEffect(() => {
    if (activeCategoria) {
      const cat = categorias.find((c) => c.slug === activeCategoria);
      if (cat) {
        document.title = cat.metaTitle || `${cat.nome} | Mundo da Impermeabilização`;
        document.querySelector('meta[name="description"]')?.setAttribute(
          'content',
          cat.metaDescription || `Catálogo de ${cat.nome.toLowerCase()} para impermeabilização.`
        );
      }
    } else {
      document.title = 'Produtos | Mundo da Impermeabilização';
      document.querySelector('meta[name="description"]')?.setAttribute(
        'content',
        'Catálogo completo de produtos para impermeabilização. Mantas asfálticas, impermeabilizantes líquidos, primers e mais.'
      );
    }
  }, [activeCategoria, categorias]);

  // Filtered + sorted + sliced
  const catalog = React.useSyncExternalStore(catalogStore.subscribe, catalogStore.getSnapshot);

  const filteredProducts = React.useMemo<Product[]>(() => {
    // Redefine searchByName in memo context to use updated catalog state
    const doSearch = (query: string) => {
      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return [...catalog];
      
      return catalog.filter(p => {
        const target = `${p.nome} ${p.marca} ${p.categoria} ${p.subcategoria || ''} ${(p.palavrasChave||[]).join(' ')}`.toLowerCase();
        return tokens.every(token => target.includes(token));
      });
    };

    let result = debouncedQuery ? doSearch(debouncedQuery) : [...catalog];

    // 1. Categoria (Cumulativo)
    if (activeCategoria) {
      result = result.filter((p) => p.categoria === activeCategoria);
    }

    // 2. Marca (Cumulativo)
    if (activeMarca) {
      const q = activeMarca.toLowerCase();
      result = result.filter((p) => p.marca.toLowerCase().replace(/\s+/g, '-') === q);
    }

    // 3. Aplicação Inteligente (Cumulativo)
    // Considera: aplicacao, palavrasChave, nome e subcategoria
    if (activeAplicacao) {
      const q = activeAplicacao.toLowerCase();
      result = result.filter((p) => {
        const queryNorm = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const content = [
          ...p.aplicacao,
          ...(p.palavrasChave ?? []),
          p.nome,
          p.subcategoriaLabel ?? ''
        ].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        
        return content.includes(queryNorm);
      });
    }

    // 4. Tipo de Produto (Cumulativo)
    if (activeTipo) {
      const q = activeTipo.toLowerCase();
      result = result.filter((p) => {
        const nameAndSub = `${p.nome} ${p.subcategoriaLabel ?? ''}`.toLowerCase();
        return nameAndSub.includes(q);
      });
    }

    // Sort logic
    return result.sort((a, b) => {
      if (sortBy === 'name') return a.nome.localeCompare(b.nome);
      if (sortBy === 'stock') return b.quantidadeEstoque - a.quantidadeEstoque;
      // relevance = order defined in data
      return a.ordem - b.ordem;
    });
  }, [debouncedQuery, activeCategoria, activeMarca, activeAplicacao, activeTipo, sortBy, catalog]);

  const visibleProducts = React.useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );
  const hasMore = visibleCount < filteredProducts.length;
  const remainingCount = filteredProducts.length - visibleCount;

  // Reset pagination on any filter change
  React.useEffect(() => { 
    setVisibleCount(ITEMS_PER_PAGE); 
  }, [debouncedQuery, activeCategoria, activeMarca, activeAplicacao, activeTipo]);

  const handleCategoriaClick = React.useCallback((slug: string | null) => {
    setActiveCategoria(slug);
    navigate(slug ? `/produtos/categoria/${slug}` : '/produtos');
  }, [navigate]);

  const clearFilters = React.useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setActiveCategoria(null);
    setActiveMarca(null);
    setActiveAplicacao(null);
    setActiveTipo(null);
    navigate('/produtos');
  }, [navigate]);

  const handleLoadMore = React.useCallback(() => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  }, []);

  const activeCategoriaMeta = activeCategoria
    ? categorias.find((c) => c.slug === activeCategoria)
    : null;

  const hasActiveFilters = Boolean(activeCategoria || activeMarca || activeAplicacao || activeTipo || debouncedQuery);

  const APLICACOES = ['Laje', 'Parede', 'Telhado', 'Piscina', 'Fundação', 'Banheiro', 'Reservatório'];
  const TIPOS = ['Manta', 'Selante', 'Aditivo', 'Argamassa', 'Primer', 'Fita', 'Dreno', 'Maçarico'];

  return (
    <section className="py-12 md:py-16 bg-background-light min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <li><a href="/index.html" className="hover:text-primary transition-colors">Início</a></li>
            <li aria-hidden="true"><span className="material-symbols-outlined text-xs">chevron_right</span></li>
            {activeCategoria ? (
              <>
                <li>
                  <button onClick={() => handleCategoriaClick(null)} className="hover:text-primary transition-colors">
                    Produtos
                  </button>
                </li>
                <li aria-hidden="true"><span className="material-symbols-outlined text-xs">chevron_right</span></li>
                <li className="text-slate-900 font-bold">{activeCategoriaMeta?.nome}</li>
              </>
            ) : (
              <li className="text-slate-900 font-bold">Produtos</li>
            )}
          </ol>
        </nav>

        {/* Page header & Sort */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 uppercase leading-none mb-3">
              {activeCategoriaMeta?.nome ?? 'Nossos Produtos'}
            </h1>
            <p className="text-slate-500 text-lg font-medium max-w-2xl">
              {activeCategoriaMeta
                ? activeCategoriaMeta.descricao
                : 'Soluções completas em impermeabilização para todos os tipos de projeto.'}
            </p>
          </div>

          <div className="flex flex-col gap-2 min-w-[200px]">
            <label htmlFor="sort-select" className="text-xs font-black uppercase tracking-widest text-slate-400">
              Ordenar por
            </label>
            <div className="relative">
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-sm"
              >
                <option value="relevance">Relevância</option>
                <option value="name">Nome (A-Z)</option>
                <option value="stock">Disponibilidade</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true">
                unfold_more
              </span>
            </div>
          </div>
        </div>

        {/* ── Search & Filters ── */}
        <div className="mb-8 space-y-5">
          {/* Search */}
          <div className="relative max-w-md">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl" aria-hidden="true">search</span>
            <input
              id="product-search"
              type="search"
              placeholder="Buscar produto, marca ou código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="catalog-search-input w-full pl-12 pr-10 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all shadow-sm"
              aria-label="Buscar produtos"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Limpar busca"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            )}
          </div>

          {/* Category chips — Horizontal scroll on mobile */}
          <div
            className="flex flex-nowrap md:flex-wrap gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0"
            role="group"
            aria-label="Filtrar por categoria"
          >
            <button
              onClick={() => handleCategoriaClick(null)}
              className={`filter-chip flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${
                !activeCategoria
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-primary/50 hover:text-primary'
              }`}
            >
              Todos ({products.length})
            </button>
            {categorias.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => handleCategoriaClick(cat.slug === activeCategoria ? null : cat.slug)}
                className={`filter-chip flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${
                  activeCategoria === cat.slug
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-primary/50 hover:text-primary'
                }`}
              >
                {cat.nome} ({cat.count})
              </button>
            ))}
          </div>

          {/* Brand chips — Horizontal scroll on mobile */}
          <div
            className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0"
            role="group"
            aria-label="Filtrar por marca"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1 flex-shrink-0">Marca:</span>
            <button
              onClick={() => setActiveMarca(null)}
              className={`filter-chip flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
                !activeMarca
                  ? 'bg-secondary text-slate-900 shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-secondary/50 hover:text-slate-700'
              }`}
            >
              Todas
            </button>
            {marcas.slice(0, 10).map((m) => (
              <button
                key={m.slug}
                onClick={() => setActiveMarca(m.slug === activeMarca ? null : m.slug)}
                className={`filter-chip flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
                  activeMarca === m.slug
                    ? 'bg-secondary text-slate-900 shadow-sm'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-secondary/50 hover:text-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Application chips */}
          <div
            className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0"
            role="group"
            aria-label="Filtrar por aplicação"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1 flex-shrink-0">Aplicação:</span>
            {APLICACOES.map((app) => (
              <button
                key={app}
                onClick={() => setActiveAplicacao(app === activeAplicacao ? null : app)}
                className={`filter-chip flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                  activeAplicacao === app
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400 hover:text-slate-700'
                }`}
              >
                {app}
              </button>
            ))}
          </div>

          {/* Type chips */}
          <div
            className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0"
            role="group"
            aria-label="Filtrar por tipo"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1 flex-shrink-0">Tipo:</span>
            {TIPOS.map((tipo) => (
              <button
                key={tipo}
                onClick={() => setActiveTipo(tipo === activeTipo ? null : tipo)}
                className={`filter-chip flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                  activeTipo === tipo
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400 hover:text-slate-700'
                }`}
              >
                {tipo}
              </button>
            ))}
          </div>

          {/* Active filter summary */}
          {hasActiveFilters && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-500 font-medium">
                {filteredProducts.length}{' '}
                {filteredProducts.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
              </span>
              <button
                onClick={clearFilters}
                className="text-primary font-bold hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* ── Grid — renders only `visibleProducts` ── */}
        {visibleProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              <React.Suspense fallback={
                <>{Array.from({ length: Math.min(visibleProducts.length, 6) }, (_, i) => <CardSkeleton key={i} />)}</>
              }>
                {visibleProducts.map((p) => (
                  <ProductCard 
                    key={p.slug} 
                    product={p} 
                    onClick={(slug) => navigate(`/produto/${slug}`)}
                  />
                ))}
              </React.Suspense>
            </div>

            {/* Strategic CTA — Captured Lead */}
            <div className="mt-12 mb-8 bg-slate-50 border border-slate-200 rounded-3xl p-8 sm:p-10 text-center max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
              <div className="text-left">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">live_help</span>
                  Não encontrou o que precisa?
                </h3>
                <p className="text-slate-600 font-bold text-sm leading-relaxed max-w-md">
                  Temos acesso a centenas de outros produtos e soluções técnicas. Fale com um especialista e receba orientação rápida.
                </p>
              </div>
              <a
                href={`https://wa.me/5581998008818?text=${encodeURIComponent('Olá! Estou no site e gostaria de ajuda para escolher o produto ideal.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-3"
              >
                <img src="/Logos/WhatsApp-48w.webp" alt="" className="w-5 h-5" />
                Falar com Especialista
              </a>
            </div>

            {hasMore && (
              <div className="text-center mt-12">
                <button
                  onClick={handleLoadMore}
                  id="load-more-products"
                  className="inline-flex items-center gap-3 bg-white border-2 border-slate-200 hover:border-primary text-slate-700 hover:text-primary px-8 py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">expand_more</span>
                  Ver mais produtos
                  <span className="text-slate-400 font-medium normal-case">
                    ({remainingCount} restantes)
                  </span>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-100 shadow-sm mx-auto max-w-2xl px-6">
            <span className="material-symbols-outlined text-7xl text-slate-200 mb-6 block" aria-hidden="true">search_off</span>
            <h2 className="text-2xl font-black text-slate-800 mb-4">Nenhum produto encontrado</h2>
            <p className="text-slate-500 font-medium mb-10 text-lg leading-relaxed">
              Não encontramos produtos para sua combinação de filtros. Mas temos acesso a todo o mercado de impermeabilização!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={clearFilters}
                className="bg-slate-100 text-slate-600 px-8 py-4 rounded-xl font-black uppercase tracking-wider hover:bg-slate-200 transition-all"
              >
                Limpar filtros
              </button>
              <a
                href={`https://wa.me/5581998008818?text=${encodeURIComponent('Olá! Não encontrei o produto que procurava no catálogo. Pode me ajudar?')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 text-white px-8 py-4 rounded-xl font-black uppercase tracking-wider hover:brightness-110 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
              >
                <img src="/Logos/WhatsApp-48w.webp" alt="" className="w-6 h-6" />
                Falar com Especialista
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default CatalogGrid;
