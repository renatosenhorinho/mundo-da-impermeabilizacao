import React, { useMemo, useSyncExternalStore } from 'react';
import ProductCard from './product-card';
import { catalogStore } from '@/data/products';
import { useNavigate } from 'react-router-dom';
import { MAX_DESTAQUE } from '@/config/constants';

const FeaturedProducts: React.FC = () => {
  const navigate = useNavigate();
  const catalog = useSyncExternalStore(catalogStore.subscribe, catalogStore.getSnapshot);

  // Pegar até MAX_DESTAQUE produtos em destaque ou preencher inteligentemente
  const featuredProducts = useMemo(() => {
    // Tenta pegar destaques que têm imagem e estão ativos
    let selected = catalog.filter(p => p.destaque && p.imagem && p.ativo !== false);
    
    // 🧠 Ordenação Inteligente de Destaques
    // Prioriza score (se existir futuramente) > ordem manual > ordem alfabética (fallback)
    const smartSort = (a: any, b: any) => {
      const scoreA = a.score || a.lead_score || 0;
      const scoreB = b.score || b.lead_score || 0;
      if (scoreA !== scoreB) return scoreB - scoreA; // 1º: Produtos com maior score sobem
      if (a.ordem !== b.ordem) return (a.ordem || 99) - (b.ordem || 99); // 2º: Ordem manual
      return a.nome.localeCompare(b.nome); // 3º: Fallback
    };
    
    selected.sort(smartSort);

    // 🛡️ Proteção de Vitrine Vazia
    // Se não preencheu o limite, busca os mais fortes/recentes do catálogo
    if (selected.length < MAX_DESTAQUE) {
      let others = catalog.filter(p => !p.destaque && p.imagem && p.ativo !== false);
      
      // Mantém fallback inteligente: quem vende/clica mais aparece pra tampar o buraco
      others.sort(smartSort);
      
      selected = [...selected, ...others].slice(0, MAX_DESTAQUE);
    }
    
    return selected.slice(0, MAX_DESTAQUE); // Garante o limite exato
  }, [catalog]);

  return (
    <section className="py-24 bg-background-light relative z-20" id="featured-products">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Cabeçalho da Seção */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tight mb-4">
            Produtos que <span className="text-primary blue-underline">Trabalhamos</span>
          </h2>
          <p className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto">
            Soluções completas em impermeabilização com as melhores marcas do mercado.
          </p>
        </div>

        {/* Grid de Produtos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-12">
          {featuredProducts.map((product) => (
            <ProductCard key={product.slug} product={product} onClick={(slug) => navigate(`/produto/${slug}`)} />
          ))}
        </div>

        {/* CTA Final */}
        <div className="text-center">
          <a
            href="/produtos"
            className="inline-flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/90 text-slate-900 px-8 py-4 rounded-lg font-black text-lg uppercase tracking-wider shadow-lg hover:shadow-xl transition-all scale-100 hover:scale-105"
          >
            Ver todos os produtos
            <span className="material-symbols-outlined font-black" aria-hidden="true">arrow_forward</span>
          </a>
        </div>

      </div>
    </section>
  );
};

export default FeaturedProducts;
