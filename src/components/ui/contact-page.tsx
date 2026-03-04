import React, { useState } from "react";
import { Phone, MapPin, Instagram, MessageCircle, Send } from "lucide-react";
import { motion, Variants } from "framer-motion";

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
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

        // Format message for WhatsApp
        const message = `Olá, me chamo ${formData.name}.
📌 *Assunto:* ${formData.subject}
📧 *E-mail:* ${formData.email}
📱 *WhatsApp:* ${formData.phone}

📝 *Mensagem:*
${formData.message}`;

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/5581998008818?text=${encodedMessage}`;

        // Redirect immediately to avoid popup blockers
        setStatus("success");
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        setFormData({ name: "", email: "", phone: "", subject: "Impermeabilização", message: "" });

        // Reset status after a delay so the UI doesn't flicker
        setTimeout(() => setStatus("idle"), 3000);
    };



    return (
        <main className="bg-background-light min-h-screen">
            {/* Hero Section */}
            <section className="bg-background-dark py-24 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                    <img src="/hero-bg.png" alt="Background" className="w-full h-full object-cover" />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-4xl md:text-6xl font-black text-white uppercase mb-6 tracking-tighter">
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
                                <h2 className="text-3xl font-black text-slate-900 uppercase mb-8 leading-none">
                                    Informações de <span className="text-primary blue-underline">Contato</span>
                                </h2>
                                <p className="text-slate-600 text-lg font-medium leading-relaxed mb-10">
                                    Visite nossa loja ou entre em contato pelos nossos canais oficiais.
                                    Atendimento especializado de segunda a sexta.
                                </p>
                            </motion.div>

                            <div className="space-y-8">
                                {[
                                    { icon: <MapPin size={28} />, title: "Nosso Endereço", content: "Av. Recife, 2220 - Ipsep\nRecife - PE, 51350-670" },
                                    { icon: <Phone size={28} />, title: "Telefone Fixo", content: "(81) 3339-0124" },
                                    {
                                        icon: <MessageCircle size={28} />,
                                        title: "WhatsApp Especialista 1",
                                        content: "(81) 99609-0068",
                                        link: "https://wa.me/5581996090068",
                                        linkText: "Iniciar Conversa"
                                    },
                                    {
                                        icon: <MessageCircle size={28} />,
                                        title: "WhatsApp Especialista 2",
                                        content: "(81) 99800-8818",
                                        link: "https://wa.me/5581998008818",
                                        linkText: "Iniciar Conversa"
                                    },
                                    {
                                        icon: <Instagram size={28} />,
                                        title: "Instagram",
                                        content: "@mundodaimpermeabilizacao",
                                        link: "https://www.instagram.com/mundodaimpermeabilizacao/",
                                        linkText: "Seguir no Instagram"
                                    }
                                ].map((item, index) => (
                                    <motion.div
                                        key={index}
                                        variants={itemVariants}
                                        className="flex items-start gap-6 group"
                                    >
                                        <div className="w-14 h-14 bg-white shadow-xl rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 transform group-hover:scale-110">
                                            {item.icon}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 uppercase mb-1">{item.title}</h3>
                                            <p className="text-slate-600 font-medium whitespace-pre-line">{item.content}</p>
                                            {item.link && (
                                                <a
                                                    href={item.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary font-bold text-sm uppercase mt-2 inline-block border-b-2 border-primary/20 hover:border-primary transition-all"
                                                >
                                                    {item.linkText}
                                                </a>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Form Column */}
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100"
                        >
                            <h3 className="text-2xl font-black text-slate-900 uppercase mb-8">Envie sua Mensagem</h3>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase text-slate-400 ml-1">Seu Nome</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300"
                                            placeholder="Nome Completo"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase text-slate-400 ml-1">Seu E-mail</label>
                                        <input
                                            required
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
                                        <label className="text-xs font-black uppercase text-slate-400 ml-1">WhatsApp</label>
                                        <input
                                            required
                                            type="tel"
                                            className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300"
                                            placeholder="(81) 00000-0000"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase text-slate-400 ml-1">Assunto</label>
                                        <select
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
                                    <label className="text-xs font-black uppercase text-slate-400 ml-1">Mensagem</label>
                                    <textarea
                                        required
                                        rows={4}
                                        className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300 resize-none"
                                        placeholder="Como podemos ajudar sua obra?"
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    ></textarea>
                                </div>

                                <button
                                    disabled={status === "loading"}
                                    type="submit"
                                    className="w-full bg-primary hover:bg-primary/95 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                                >
                                    {status === "loading" ? "Enviando..." : status === "success" ? "Mensagem Enviada!" : "Enviar Mensagem"}
                                    <Send size={18} />
                                </button>

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
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
                <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-background-light to-transparent pointer-events-none"></div>
            </section>
        </main>
    );
}
