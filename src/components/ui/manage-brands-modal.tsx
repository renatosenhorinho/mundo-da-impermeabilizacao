import React, { useState, useEffect } from 'react';
import { getBrands, deleteBrand, mergeBrands, BrandStats } from '@/lib/brands-service';

export function ManageBrandsModal({ onClose }: { onClose: () => void }) {
  const [brands, setBrands] = useState<BrandStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Merge state
  const [mergingBrand, setMergingBrand] = useState<string | null>(null);
  const [targetBrand, setTargetBrand] = useState<string>('');

  const loadBrands = () => {
    setBrands(getBrands());
  };

  useEffect(() => {
    loadBrands();
  }, []);

  const handleDelete = async (brandLabel: string, count: number) => {
    if (count > 0) {
      if (!confirm(`Atenção: A marca "${brandLabel}" está sendo usada por ${count} produto(s) ativo(s).\n\nSe você continuar, a marca será removida destes produtos. Deseja continuar?`)) {
        return;
      }
    } else {
      if (!confirm(`Tem certeza que deseja remover a marca "${brandLabel}"?`)) {
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      await deleteBrand(brandLabel);
      loadBrands();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergingBrand || !targetBrand) return;

    if (!confirm(`Todos os produtos da marca "${mergingBrand}" serão movidos para "${targetBrand}".\n\nEssa ação não pode ser desfeita. Confirmar?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await mergeBrands(mergingBrand, targetBrand);
      setMergingBrand(null);
      setTargetBrand('');
      loadBrands();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-[#0A0D14]/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#161B22] w-full max-w-2xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <header className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#0E1117]">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-400">label</span>
              Gerenciar Marcas
            </h2>
            <p className="text-xs text-slate-400 mt-1">Exclua ou mescle marcas do catálogo</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors">
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

          {mergingBrand && (
            <form onSubmit={handleMergeSubmit} className="mb-6 bg-slate-800/40 border border-sky-500/20 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
              <h3 className="text-sm font-bold text-sky-400 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">call_merge</span>
                Mesclar Marca
              </h3>
              <p className="text-xs text-slate-300 mb-4">
                Mover todos os produtos de <strong>{mergingBrand}</strong> para:
              </p>
              <div className="flex gap-2">
                <select 
                  required
                  value={targetBrand}
                  onChange={e => setTargetBrand(e.target.value)}
                  className="flex-1 bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-sky-500 outline-none"
                >
                  <option value="" disabled>Selecione a marca destino...</option>
                  {brands.filter(b => b.label !== mergingBrand).map(b => (
                    <option key={b.label} value={b.label}>{b.label}</option>
                  ))}
                </select>
                <button type="submit" disabled={loading || !targetBrand} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 text-sm">
                  Mesclar
                </button>
                <button type="button" onClick={() => setMergingBrand(null)} className="px-3 py-2 text-slate-400 hover:text-white rounded-lg transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {brands.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Nenhuma marca encontrada no catálogo.</p>
            ) : (
              brands.map(b => (
                <div key={b.label} className="flex items-center justify-between bg-[#0E1117] border border-slate-800 rounded-xl p-3 group hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 font-bold text-sm">
                      {b.label.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">{b.label}</h4>
                      <p className="text-[11px] text-slate-500">{b.count} {b.count === 1 ? 'produto' : 'produtos'}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setMergingBrand(b.label)}
                      disabled={loading || b.count === 0}
                      className="p-2 text-sky-400 hover:bg-sky-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Mesclar marca"
                    >
                      <span className="material-symbols-outlined text-[18px]">call_merge</span>
                    </button>
                    <button 
                      onClick={() => handleDelete(b.label, b.count)}
                      disabled={loading}
                      className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Remover marca"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
