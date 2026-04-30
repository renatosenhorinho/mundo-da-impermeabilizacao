interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    strokeWidth?: number;
}

const ShieldCheck = ({ size = 24, strokeWidth = 2, ...props }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
);
const Building = ({ size = 24, strokeWidth = 2, ...props }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M16 18h.01"/></svg>
);
const Layers = ({ size = 24, strokeWidth = 2, ...props }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>
);
const Factory = ({ size = 24, strokeWidth = 2, ...props }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>
);

const SpecializedSolutions = () => {
    const services = [
        {
            title: 'Impermeabilização Predial',
            description: 'Soluções completas para lajes, piscinas, reservatórios, fachadas e áreas molhadas.',
            icon: ShieldCheck,
            image: '/images/specialized/impermeabilizacao-predial.webp'
        },
        {
            title: 'Recuperação Estrutural',
            description: 'Tratamento de fissuras, corrosão de armaduras e reforço estrutural em concreto.',
            icon: Building,
            image: '/images/specialized/recuperacao-estrutural.webp'
        },
        {
            title: 'Impermeabilização de Lajes e Coberturas',
            description: 'Sistemas com manta asfáltica, membranas líquidas e proteção térmica.',
            icon: Layers,
            image: '/images/specialized/impermeabilizacao-de-lajes-e-coberturas.webp'
        },
        {
            title: 'Soluções Industriais',
            description: 'Sistemas de impermeabilização e proteção para ambientes industriais e estruturas expostas.',
            icon: Factory,
            image: '/images/specialized/solucoes-industriais.webp'
        }
    ];

    return (
        <section className="py-24 bg-background-light diagonal-divider-reverse">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <p className="text-primary font-black uppercase tracking-[0.3em] text-sm mb-4">Nossos Serviços</p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 uppercase mb-6 leading-tight">Soluções Especializadas</h2>
                    <p className="text-slate-600 text-lg max-w-2xl mx-auto font-medium">Distribuição de sistemas técnicos de impermeabilização e recuperação estrutural para todos os tipos de projeto.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
                    {services.map((service, index) => (
                        <div
                            key={index}
                            className="group bg-white rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-slate-100 hover:border-primary/50 flex flex-col sm:flex-row h-full"
                        >
                            <div className="sm:w-2/5 h-64 sm:h-auto overflow-hidden relative">
                                <img
                                    src={service.image.replace('.webp', '-404w.webp')}
                                    srcSet={`${service.image.replace('.webp', '-320w.webp')} 320w, ${service.image.replace('.webp', '-404w.webp')} 404w, ${service.image.replace('.webp', '-808w.webp')} 808w`}
                                    sizes="(max-width: 640px) 95vw, (max-width: 1024px) 45vw, 400px"
                                    alt={service.title}
                                    width="404"
                                    height="269"
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
                                <div className="absolute top-4 left-4 bg-primary text-white p-3 rounded-xl shadow-lg transform group-hover:scale-110 transition-transform">
                                    <service.icon size={28} strokeWidth={2} aria-hidden="true" />
                                </div>
                            </div>

                            <div className="p-8 sm:w-3/5 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 leading-tight mb-4 group-hover:text-primary transition-colors">{service.title}</h3>
                                    <p className="text-slate-600 font-medium mb-8 line-clamp-3">{service.description}</p>
                                </div>

                                <div className="mt-auto">
                                    <a
                                        href="/contato.html#contact-info"
                                        className="inline-flex items-center gap-2 text-primary font-bold uppercase tracking-wider text-sm group/link"
                                        aria-label={`Saiba mais sobre ${service.title}`}
                                    >
                                        Saiba mais
                                        <span className="material-symbols-outlined text-xl group-hover/link:translate-x-1 transition-transform" aria-hidden="true">arrow_forward</span>
                                    </a>
                                </div>

                                <div className="absolute text-[5rem] sm:text-[8rem] font-black text-slate-50 right-4 bottom-0 leading-none -z-10 select-none group-hover:text-primary/5 transition-colors">
                                    0{index + 1}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default SpecializedSolutions;
