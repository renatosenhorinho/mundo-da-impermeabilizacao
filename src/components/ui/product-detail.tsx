import React from 'react';
import {
  getProductBySlug,
  getRelatedProducts,
  getVariacoes,
  buildWhatsAppUrl,
  WHATSAPP_NUMBER,
  products,
  catalogStore,
} from '@/data/products';
import { useParams, useNavigate } from 'react-router-dom';

const ProductCard = React.lazy(() => import('./product-card'));

const RelatedSkeleton = () => (
  <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-100">
    <div className="bg-slate-200 animate-pulse" style={{ aspectRatio: '4 / 3' }} />
    <div className="p-5 space-y-3">
      <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
      <div className="h-5 w-3/4 bg-slate-200 rounded animate-pulse" />
      <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
    </div>
  </div>
);

const ProductCarousel: React.FC<{
  imagens: string[];
  nome: string;
  marca: string;
  destaque: boolean;
}> = ({ imagens, nome, marca, destaque }) => {
  const [active, setActive] = React.useState(0);
  const [localErrors, setLocalErrors] = React.useState<Record<number, boolean>>({});
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scrollTo = (index: number) => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.offsetWidth * index;
      scrollRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
      setActive(index);
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const index = Math.round(
        scrollRef.current.scrollLeft / scrollRef.current.offsetWidth
      );
      if (index !== active) setActive(index);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="relative group rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-2xl"
        style={{ aspectRatio: '1 / 1' }}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-thin h-full no-scrollbar"
        >
          {imagens.map((src, i) => {
            const hasError = localErrors[i];
            const displaySrc = hasError ? '/images/products/placeholder.webp' : src;
            const isPlaceholder = displaySrc.includes('placeholder');
            
            return (
              <div key={i} className="flex-shrink-0 w-full h-full snap-center">
                <img
                  src={displaySrc}
                  srcSet={undefined}
                  sizes="(max-width: 1024px) 95vw, 50vw"
                  alt={`${nome} - Vista ${i + 1}`}
                  width={600}
                  height={600}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  // @ts-ignore
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  onError={() => {
                    if (!hasError) setLocalErrors(prev => ({ ...prev, [i]: true }));
                  }}
                  className="w-full h-full object-contain select-none"
                />
              </div>
            );
          })}
        </div>

        {/* Badges */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <span className="bg-white/95 backdrop-blur-sm text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-700 px-3 py-1.5 rounded-lg shadow-md self-start">
            {marca}
          </span>
          {destaque && (
            <span className="bg-secondary text-slate-900 text-[10px] sm:text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-md self-start">
              Destaque
            </span>
          )}
        </div>

        {/* Desktop Controls */}
        {imagens.length > 1 && (
          <>
            <button
              onClick={() => scrollTo(active - 1)}
              disabled={active === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl hover:bg-primary hover:text-white disabled:opacity-0 transition-all opacity-0 group-hover:opacity-100 hidden sm:flex z-20"
              aria-label="Imagem anterior"
            >
              <span className="material-symbols-outlined text-3xl">chevron_left</span>
            </button>
            <button
              onClick={() => scrollTo(active + 1)}
              disabled={active === imagens.length - 1}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl hover:bg-primary hover:text-white disabled:opacity-0 transition-all opacity-0 group-hover:opacity-100 hidden sm:flex z-20"
              aria-label="Próxima imagem"
            >
              <span className="material-symbols-outlined text-3xl">chevron_right</span>
            </button>
          </>
        )}
        
        {/* Simple Progress Bar on Mobile */}
        {imagens.length > 1 && (
          <div className="absolute bottom-4 left-4 right-4 h-1 bg-black/10 rounded-full overflow-hidden sm:hidden z-10">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((active + 1) / imagens.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Thumbnails (Only if 3+ images) */}
      {imagens.length >= 3 && (
        <div className="flex gap-3 overflow-x-auto py-1 scrollbar-hide px-0.5 no-scrollbar">
          {imagens.map((src, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 overflow-hidden transition-all shadow-sm ${
                i === active
                  ? 'border-primary ring-4 ring-primary/10 scale-95 shadow-md'
                  : 'border-slate-100 grayscale hover:grayscale-0'
              }`}
            >
              <img src={src} alt="" className="w-full h-full object-contain" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* Dots (If 2 images) */}
      {imagens.length === 2 && (
        <div className="flex justify-center gap-3 py-2">
          {imagens.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`h-2.5 rounded-full transition-all duration-500 ${
                i === active ? 'w-8 bg-primary shadow-lg shadow-primary/20' : 'w-2.5 bg-slate-200'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const catalog = React.useSyncExternalStore(catalogStore.subscribe, catalogStore.getSnapshot);

  const product = React.useMemo(() => {
    return catalog.find(p => p.slug === slug);
  }, [slug, catalog]);

  const related = React.useMemo(() => (product ? getRelatedProducts(product, 3) : []), [product]);
  const variacoes = React.useMemo(() => (product ? getVariacoes(product) : []), [product]);

  // Dynamic SEO
  React.useEffect(() => {
    if (product) {
      document.title = `${product.nome} | Mundo da Impermeabilização`;
      const description = product.resumo || `Confira ${product.nome} na Mundo da Impermeabilização. Soluções de alta performance para sua obra.`;
      document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    } else {
      document.title = 'Produto não encontrado | Mundo da Impermeabilização';
    }
  }, [product]);

  // Scroll para o topo ao abrir o produto
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // 404
  if (!product) {
    return (
      <section className="py-20 bg-background-light min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="material-symbols-outlined text-7xl text-slate-300 mb-6 block" aria-hidden="true">error_outline</span>
          <h1 className="text-3xl font-black text-slate-800 mb-3">Produto não encontrado</h1>
          <p className="text-slate-500 font-medium mb-8 max-w-md mx-auto">
            O produto que você está procurando não existe ou foi removido do catálogo.
          </p>
          <button
            onClick={() => navigate('/produtos')}
            className="bg-primary text-white px-8 py-4 rounded-xl font-black uppercase tracking-wider hover:brightness-110 transition-all shadow-lg inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            Voltar ao catálogo
          </button>
        </div>
      </section>
    );
  }

  const whatsappUrl = buildWhatsAppUrl(product);



  return (
    <section className="py-12 md:py-16 bg-background-light min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Breadcrumb & Voltar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm text-slate-500 font-medium flex-wrap">
              <li><a href="/index.html" className="hover:text-primary transition-colors">Início</a></li>
              <li aria-hidden="true"><span className="material-symbols-outlined text-xs">chevron_right</span></li>
              <li>
                <button onClick={() => navigate('/produtos')} className="hover:text-primary transition-colors">Produtos</button>
              </li>
              <li aria-hidden="true"><span className="material-symbols-outlined text-xs">chevron_right</span></li>
              <li>
                <button onClick={() => navigate(`/produtos/categoria/${product.categoria}`)} className="hover:text-primary transition-colors">
                  {product.categoriaLabel}
                </button>
              </li>
              {product.subcategoriaLabel && (
                <>
                  <li aria-hidden="true"><span className="material-symbols-outlined text-xs">chevron_right</span></li>
                  <li className="text-slate-600">{product.subcategoriaLabel}</li>
                </>
              )}
            </ol>
          </nav>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-primary font-bold text-sm transition-colors group"
          >
            <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform" aria-hidden="true">
              arrow_back
            </span>
            Voltar
          </button>
        </div>

        {/* ── Main layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 mb-16">

          {/* Image / Carousel */}
          <div>
            <div className="sticky top-24">
              <ProductCarousel 
                imagens={product.imagens && product.imagens.length > 0 ? product.imagens : (product.imagem ? [product.imagem] : ['/images/products/placeholder.webp'])}
                nome={product.nome}
                marca={product.marca}
                destaque={product.destaque}
              />
            </div>
          </div>

          {/* Info panel */}
          <div>
            {/* Category / Subcategory */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button
                onClick={() => navigate(`/produtos/categoria/${product.categoria}`)}
                className="text-primary text-xs font-black uppercase tracking-[0.2em] hover:underline"
              >
                {product.categoriaLabel}
              </button>
              {product.subcategoriaLabel && (
                <>
                  <span className="text-slate-300 text-xs">›</span>
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">{product.subcategoriaLabel}</span>
                </>
              )}
            </div>

            {/* Nome */}
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight mb-1">
              {product.nome}
            </h1>

            {/* Nome original */}
            <p className="text-slate-400 text-sm italic mb-4">{product.nomeOriginal}</p>

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 mb-6 text-sm">
              <p className="text-slate-500 font-bold uppercase tracking-wider">
                Marca: <span className="text-slate-800">{product.marca}</span>
              </p>
              <p className="text-slate-500 font-bold uppercase tracking-wider">
                Cód: <span className="text-slate-800 font-mono">{product.codigo}</span>
              </p>
            </div>

            {/* Badges: embalagem / unidade / estoque */}
            <div className="flex flex-wrap gap-2 mb-8">
              <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm text-slate-500" aria-hidden="true">package_2</span>
                {product.embalagem}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm text-slate-500" aria-hidden="true">straighten</span>
                Und: {product.unidade}
              </span>
              {product.quantidadeEstoque > 0 ? (
                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">check_circle</span>
                  Em estoque
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">schedule</span>
                  Consultar prazo
                </span>
              )}
            </div>

            {/* Para que serve */}
            {product.resumo && (
              <div className="mb-10 p-6 bg-slate-50 rounded-2xl border-l-4 border-l-primary shadow-sm">
                <h2 className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">info</span>
                  Para que serve
                </h2>
                <p className="text-slate-700 font-semibold leading-relaxed text-lg italic">
                  "{product.resumo}"
                </p>
              </div>
            )}

            {/* Indicado para */}
            {product.aplicacao.length > 0 && (
              <div className="mb-10">
                <h2 className="text-base font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400">target</span>
                  Indicado para:
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {product.aplicacao.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <span className="material-symbols-outlined text-primary text-lg" aria-hidden="true">
                        check_circle
                      </span>
                      <span className="text-slate-700 font-bold text-sm leading-tight">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Como Usar */}
            {product.comoUsar.length > 0 && (
              <div className="mb-10">
                <h2 className="text-base font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400">format_list_numbered</span>
                  Como usar:
                </h2>
                <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  {product.comoUsar.map((step, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center mt-0.5 shadow-md">
                        {i + 1}
                      </span>
                      <span className="text-slate-600 font-bold text-sm leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Especificações */}
            {product.especificacoes && Object.keys(product.especificacoes).length > 0 && (
              <div className="mb-8">
                <h2 className="text-base font-black text-slate-900 uppercase tracking-wider mb-3">
                  Especificações Técnicas
                </h2>
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                  <table className="w-full" role="table">
                    <tbody>
                      {Object.entries(product.especificacoes).map(([key, value], i) => (
                        <tr key={key} className={i % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}>
                          <td className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-2/5 border-r border-slate-100">
                            {key}
                          </td>
                          <td className="px-5 py-3 text-sm font-medium text-slate-800">
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Variações (mesma parentId) ── */}
            {variacoes.length > 0 && (
              <div className="mb-8">
                <h2 className="text-base font-black text-slate-900 uppercase tracking-wider mb-3">
                  Outras Variações
                </h2>
                <div className="flex flex-wrap gap-2">
                  {/* Chip do produto atual — destacado */}
                  <span
                    className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold"
                    aria-current="true"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">done</span>
                    {product.embalagem}
                  </span>
                  {/* Chips das variações irmãs */}
                  {variacoes
                    .filter(v => v && v.slug && v.slug !== product.slug)
                    .map((v) => (
                    <button
                      key={v.slug}
                      onClick={() => navigate(`/produto/${v.slug}`)}
                      className="inline-flex items-center gap-2 bg-white border-2 border-slate-200 hover:border-primary text-slate-700 hover:text-primary px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer hover:shadow-md"
                    >
                      {v.embalagem}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Por que escolher este produto? ── */}
            <div className="mb-8 p-6 sm:p-8 bg-slate-50 rounded-3xl border border-slate-200">
              {/* Dor do Cliente */}
              <div className="mb-8 p-4 bg-red-50 rounded-2xl border-l-4 border-red-500 flex items-start gap-3">
                <span className="material-symbols-outlined text-red-500 text-xl flex-shrink-0" aria-hidden="true">warning</span>
                <p className="text-red-900/90 font-bold text-sm leading-relaxed">
                  Infiltrações e vazamentos podem causar danos estruturais graves e altos custos de reparo se não forem resolvidos com o produto correto.
                </p>
              </div>

              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl" aria-hidden="true">verified</span>
                Por que escolher este produto?
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-500 mt-0.5" aria-hidden="true">check_circle</span>
                  <div>
                    <strong className="block text-slate-800 font-bold">Solução Definitiva</strong>
                    <span className="text-slate-600 text-sm">Resolve problemas de impermeabilização na raiz, evitando retrabalho.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-500 mt-0.5" aria-hidden="true">check_circle</span>
                  <div>
                    <strong className="block text-slate-800 font-bold">Alta Durabilidade</strong>
                    <span className="text-slate-600 text-sm">Resistência excepcional contra o tempo e intempéries para proteger a estrutura.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-500 mt-0.5" aria-hidden="true">check_circle</span>
                  <div>
                    <strong className="block text-slate-800 font-bold">Segurança Comprovada</strong>
                    <span className="text-slate-600 text-sm">Qualidade normatizada e garantida pelas melhores marcas do mercado.</span>
                  </div>
                </li>
              </ul>

              {/* Seção de Confiança */}
              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-secondary text-2xl" aria-hidden="true">workspace_premium</span>
                </div>
                <div>
                  <p className="text-slate-800 font-black text-sm uppercase tracking-wider mb-0.5">Mundo da Impermeabilização</p>
                  <p className="text-slate-500 text-sm font-medium">Mais de 20 anos fornecendo soluções em impermeabilização no Nordeste.</p>
                </div>
              </div>
            </div>

            {/* ── Actions ── */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 sm:relative sm:bg-transparent sm:backdrop-blur-none sm:p-0 sm:border-0 sm:mt-12 sm:z-40">
              <p className="hidden sm:flex text-slate-500 text-xs font-bold uppercase tracking-wider mb-3 ml-1 items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary animate-pulse">support_agent</span>
                Fale agora com um especialista e receba orientação rápida para sua aplicação.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 max-w-7xl mx-auto">
                {/* Cotar via WhatsApp */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white px-4 sm:px-8 py-3.5 sm:py-5 rounded-xl sm:rounded-2xl font-black text-base sm:text-lg uppercase tracking-wider shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_15px_40px_rgba(16,185,129,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 sm:gap-4 group w-full"
                  id="product-cta-whatsapp"
                  data-track="true"
                  data-type="whatsapp_click"
                >
                  <img
                    src="/Logos/WhatsApp-48w.webp"
                    alt=""
                    width={28}
                    height={28}
                    loading="lazy"
                    decoding="async"
                    className="w-6 h-6 sm:w-8 sm:h-8 object-contain group-hover:rotate-12 transition-transform"
                    aria-hidden="true"
                  />
                  Receber Orçamento Agora
                </a>

                {/* Ficha Técnica — ONLY here, never auto-loads PDF */}
                {product.fichaTecnica && (
                  <a
                    href={product.fichaTecnica}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:inline-flex flex-1 border-2 border-slate-200 hover:border-primary text-slate-700 hover:text-primary px-6 py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:shadow-md items-center justify-center gap-3"
                    id="product-datasheet-btn"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">description</span>
                    Ficha Técnica (PDF)
                  </a>
                )}
              </div>
              
              {/* Urgency text */}
              <div className="mt-2 sm:mt-4 text-center max-w-7xl mx-auto">
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">bolt</span>
                  Orçamento sem compromisso • Atendimento rápido
                </p>
              </div>
            </div>
        </div>
      </div>

        {/* ── Related Products ── */}
        {related.length > 0 && (
          <div className="border-t border-slate-200 pt-12">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase mb-8">
              Produtos Relacionados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <React.Suspense fallback={<>{related.map((_, i) => <RelatedSkeleton key={i} />)}</>}>
                {related.map((rp) => <ProductCard key={rp.slug} product={rp} onClick={(slug) => navigate(`/produto/${slug}`)} />)}
              </React.Suspense>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductDetail;
