import { ShieldCheck, Building2, FlaskConical, Users } from "lucide-react";

export function QuemSomosSections() {
    return (
        <>
            {/* 🏢 Nossa Especialização */}
            <section className="py-24 bg-white border-t border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase">
                            Nossa <span className="text-primary blue-underline">Especialização</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            {
                                icon: ShieldCheck,
                                title: "Impermeabilização",
                                desc: "Sistemas completos para proteção contra água e umidade, garantindo estanqueidade em qualquer tipo de estrutura."
                            },
                            {
                                icon: Building2,
                                title: "Recuperação Estrutural",
                                desc: "Materiais de alta resistência para tratamento e reforço de estruturas de concreto comprometidas."
                            },
                            {
                                icon: FlaskConical,
                                title: "Aditivos para Concreto",
                                desc: "Produtos químicos para melhorar a trabalhabilidade, acelerar cura e aumentar a resistência de argamassas."
                            },
                            {
                                icon: Users,
                                title: "Atendimento Consultivo",
                                desc: "Engenheiros e técnicos capacitados para indicar a melhor solução técnica com excelente custo-benefício."
                            }
                        ].map((item, i) => (
                            <div key={i} className="bg-background-light p-8 rounded-xl shadow-lg border-b-4 border-secondary hover:-translate-y-2 transition-transform duration-300">
                                <div className="w-14 h-14 bg-primary text-white rounded-lg flex items-center justify-center mb-6 shadow-md shadow-primary/20">
                                    <item.icon size={28} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 uppercase mb-3 leading-tight">{item.title}</h3>
                                <p className="text-slate-600 font-medium leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 📊 Diferenciais Competitivos */}
            <section className="py-24 bg-background-dark text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
                        {[
                            { num: "20+", text: "Anos de mercado e tradição" },
                            { num: "100%", text: "Atendimento técnico especializado" },
                            { num: "NE", text: "Distribuição para todo o Nordeste" },
                            { num: "$", text: "Soluções com excelente custo-benefício" }
                        ].map((d, i) => (
                            <div key={i} className="flex flex-col items-center text-center">
                                <span className="text-5xl font-black text-secondary mb-4 drop-shadow-[0_0_15px_rgba(251,191,36,0.2)]">{d.num}</span>
                                <span className="text-lg font-bold text-slate-300 uppercase tracking-wide">{d.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 🎯 Missão, Visão e Valores */}
            <section className="py-24 bg-white relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-background-light p-10 rounded-2xl shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-bl-full -z-10 group-hover:bg-secondary/20 transition-colors"></div>
                            <h3 className="text-2xl font-black text-primary uppercase mb-4">Missão</h3>
                            <p className="text-slate-700 font-medium text-lg leading-relaxed">
                                Fornecer as melhores soluções técnicas e materiais de alta performance, garantindo suporte especializado para o sucesso de cada obra.
                            </p>
                        </div>

                        <div className="bg-primary p-10 rounded-2xl shadow-xl shadow-primary/20 rotate-1 md:-translate-y-4 hover:rotate-0 transition-transform">
                            <h3 className="text-2xl font-black text-secondary uppercase mb-4">Visão</h3>
                            <p className="text-white font-medium text-lg leading-relaxed">
                                Ser Distribuidor referência no Nordeste em impermeabilização e recuperação estrutural.
                            </p>
                        </div>

                        <div className="bg-background-light p-10 rounded-2xl shadow-xl relative overflow-hidden group">
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-tr-full -z-10 group-hover:bg-primary/10 transition-colors"></div>
                            <h3 className="text-2xl font-black text-primary uppercase mb-4">Valores</h3>
                            <p className="text-slate-700 font-medium text-lg leading-relaxed">
                                Ética, transparência, responsabilidade técnica, compromisso com a qualidade e foco no cliente.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
