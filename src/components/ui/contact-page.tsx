import React, { useState, useCallback } from "react";
import { Phone, MapPin, Instagram, MessageCircle, Send, Copy, Check } from "lucide-react";
import { motion, Variants } from "framer-motion";
import { WHATSAPP_NUMBER } from "@/config/constants";

// ─── Constants ───────────────────────────────────────────────────────────────

const PHONE_NUMBER_RAW = "8133390124";
const PHONE_DISPLAY = "(81) 3339-0124";
const PHONE_HREF = `tel:+55${PHONE_NUMBER_RAW}`;

const SPECIALIST_1_NUMBER = "5581996090068";
const SPECIALIST_2_NUMBER = WHATSAPP_NUMBER; // from constants

const SOURCE_TAG = encodeURIComponent(" (Vim pela página de contato)");

const buildWaUrl = (number: string, rawMessage: string): string => {
    const encoded = encodeURIComponent(rawMessage) + SOURCE_TAG;
    return `https://wa.me/${number}?text=${encoded}`;
};

const WA_SPECIALIST_1 = buildWaUrl(
    SPECIALIST_1_NUMBER,
    "Olá! Vim pelo site e gostaria de falar com um especialista sobre impermeabilização."
);
const WA_SPECIALIST_2 = buildWaUrl(
    SPECIALIST_2_NUMBER,
    "Olá! Preciso de ajuda com um produto de impermeabilização. Pode me orientar?"
);

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
};

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { duration: 0.5, ease: "easeOut" }
    }
};

// ─── WhatsApp Button Component ────────────────────────────────────────────────

interface WhatsAppButtonProps {
    href: string;
    label: string;
    specialist: string;
}

