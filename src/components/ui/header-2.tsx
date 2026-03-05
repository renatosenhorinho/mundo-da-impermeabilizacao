'use client';
import React from 'react';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { AnimatePresence, motion } from 'framer-motion';

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
        <header className="fixed top-0 left-0 right-0 z-50 w-full backdrop-blur-sm bg-transparent">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">

                {/* Logo */}
                <a href="/index.html" className="shrink-0">
                    <img
                        src="/Logos/logo-main.png"
                        alt="Mundo da Impermeabilização"
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

            {/* Mobile Overlay */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-x-0 top-14 bottom-0 z-[100] bg-background-dark/97 backdrop-blur-lg md:hidden flex flex-col"
                    >
                        <div className="flex flex-col p-6 gap-2">
                            {links.map((link) => (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    className="text-2xl font-black uppercase tracking-tight text-white hover:text-secondary transition-colors py-4 px-2 border-b border-white/10"
                                    onClick={() => setOpen(false)}
                                >
                                    {link.label}
                                </a>
                            ))}

                            <a
                                href="https://wa.me/5581998008818"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-6 py-4 bg-secondary text-slate-900 rounded-2xl font-black text-center text-sm uppercase tracking-widest hover:brightness-110 transition-all"
                                onClick={() => setOpen(false)}
                            >
                                Solicitar Orçamento
                            </a>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
