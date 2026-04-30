import React from 'react';
import { cn } from '@/lib/utils';

interface WhatsAppFloatingProps {
  className?: string;
}

export const WhatsAppFloating: React.FC<WhatsAppFloatingProps> = ({ className }) => {
  const WHATSAPP_NUMBER = '5581998008818';
  const message = encodeURIComponent('Olá! Estou no site e gostaria de ajuda para escolher o produto ideal.');
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;

  return (
    <>
      {/* ESPAÇAMENTO GLOBAL MOBILE (Evita que o footer esconda conteúdo útil) */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 639px) {
          body { padding-bottom: 80px; }
        }
      `}} />

      {/* 
        NOVA UX MOBILE: Sticky Bar de Largura Total (Conversão Máxima)
        DESKTOP: Float Button clássico no canto inferior direito
      */}
      <div className={cn(
        "fixed z-[9999] transition-all",
        "bottom-0 left-0 w-full sm:w-auto sm:bottom-6 sm:right-6 sm:left-auto",
        className
      )}>
        {/* Backdrop container (somente mobile) */}
        <div className="sm:hidden absolute inset-0 bg-white/80 backdrop-blur-md border-t border-slate-200/50 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]" />

        <div className="relative p-3 sm:p-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-track="true"
            data-type="whatsapp_click"
            data-name="Sticky CTA Global"
            className={cn(
              "relative flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#128C7E] text-white transition-all duration-300",
              "w-full h-[52px] rounded-xl shadow-[0_4px_14px_0_rgba(37,211,102,0.39)] hover:shadow-[0_6px_20px_rgba(37,211,102,0.23)] active:scale-[0.98]", // Mobile styles
              "sm:w-auto sm:h-auto sm:p-3 sm:px-6 sm:rounded-full sm:shadow-[0_8px_32px_rgba(37,211,102,0.45)] sm:hover:shadow-[0_12px_40px_rgba(37,211,102,0.6)] sm:hover:scale-[1.06] sm:active:scale-[0.96]" // Desktop styles
            )}
            aria-label="Receber Orçamento no WhatsApp"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7 fill-current drop-shadow-sm flex-shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span className="text-[13px] sm:text-[11px] font-black uppercase tracking-widest whitespace-nowrap drop-shadow-sm pr-1">
              <span className="sm:hidden">Receber Orçamento no WhatsApp</span>
              <span className="hidden sm:inline">Falar com especialista</span>
            </span>
          </a>
        </div>
      </div>
    </>
  );
};
