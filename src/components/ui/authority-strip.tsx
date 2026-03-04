import React from 'react'
import { GlowingShadow } from './glowing-shadow'

interface FeatureBox {
    icon: string
    category: string
    title: string
    color: 'blue' | 'yellow'
}

const features: FeatureBox[] = [
    { icon: 'history', category: 'Experiência', title: '+20 ANOS DE MERCADO', color: 'blue' },
    { icon: 'verified', category: 'Autoridade', title: 'REFERÊNCIA REGIONAL', color: 'yellow' },
    { icon: 'inventory_2', category: 'Logística', title: 'ESTOQUE COMPLETO', color: 'blue' },
    { icon: 'engineering', category: 'Suporte', title: 'ATENDIMENTO TÉCNICO', color: 'yellow' },
]

const colorMap = {
    blue: { glow: '#0059b3', border: '#0059b3', text: '#0059b3' },
    yellow: { glow: '#fbb034', border: '#fbb034', text: '#fbb034' },
}

export default function AuthorityStrip() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {features.map((f, i) => {
                const c = colorMap[f.color]
                return (
                    <GlowingShadow key={i} glowColor={c.glow}>
                        <div
                            className="bg-white p-8 rounded-xl"
                            style={{ borderBottom: `8px solid ${c.border}` }}
                        >
                            <span
                                className="material-symbols-outlined text-4xl mb-4 block"
                                style={{ color: c.text }}
                            >
                                {f.icon}
                            </span>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">
                                {f.category}
                            </p>
                            <p className="text-slate-900 text-2xl font-black uppercase">
                                {f.title}
                            </p>
                        </div>
                    </GlowingShadow>
                )
            })}
        </div>
    )
}
