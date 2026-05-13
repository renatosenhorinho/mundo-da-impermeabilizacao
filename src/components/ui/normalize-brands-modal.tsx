import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { resolveFinalBrand } from '@/lib/brand-normalizer';
import { revalidateProducts } from '@/lib/products-service';

interface NormalizationPreview {
  id: string;
  name: string;
  oldBrand: string | null;
  newBrand: string | null;
}

export function NormalizeBrandsModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NormalizationPreview[]>([]);
  const [stats, setStats] = useState({ total: 0, changes: 0, noMatch: 0 });
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadPreview();
  }, []);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) throw new Error('Supabase não conectado.');
      
      const { data: products, error: fetchErr } = await supabase.from('products').select('id, name, brand');
      if (fetchErr) throw fetchErr;

      const changes: NormalizationPreview[] = [];
      let noMatch = 0;

      for (const p of products) {
        const finalBrand = resolveFinalBrand(p.brand, p.name);
        
        if (!finalBrand) {
          noMatch++;
        }

        if (p.brand !== finalBrand) {
          changes.push({
            id: p.id,
            name: p.name,
            oldBrand: p.brand,
            newBrand: finalBrand,
          });
        }
      }

      setPreview(changes);
      setStats({
        total: products.length,
        changes: changes.length,
        noMatch
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyNormalization = async () => {
    if (!confirm(`Você está prestes a alterar a marca de ${preview.length} produtos.\nEssa ação afetará o banco de dados. Deseja continuar?`)) {
      return;
    }

    setApplying(true);
    setError(null);
    try {
      // Aplica em lotes ou 1 a 1 para não sobrecarregar
      for (const item of preview) {
        await supabase.from('products').update({ brand: item.newBrand }).eq('id', item.id);
      }
      
      await revalidateProducts(); // Recarrega store
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#0A0D14]/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-[#161B22] w-full max-w-md rounded-2xl border border-emerald-500/30 shadow-2xl p-6 text-center">
          <span className="material-symbols-outlined text-emerald-400 text-6xl mb-4">check_circle</span>
          <h2 className="text-xl font-bold text-white mb-2">Normalização Concluída</h2>
          <p className="text-slate-400 text-sm mb-6">Foram atualizados {stats.changes} produtos com sucesso. O catálogo já foi sincronizado.</p>
          <button onClick={onClose} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors">
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-[#0A0D14]/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#161B22] w-full max-w-4xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <header className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#0E1117]">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-400">auto_fix</span>
              Assistente de Normalização de Marcas
            </h2>
            <p className="text-xs text-slate-400 mt-1">Este assistente analisa produtos ativos no banco usando as regras de limpeza (Planilha Mestre).</p>
          </div>
          <button onClick={onClose} disabled={applying} className="p-2 text-slate-500 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <span className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4"></span>
              <p className="text-slate-400 font-bold">Analisando catálogo inteiro...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-[#0E1117] border border-slate-800 p-4 rounded-xl text-center">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Total Analisado</p>
                  <p className="text-2xl font-black text-white">{stats.total}</p>
                </div>
                <div className="bg-sky-500/5 border border-sky-500/20 p-4 rounded-xl text-center">
                  <p className="text-xs text-sky-400/70 uppercase font-bold tracking-widest mb-1">Precisam de Correção</p>
                  <p className="text-2xl font-black text-sky-400">{stats.changes}</p>
                </div>
                <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl text-center">
                  <p className="text-xs text-amber-400/70 uppercase font-bold tracking-widest mb-1">Sem Correspondência</p>
                  <p className="text-2xl font-black text-amber-400">{stats.noMatch}</p>
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-200 mb-3 border-b border-slate-800 pb-2">Preview das Alterações</h3>
              
              {preview.length === 0 ? (
                <div className="text-center py-12 bg-[#0E1117] border border-slate-800 rounded-xl">
                  <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">check_circle</span>
                  <p className="text-emerald-400 font-bold">O catálogo já está 100% normalizado!</p>
                  <p className="text-sm text-slate-500">Nenhuma inconsistência de marca foi encontrada.</p>
                </div>
              ) : (
                <div className="bg-[#0E1117] border border-slate-800 rounded-xl overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-[#161B22] text-xs uppercase font-bold text-slate-500 sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="p-3">Produto</th>
                          <th className="p-3">Marca Atual</th>
                          <th className="p-3">Nova Marca (Inferida)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {preview.map(item => (
                          <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-3 font-medium text-white truncate max-w-[300px]" title={item.name}>{item.name}</td>
                            <td className="p-3 text-rose-400 line-through truncate max-w-[150px]">{item.oldBrand || 'Vazio/Nulo'}</td>
                            <td className="p-3 text-emerald-400 font-bold truncate max-w-[150px]">{item.newBrand || 'Nulo (Será limpo)'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="p-5 border-t border-slate-800 bg-[#0E1117] flex justify-end gap-3 shrink-0">
          <button onClick={onClose} disabled={applying} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button 
            onClick={applyNormalization} 
            disabled={applying || preview.length === 0 || loading}
            className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 transition-colors shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:hover:bg-sky-600"
          >
            {applying ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Aplicando...</>
            ) : (
              <><span className="material-symbols-outlined text-[18px]">publish</span> Aplicar Normalização</>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
