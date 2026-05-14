import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { logger } from './logger';

// Validação segura de variáveis de ambiente com fallback para string vazia
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Auditoria em tempo de execução
if (typeof window !== 'undefined') {
  if (!supabaseUrl || !supabaseAnonKey) {
    logger.error('SUPABASE_ENV_MISSING', 'As variáveis de ambiente do Supabase não foram injetadas no build.', {
      hint: 'Verifique se VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configuradas no Vercel (Environment Variables) e se o deploy foi refeito após adicioná-las.'
    });
    
    // Alerta visual no console em vermelho forte para facilitar debugging em produção
    console.error(
      '%c[CRÍTICO] Supabase Desconectado! As variáveis VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY estão vazias neste ambiente. O sistema rodará em Modo Fallback Estático.',
      'color: white; background: red; font-size: 14px; font-weight: bold; padding: 4px; border-radius: 4px;'
    );
  } else {
    logger.info('Supabase Config', 'Variáveis de ambiente injetadas com sucesso.');
  }
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Garante compatibilidade de storage em produção
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      }
    })
  : null;
