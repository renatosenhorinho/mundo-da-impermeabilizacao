import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Building2, FlaskConical, Users } from "lucide-react";

// --- Animated Counter Hook ---
function useCountUp(target: number, duration = 1500, start = false) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!start) return;
        let startTime: number | null = null;
        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            setValue(Math.floor(progress * target));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [start, target, duration]);
    return value;
}

// --- Intersection Observer Hook ---
function useInView() {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setInView(true); },
            { threshold: 0.2 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);
    return { ref, inView };
}

// --- Stat Card with CountUp ---
function StatCard({ num, label, isNumeric }: { num: string; label: string; isNumeric?: boolean }) {
    const { ref, inView } = useInView();
    const numericValue = isNumeric ? parseInt(num) : 0;
    const count = useCountUp(numericValue, 1200, isNumeric ? inView : false);

    return (
        <div ref={ref} className="flex flex-col items-center text-center px-4">
            <span className="text-5xl md:text-6xl font-black text-secondary mb-3 drop-shadow-[0_0_20px_rgba(251,191,36,0.25)] tabular-nums">
                {isNumeric ? `${count}+` : num}
            </span>
            <span className="text-sm md:text-base font-bold text-slate-300 uppercase tracking-wide leading-snug max-w-[160px]">
                {label}
            </span>
        </div>
    );
}

// --- Solution Card ---
function SolutionCard({
    icon: Icon,
    title,
    desc,
    delay,
}: {
    icon: React.ElementType;
    title: string;
    desc: string;
    delay: number;
}) {
    const { ref, inView } = useInView();

    return (
        <div
            ref={ref}
            className="group bg-white p-8 rounded-2xl shadow-md border border-slate-100 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300"
            style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(24px)",
                transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms, box-shadow 0.3s, translate 0.3s`,
            }}
        >
            <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
                <Icon size={26} strokeWidth={2} className="text-white" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-3 leading-tight">
                {title}
            </h3>
            <p className="text-slate-500 font-medium leading-relaxed text-sm">
                {desc}
            </p>
        </div>
    );
}

// --- Main Component ---
export default function QuemSomosSections() {
    const cards = [
        {
            icon: ShieldCheck,
            title: "Impermeabilização",
            desc: "Sistemas completos para proteção contra infiltrações, umidade e pressão hidrostática, garantindo estanqueidade e durabilidade para qualquer tipo de estrutura.",
        },
        {
            icon: Building2,
            title: "Recuperação Estrutural",
            desc: "Soluções de alta performance para reparo, tratamento e reforço de estruturas de concreto comprometidas ou deterioradas.",
        },
        {
            icon: FlaskConical,
            title: "Aditivos para Concreto",
            desc: "Tecnologia química aplicada para melhorar trabalhabilidade, acelerar cura e aumentar a resistência e durabilidade de concretos e argamassas.",
        },
        {
            icon: Users,
            title: "Atendimento Técnico Especializado",
            desc: "Equipe técnica preparada para analisar cada obra e indicar a solução mais eficiente com o melhor custo-benefício.",
        },
    ];

    return (
        <>
            {/* ─── Soluções Técnicas ─── */}
            <section className="py-24 bg-background-light border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                    {/* Header */}
                    <div className="text-center mb-16 max-w-3xl mx-auto">
                        <span className="inline-block text-xs font-black uppercase tracking-widest text-primary mb-4 bg-primary/10 px-4 py-1.5 rounded-full">
                            Nossa Especialização
                        </span>
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase leading-tight mb-4">
                            Soluções Técnicas para <br className="hidden md:block" />
                            <span className="text-secondary drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]">Construção</span> e {" "}
                            <span className="text-primary blue-underline inline-block mt-2 md:mt-0">Impermeabilização</span>
                        </h2>
                        <p className="text-slate-500 text-lg font-medium leading-relaxed">
                            Engenharia, tecnologia e experiência para proteger estruturas contra infiltrações, umidade e deterioração estrutural.
                        </p>
                    </div>

                    {/* Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {cards.map((card, i) => (
                            <SolutionCard key={i} delay={i * 100} {...card} aria-hidden="true" />
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Authority Strip ─── */}
            <section className="py-20 bg-background-dark text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                    <div className="text-center mb-14">
                        <h2 className="text-2xl md:text-4xl font-black uppercase text-white leading-tight">
                            Resultados que comprovam{" "}
                            <span className="text-secondary yellow-underline">nossa experiência</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-6 divide-x-0 lg:divide-x lg:divide-white/10">
                        <StatCard num="20" label="Anos de atuação no mercado de impermeabilização" isNumeric />
                        <StatCard num="100%" label="Suporte técnico especializado" />
                        <StatCard num="NE" label="Distribuição para todo o Nordeste" />
                        <StatCard num="$" label="Soluções com excelente custo-benefício" />
                    </div>
                </div>
            </section>

            {/* ─── Missão, Visão e Valores ─── */}
            <section className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                        <div className="bg-background-light p-10 rounded-2xl shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-bl-full -z-10 group-hover:bg-secondary/20 transition-colors" />
                            <h3 className="text-2xl font-black text-primary uppercase mb-4">Missão</h3>
                            <p className="text-slate-700 font-medium text-lg leading-relaxed">
                                Fornecer as melhores soluções técnicas e materiais de alta performance, garantindo suporte especializado para o sucesso de cada obra.
                            </p>
                        </div>

                        <div className="bg-primary p-10 rounded-2xl shadow-xl shadow-primary/20 rotate-1 md:-translate-y-4 hover:rotate-0 transition-transform duration-300">
                            <h3 className="text-2xl font-black text-secondary uppercase mb-4">Visão</h3>
                            <p className="text-white font-medium text-lg leading-relaxed">
                                Ser o Distribuidor referência no Nordeste em impermeabilização e recuperação estrutural.
                            </p>
                        </div>

                        <div className="bg-background-light p-10 rounded-2xl shadow-xl relative overflow-hidden group">
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-tr-full -z-10 group-hover:bg-primary/10 transition-colors" />
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
