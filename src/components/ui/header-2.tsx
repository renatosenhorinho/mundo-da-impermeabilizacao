'use client';
import React from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/components/ui/use-scroll';
import { AnimatePresence, motion } from 'framer-motion';

export function Header() {
    const [open, setOpen] = React.useState(false);
    const scrolled = useScroll(10);

    const links = [
        { label: "Início", href: "/index.html" },
        { label: "Quem Somos", href: "/quem-somos.html" },
        { label: "Contato", href: "/contato.html" }
    ];

    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    return (
        <header
            className={cn(
                'sticky top-0 z-50 mx-auto w-full border-b border-transparent transition-all ease-out h-[80px] flex items-center',
                {
                    'bg-white/95 supports-[backdrop-filter]:bg-white/50 border-primary/10 backdrop-blur-lg shadow-sm md:top-4 md:max-w-6xl md:rounded-2xl md:h-[70px]':
                        scrolled && !open,
                    'bg-white h-[80px]': open,
                    'bg-white/95': !scrolled && !open,
                }
            )}
        >
            <nav
                className={cn(
                    'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex w-full items-center justify-between transition-all ease-out',
                    {
                        'md:px-8': scrolled,
                    }
                )}
            >
                <a href="/index.html" className="flex items-center gap-3 shrink-0">
                    <img src="/Logos/logo-main.png" alt="Mundo da Impermeabilização" className={cn("transition-all duration-500", scrolled ? "h-25" : "h-22 mt-3")} />
                </a>

                <div className="hidden items-center gap-2 md:flex">
                    {links.map((link, i) => (
                        <a
                            key={i}
                            className={buttonVariants({ variant: 'ghost', className: 'text-slate-700 font-bold uppercase tracking-wider hover:text-primary transition-colors px-4' })}
                            href={link.href}
                        >
                            {link.label}
                        </a>
                    ))}
                    <a
                        href="https://wa.me/5581998008818"
                        target="_blank"
                        className={cn(
                            buttonVariants({ variant: 'default' }),
                            "bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-lg font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 transition-all ml-4"
                        )}
                    >
                        ORÇAMENTO
                    </a>
                </div>

                <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setOpen(!open)}
                    className="md:hidden text-primary h-12 w-12"
                >
                    <MenuToggleIcon open={open} className="size-8" duration={300} />
                </Button>
            </nav>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-x-0 top-[80px] bottom-0 z-[100] flex flex-col overflow-hidden bg-white/95 backdrop-blur-lg md:hidden"
                    >
                        <div className="flex flex-col gap-y-4 p-8 h-full overflow-y-auto">
                            <div className="grid gap-y-2">
                                {links.map((link) => (
                                    <a
                                        key={link.label}
                                        href={link.href}
                                        className={buttonVariants({
                                            variant: 'ghost',
                                            className: 'justify-start text-2xl font-black text-slate-900 uppercase tracking-tighter hover:text-primary py-8 px-4 h-auto border-b border-slate-50',
                                        })}
                                        onClick={() => setOpen(false)}
                                    >
                                        {link.label}
                                    </a>
                                ))}
                            </div>

                            <div className="mt-8 flex flex-col gap-4">
                                <a
                                    href="https://wa.me/5581998008818"
                                    target="_blank"
                                    className="bg-primary text-white py-5 rounded-2xl font-black text-center text-sm uppercase tracking-widest shadow-xl shadow-primary/20"
                                    onClick={() => setOpen(false)}
                                >
                                    SOLICITAR ORÇAMENTO
                                </a>
                            </div>

                            <div className="mt-auto pt-8 border-t border-slate-100 italic text-slate-400 text-sm">
                                Líder distribuidor de materiais de impermeabilização no Nordeste.
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
