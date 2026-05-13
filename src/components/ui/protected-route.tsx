import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, loginError, signIn, fallbackLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (supabase) {
      await signIn(email, password);
    } else {
      fallbackLogin(password);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 font-medium">Verificando segurança...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center font-sans px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.08)_0%,transparent_50%)] pointer-events-none" />
        
        <form onSubmit={handleLogin} className="bg-[#161B22] p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-800 relative overflow-hidden z-10">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-800 shadow-inner">
              <span className="material-symbols-outlined text-3xl text-indigo-400">admin_panel_settings</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Painel Admin</h1>
            <p className="text-sm text-slate-400 mt-2 font-medium">Área restrita. Identifique-se.</p>
          </div>

          <div className="space-y-4">
            {supabase && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@impermeabilizacao.com"
                  required
                  className="w-full bg-[#0E1117] border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Senha de Acesso</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#0E1117] border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none font-mono"
              />
            </div>
            
            {loginError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
            >
              Acessar Sistema
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  return <>{children}</>;
};
