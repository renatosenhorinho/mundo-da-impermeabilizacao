import { ShieldCheck, Building, Layers, Factory } from 'lucide-react';

const SpecializedSolutions = () => {
    const services = [
        {
            title: 'Impermeabilização Predial',
            description: 'Soluções completas para lajes, piscinas, reservatórios, fachadas e áreas molhadas.',
            icon: ShieldCheck,
            image: '/images/specialized/impermeabilizacao-predial.png'
        },
        {
            title: 'Recuperação Estrutural',
            description: 'Tratamento de fissuras, corrosão de armaduras e reforço estrutural em concreto.',
            icon: Building,
            image: '/images/specialized/recuperacao-estrutural.png'
        },
        {
            title: 'Impermeabilização de Lajes e Coberturas',
            description: 'Sistemas com manta asfáltica, membranas líquidas e proteção térmica.',
            icon: Layers,
            image: '/images/specialized/impermeabilizacao-de-lajes-e-coberturas.png'
        },
        {
            title: 'Soluções Industriais',
            description: 'Sistemas de impermeabilização e proteção para ambientes industriais e estruturas expostas.',
            icon: Factory,
            image: '/images/specialized/solucoes-industriais.png'
        }
    ];

    return (
        <section className="py-24 bg-background-light diagonal-divider-reverse">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <p className="text-secondary font-black uppercase tracking-[0.3em] text-sm mb-4">Nossos Serviços</p>
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 uppercase mb-6">Soluções Especializadas</h2>
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
                                    src={service.image}
                                    alt={service.title}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
                                <div className="absolute top-4 left-4 bg-primary text-white p-3 rounded-xl shadow-lg transform group-hover:scale-110 transition-transform">
                                    <service.icon size={28} strokeWidth={2} />
                                </div>
                            </div>

                            <div className="p-8 sm:w-3/5 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 leading-tight mb-4 group-hover:text-primary transition-colors">{service.title}</h3>
                                    <p className="text-slate-600 font-medium mb-8 line-clamp-3">{service.description}</p>
                                </div>

                                <div className="mt-auto">
                                    <a href="/contato.html#contact-info" className="inline-flex items-center gap-2 text-primary font-bold uppercase tracking-wider text-sm group/link">
                                        Saiba mais
                                        <span className="material-symbols-outlined text-xl group-hover/link:translate-x-1 transition-transform">arrow_forward</span>
                                    </a>
                                </div>

                                <div className="absolute text-[8rem] font-black text-slate-50 right-4 bottom-0 leading-none -z-10 select-none group-hover:text-primary/5 transition-colors">
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
