import React, { memo } from 'react';
import { Award, ShieldCheck, CheckCircle2, TrendingUp } from "lucide-react";
import { type Product } from '@/data/products';

export interface ProductCardProps {
  product: Product;
  onClick: (slug: string) => void;
  priority?: boolean;
}

export const ProductCard = memo(function ProductCard({ product, onClick, priority = false }: ProductCardProps) {
  // Array rotativo de urgência pseudo-aleatório baseado no ID do produto
  const urgencyTags = [
    "🔥 Alta procura hoje",
    "⚡ Um dos mais solicitados",
    "📈 Produto popular",
    "🎯 Estoque atualizado",
    "🌟 Mais vendido da semana"
  ];
  
  // Hash simples para sempre mostrar a mesma tag para o mesmo produto
  const hash = product.nome.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const urgencyTag = urgencyTags[hash % urgencyTags.length];

  // Número simulado de clientes atendidos
  const clientsCount = 50 + (hash % 200);

  return (
    <div 
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white shadow-md hover:shadow-2xl transition-all duration-300 border border-slate-100/60 hover:-translate-y-1 cursor-pointer w-full"
      onClick={() => onClick(product.slug)}
      data-track="true"
      data-type="product_click"
      data-name={product.nome}
    >
      {/* Container da Imagem (Proporção Controlada e Foco Visual) */}
      <div className="relative aspect-[4/3] sm:aspect-square w-full overflow-hidden bg-white p-6 sm:p-4 pb-2">
        <div className="relative h-full w-full mix-blend-multiply">
          <img
            src={product.imagem}
            alt={product.nome}
            loading={priority ? "eager" : "lazy"}
            className="absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/products/placeholder.webp';
            }}
          />
        </div>
      </div>

      <div className="flex flex-col flex-1 p-5 sm:p-5 pt-3">
        {/* Marca & Destaque (Estilo Marketplace) */}
        <div className="mb-2 flex items-center justify-between text-[11px] font-bold tracking-wider text-slate-400">
          <span className="uppercase text-emerald-700/70 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-100">
            {product.marca || 'GENÉRICO'}
          </span>
          {product.destaque && (
            <span className="text-amber-500 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              TOP VENDAS
            </span>
          )}
        </div>

        {/* Nome do Produto */}
        <h3 className="mb-2 line-clamp-2 text-base sm:text-lg font-bold leading-tight text-slate-800 group-hover:text-emerald-700 transition-colors">
          {product.nome}
        </h3>

        {/* Resumo/Benefício Direto */}
        <p className="mb-3 line-clamp-2 text-xs sm:text-sm text-slate-500 flex-1">
          {product.resumo || 'Excelente solução para sua obra. Produto com garantia e durabilidade comprovada.'}
        </p>

        {/* Prova Social */}
        <div className="mb-4 space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-600">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>+{clientsCount} clientes já compraram</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Qualidade e rendimento garantidos</span>
          </div>
        </div>

        {/* Linha de Urgência */}
        <div className="mb-3 flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-1.5 rounded-lg border border-rose-100">
          <TrendingUp className="w-3.5 h-3.5" />
          {urgencyTag}
        </div>

        {/* Action Button (Conversão Extrema) */}
        <div className="mt-auto">
          <a
            href={`https://wa.me/556199650059?text=Olá,%20gostaria%20de%20falar%20com%20um%20especialista%20sobre%20o%20produto:%20${encodeURIComponent(product.nome)}.`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
            }}
            data-track="true"
            data-type="whatsapp_click"
            data-name={product.slug}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-[0_4px_14px_0_rgba(37,211,102,0.39)] transition-all hover:bg-[#128C7E] hover:shadow-[0_6px_20px_rgba(37,211,102,0.23)] hover:-translate-y-0.5 active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span className="tracking-wide">FALAR COM ESPECIALISTA</span>
          </a>

          {/* Redução de Risco & Humano */}
          <div className="text-center mt-2 mb-3">
            <p className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[12px]" aria-hidden="true">check</span>
              Atendimento rápido • Sem compromisso
            </p>
          </div>

          {/* Ação Secundária: Detalhes */}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick(product.slug);
            }}
            className="w-full bg-transparent border border-slate-200 hover:border-primary hover:bg-slate-50 text-slate-500 hover:text-primary px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
          >
            Ver Detalhes do Produto
          </button>
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