function WhatsAppButton({ href, label, specialist }: WhatsAppButtonProps) {
    return (
        <div className="space-y-1">
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Conversar no WhatsApp com ${specialist}`}
                className="
                    flex items-center justify-center gap-3
                    min-h-[52px] w-full
                    bg-[#25D366] hover:bg-[#20c05c] active:bg-[#1aad52]
                    text-white font-black text-sm uppercase tracking-widest
                    rounded-2xl px-6 py-4
                    shadow-lg shadow-[#25D366]/30
                    transition-all duration-200
                    active:scale-95
                "
            >
                {/* WhatsApp SVG icon */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5 shrink-0"
                    aria-hidden="true"
                >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                {label}
            </a>
            <p className="text-center text-xs text-slate-400 font-medium">
                Atendimento rápido • Sem compromisso
            </p>
        </div>
    );
}

// ─── Phone Row Component ──────────────────────────────────────────────────────

function PhoneRow() {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(PHONE_NUMBER_RAW).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, []);

    return (
        <div className="flex items-center gap-3 flex-wrap">
            <a
                href={PHONE_HREF}
                className="text-slate-700 font-bold text-base hover:text-primary transition-colors"
                aria-label={`Ligar para ${PHONE_DISPLAY}`}
            >
                {PHONE_DISPLAY}
            </a>
            <button
                onClick={handleCopy}
                aria-label={copied ? "Número copiado" : "Copiar número"}
                title={copied ? "Copiado!" : "Copiar número"}
                className="
                    flex items-center gap-1.5
                    text-xs font-bold uppercase tracking-wide
                    px-3 py-1.5 rounded-lg
                    border border-slate-200 bg-slate-50
                    hover:bg-slate-100 hover:border-slate-300
                    active:scale-95
                    transition-all duration-150
                    text-slate-500 hover:text-slate-700
                "
            >
                {copied ? (
                    <>
                        <Check size={12} aria-hidden="true" />
                        Copiado!
                    </>
                ) : (
                    <>
                        <Copy size={12} aria-hidden="true" />
                        Copiar
                    </>
                )}
            </button>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        subject: "Impermeabilização",
        message: ""
    });
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");

        const message = `Olá, me chamo ${formData.name}.
📌 *Assunto:* ${formData.subject}
📧 *E-mail:* ${formData.email}
📱 *WhatsApp:* ${formData.phone}

📝 *Mensagem:*
${formData.message}

(Formulário do site — página de contato)`;

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

        setStatus("success");
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        setFormData({ name: "", email: "", phone: "", subject: "Impermeabilização", message: "" });

        setTimeout(() => setStatus("idle"), 3000);
    };

    return (
        <main className="bg-background-light min-h-screen">
            {/* Hero Section */}
            <section className="bg-background-dark py-24 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" aria-hidden="true">
                    <img
                        src="/hero-bg.webp"
                        alt=""
                        width="1920"
                        height="400"
                        className="w-full h-full object-cover"
                        loading="eager"
                        decoding="async"
                    />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-white uppercase mb-6 tracking-tighter leading-tight">
                            Fale com um <span className="text-secondary">Especialista</span>
                        </h1>
                        <p className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto font-medium mb-8">
                            Estamos prontos para oferecer o melhor diagnóstico técnico para sua obra.
                            Preencha o formulário ou use nossos canais diretos.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Contact Content */}
            <section className="py-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

                        {/* Info Column */}
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            className="space-y-12"
                        >
                            <motion.div variants={itemVariants}>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase mb-8 leading-tight">
                                    Informações de <span className="text-primary blue-underline">Contato</span>
                                </h2>
                                <p className="text-slate-600 text-lg font-medium leading-relaxed mb-10">
                                    Visite nossa loja ou entre em contato pelos nossos canais oficiais.
                                    Atendimento especializado de segunda a sexta.
                                </p>
                            </motion.div>

                            <div className="space-y-8">

                                {/* Endereço */}
                                <motion.div variants={itemVariants} className="flex items-start gap-6 group">
                                    <div className="w-14 h-14 bg-white shadow-xl rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 transform group-hover:scale-110 shrink-0">
                                        <MapPin size={28} aria-hidden="true" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 uppercase mb-1">Nosso Endereço</h3>
                                        <p className="text-slate-600 font-medium whitespace-pre-line">
                                            Av. Recife, 2220 - Ipsep{"\n"}Recife - PE, 51350-670
                                        </p>
                                    </div>
                                </motion.div>

                                {/* Telefone Fixo — clicável + copiar */}
                                <motion.div variants={itemVariants} className="flex items-start gap-6 group">
                                    <div className="w-14 h-14 bg-white shadow-xl rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 transform group-hover:scale-110 shrink-0">
                                        <Phone size={28} aria-hidden="true" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-black text-slate-900 uppercase mb-1">Telefone Fixo</h3>
                                        <PhoneRow />
                                        <p className="text-xs text-slate-400 font-medium">
                                            No celular, toque para ligar diretamente
                                        </p>
                                    </div>
                                </motion.div>

                                {/* WhatsApp Especialista 1 */}
                                <motion.div variants={itemVariants} className="flex items-start gap-6 group">
                                    <div className="w-14 h-14 bg-white shadow-xl rounded-xl flex items-center justify-center text-[#25D366] group-hover:bg-[#25D366] group-hover:text-white transition-all duration-300 transform group-hover:scale-110 shrink-0">
                                        <MessageCircle size={28} aria-hidden="true" />
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 uppercase mb-0.5">WhatsApp Especialista 1</h3>
                                            <p className="text-slate-500 font-medium text-sm">(81) 99609-0068</p>
                                        </div>
                                        <WhatsAppButton
                                            href={WA_SPECIALIST_1}
                                            label="Conversar no WhatsApp"
                                            specialist="Especialista 1"
                                        />
                                    </div>
                                </motion.div>

                                {/* WhatsApp Especialista 2 */}
                                <motion.div variants={itemVariants} className="flex items-start gap-6 group">
                                    <div className="w-14 h-14 bg-white shadow-xl rounded-xl flex items-center justify-center text-[#25D366] group-hover:bg-[#25D366] group-hover:text-white transition-all duration-300 transform group-hover:scale-110 shrink-0">
                                        <MessageCircle size={28} aria-hidden="true" />
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 uppercase mb-0.5">WhatsApp Especialista 2</h3>
                                            <p className="text-slate-500 font-medium text-sm">(81) 99800-8818</p>
                                        </div>
                                        <WhatsAppButton
                                            href={WA_SPECIALIST_2}
                                            label="Conversar no WhatsApp"
                                            specialist="Especialista 2"
                                        />
                                    </div>
                                </motion.div>

                                {/* Instagram */}
                                <motion.div variants={itemVariants} className="flex items-start gap-6 group">
                                    <div className="w-14 h-14 bg-white shadow-xl rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 transform group-hover:scale-110 shrink-0">
                                        <Instagram size={28} aria-hidden="true" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 uppercase mb-1">Instagram</h3>
                                        <p className="text-slate-600 font-medium">@mundodaimpermeabilizacao</p>
                                        <a
                                            href="https://www.instagram.com/mundodaimpermeabilizacao/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary font-bold text-sm uppercase mt-2 inline-block border-b-2 border-primary/20 hover:border-primary transition-all"
                                        >
                                            Seguir no Instagram
                                        </a>
                                    </div>
                                </motion.div>

                            </div>
                        </motion.div>

                        {/* Form Column */}
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="bg-white p-6 sm:p-8 md:p-12 rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100"
                        >
                            <h3 className="text-2xl font-black text-slate-900 uppercase mb-8">Envie sua Mensagem</h3>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label htmlFor="name" className="text-xs font-black uppercase text-slate-500 ml-1">Seu Nome</label>
                                        <input
                                            required
                                            id="name"
                                            type="text"
                                            className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300"
                                            placeholder="Nome Completo"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="email" className="text-xs font-black uppercase text-slate-500 ml-1">Seu E-mail</label>
                                        <input
                                            required
                                            id="email"
                                            type="email"
                                            className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300"
                                            placeholder="email@exemplo.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label htmlFor="phone" className="text-xs font-black uppercase text-slate-500 ml-1">WhatsApp</label>
                                        <input
                                            required
                                            id="phone"
                                            type="tel"
                                            className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300"
                                            placeholder="(81) 00000-0000"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="subject" className="text-xs font-black uppercase text-slate-500 ml-1">Assunto</label>
                                        <select
                                            id="subject"
                                            className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all"
                                            value={formData.subject}
                                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        >
                                            <option>Impermeabilização</option>
                                            <option>Recuperação Estrutural</option>
                                            <option>Aditivos</option>
                                            <option>Visita Técnica</option>
                                            <option>Outros</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="message" className="text-xs font-black uppercase text-slate-500 ml-1">Mensagem</label>
                                    <textarea
                                        required
                                        id="message"
                                        rows={4}
                                        className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300 resize-none"
                                        placeholder="Como podemos ajudar sua obra?"
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    />
                                </div>

                                <button
                                    disabled={status === "loading"}
                                    type="submit"
                                    aria-label={status === "loading" ? "Enviando mensagem" : "Enviar mensagem via WhatsApp"}
                                    className="w-full bg-primary hover:bg-primary/95 text-white min-h-[52px] py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                                >
                                    {status === "loading" ? "Enviando..." : status === "success" ? "Mensagem Enviada!" : "Enviar Mensagem"}
                                    <Send size={18} aria-hidden="true" />
                                </button>
                                <p className="text-center text-xs text-slate-400 font-medium -mt-2">
                                    Atendimento rápido • Sem compromisso
                                </p>

                                {status === "success" && (
                                    <motion.p
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="text-center text-green-600 font-bold text-sm uppercase tracking-wider"
                                    >
                                        Recebemos sua mensagem! Retornaremos em breve.
                                    </motion.p>
                                )}
                            </form>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Map Section */}
            <section className="h-[500px] w-full bg-slate-200 relative grayscale hover:grayscale-0 transition-all duration-1000">
                <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3949.9629303558677!2d-34.930297824991676!3d-8.105256991923756!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x7ab1e5db4e872c1%3A0xc76fd895562c3cb!2sMundo%20da%20Impermeabiliza%C3%A7%C3%A3o!5e0!3m2!1spt-BR!2sbr!4v1772662077193!5m2!1spt-BR!2sbr"
                    title="Localização do Mundo da Impermeabilização no Google Maps"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-background-light to-transparent pointer-events-none" />
            </section>
        </main>
    );
}
