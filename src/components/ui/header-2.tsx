'use client';
import React from 'react';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { WhatsAppFloating } from './whatsapp-floating';
import { useScroll } from './use-scroll';
import { WHATSAPP_NUMBER } from '@/config/constants';

// Inline SVG X icon to avoid pulling lucide-react into the header bundle
const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
);

// Lazy-load motion components — only fetched when mobile menu opens
const LazyMotionDiv = React.lazy(() =>
    import('framer-motion').then(mod => ({ default: mod.motion.div }))
);
const LazyAnimatePresence = React.lazy(() =>
    import('framer-motion').then(mod => ({ default: mod.AnimatePresence }))
);

export function Header() {
    const [open, setOpen] = React.useState(false);
    // Track if menu was ever opened to trigger the lazy load
    const [hasOpened, setHasOpened] = React.useState(false);
    const scrolled = useScroll(20);

    const links = [
        { label: "Início", href: "/index.html" },
        { label: "Produtos", href: "/produtos" },
        { label: "Quem Somos", href: "/quem-somos.html" },
        { label: "Contato", href: "/contato.html" }
    ];

    const handleToggle = () => {
        if (!open && !hasOpened) setHasOpened(true);
        setOpen(!open);
    };

    React.useEffect(() => {
        const style = open ? 'hidden' : '';
        const rafId = requestAnimationFrame(() => {
            document.body.style.overflow = style;
        });
        return () => {
            cancelAnimationFrame(rafId);
            document.body.style.overflow = '';
        };
    }, [open]);

    return (
        <>
            <header
                className="fixed top-0 left-0 right-0 z-[100] w-full transition-all duration-300"
                style={{
                    backgroundColor: open
                        ? 'rgba(16, 25, 34, 0.98)'
                        : scrolled
                            ? 'rgba(16, 25, 34, 0.97)'
                            : 'rgba(16, 25, 34, 0.92)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderBottom: scrolled || open ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                    boxShadow: scrolled || open ? '0 4px 24px rgba(0,0,0,0.35)' : 'none',
                }}
            >
                <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-[68px] items-center justify-between">

                    {/* Logo */}
                    <a href="/index.html" className="shrink-0" aria-label="Mundo da Impermeabilização - Página Inicial">
                        <img
                            src="/Logos/logo-main-180w.webp"
                            srcSet="/Logos/logo-main-180w.webp 180w, /Logos/logo-main-360w.webp 360w"
                            sizes="(max-width: 768px) 160px, 160px"
                            alt="Mundo da Impermeabilização Logo"
                            width="160"
                            height="64"
                            fetchPriority="high"
                            className="h-14 w-auto object-contain"
                        />
                    </a>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-1">
                        {links.map((link, i) => (
                            <a
                                key={i}
                                href={link.href}
                                className="px-4 py-2 font-bold text-sm uppercase tracking-wider text-white/85 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
                            >
                                {link.label}
                            </a>
                        ))}

                        <a
                            href={`https://wa.me/${WHATSAPP_NUMBER}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-5 px-6 py-2.5 bg-secondary text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl shadow-[0_4px_16px_rgba(251,191,36,0.35)] hover:shadow-[0_6px_20px_rgba(251,191,36,0.5)] hover:brightness-110 hover:scale-[1.04] active:scale-[0.97] transition-all duration-200"
                        >
                            Orçamento
                        </a>
                    </div>

                    {/* Mobile Button */}
                    <button
                        onClick={handleToggle}
                        className="md:hidden h-9 w-9 flex items-center justify-center text-white"
                        aria-label={open ? "Fechar menu" : "Abrir menu"}
                    >
                        <MenuToggleIcon open={open} className="size-6" duration={300} />
                    </button>
                </nav>
            </header>

            {/* Mobile Overlay — lazy loaded, only rendered after first open */}
            {hasOpened && (
                <React.Suspense fallback={null}>
                    <LazyAnimatePresence>
                        {open && (
                            <>
                                {/* Backdrop Dimmer */}
                                <LazyMotionDiv
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setOpen(false)}
                                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9990] md:hidden"
                                />

                                {/* Side Drawer */}
                                <LazyMotionDiv
                                    initial={{ opacity: 0, x: '100%' }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: '100%' }}
                                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                    className="fixed inset-y-0 right-0 w-[300px] md:hidden flex flex-col pt-24 z-[9991]"
                                    style={{
                                        backgroundColor: '#0a1018',
                                        boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
                                        borderLeft: '1px solid rgba(255,255,255,0.05)'
                                    }}
                                >
                                    {/* Close Button Inside Drawer */}
                                    <button
                                        onClick={() => setOpen(false)}
                                        className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                                        aria-label="Fechar menu"
                                    >
                                        <XIcon />
                                    </button>

                                    <div className="flex flex-col p-8 gap-1">
                                        {links.map((link) => (
                                            <a
                                                key={link.label}
                                                href={link.href}
                                                className="text-2xl font-black uppercase tracking-tight text-white hover:text-secondary transition-colors py-5 border-b border-white/5 last:border-0"
                                                onClick={() => setOpen(false)}
                                            >
                                                {link.label}
                                            </a>
                                        ))}

                                        <a
                                            href={`https://wa.me/${WHATSAPP_NUMBER}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-8 py-5 bg-secondary text-slate-900 rounded-xl font-black text-center text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-xl"
                                            onClick={() => setOpen(false)}
                                        >
                                            Solicitar Orçamento
                                        </a>

                                        <p className="mt-auto text-[10px] text-white/20 uppercase font-bold tracking-[0.2em] text-center">
                                            Mundo da Impermeabilização
                                        </p>
                                    </div>
                                </LazyMotionDiv>
                            </>
                        )}
                    </LazyAnimatePresence>
                </React.Suspense>
            )}
            
            {/* Global WhatsApp CTA */}
            <WhatsAppFloating />
        </>
    );
}

