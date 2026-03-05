'use client';
import React from 'react';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export function Header() {
    const [open, setOpen] = React.useState(false);

    const links = [
        { label: "Início", href: "/index.html" },
        { label: "Quem Somos", href: "/quem-somos.html" },
        { label: "Contato", href: "/contato.html" }
    ];

    React.useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    return (
        <>
            <header className={cn(
                "fixed top-0 left-0 right-0 z-[100] w-full transition-all duration-300",
                open ? "bg-background-dark/95 backdrop-blur-md border-b border-white/10" : "bg-transparent backdrop-blur-sm"
            )}>
                <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">

                    {/* Logo */}
                    <a href="/index.html" className="shrink-0">
                        <img
                            src="/Logos/logo-main.webp"
                            alt="Mundo da Impermeabilização Logo"
                            width="160"
                            height="64"
                            className="h-16 w-auto object-contain"
                        />
                    </a>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-1">
                        {links.map((link, i) => (
                            <a
                                key={i}
                                href={link.href}
                                className="px-4 py-1.5 font-bold text-sm uppercase tracking-wider text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                            >
                                {link.label}
                            </a>
                        ))}

                        <a
                            href="https://wa.me/5581998008818"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-4 px-5 py-2 bg-secondary text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-secondary/30 hover:brightness-110 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
                        >
                            Orçamento
                        </a>
                    </div>

                    {/* Mobile Button */}
                    <button
                        onClick={() => setOpen(!open)}
                        className="md:hidden h-9 w-9 flex items-center justify-center text-white"
                        aria-label="Abrir menu"
                    >
                        <MenuToggleIcon open={open} className="size-6" duration={300} />
                    </button>
                </nav>
            </header>

            {/* Mobile Overlay - Moved outside <header> to avoid containing block clipping from backdrop-blur */}
            <AnimatePresence>
                {open && (
                    <>
                        {/* Backdrop Dimmer */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9990] md:hidden"
                        />

                        {/* Side Drawer */}
                        <motion.div
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
                                <X className="size-8" />
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
                                    href="https://wa.me/5581998008818"
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
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
