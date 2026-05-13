/**
 * src/lib/health-check.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Monitor de saúde do sistema MDI.
 * Valida: Supabase, Storage, imagens críticas, analytics.
 *
 * Uso no Admin:
 *   import { runHealthCheck, HealthReport } from '@/lib/health-check';
 *   const report = await runHealthCheck();
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from './supabase';

export type CheckStatus = 'ok' | 'degraded' | 'down' | 'skip';

export interface HealthCheck {
  name: string;
  status: CheckStatus;
  latencyMs?: number;
  message?: string;
}

export interface HealthReport {
  overall: CheckStatus;
  checkedAt: string;
  checks: HealthCheck[];
}

// ── Individual checks ─────────────────────────────────────────────────────────

async function checkSupabaseDB(): Promise<HealthCheck> {
  if (!supabase) {
    return { name: 'Supabase DB', status: 'skip', message: 'Cliente não configurado' };
  }
  const t0 = performance.now();
  try {
    const { error } = await supabase.from('products').select('id').limit(1).single();
    const latencyMs = Math.round(performance.now() - t0);
    // "PGRST116" = no rows = tabela existe mas vazia — ok
    if (!error || error.code === 'PGRST116') {
      return { name: 'Supabase DB', status: 'ok', latencyMs };
    }
    return { name: 'Supabase DB', status: 'degraded', latencyMs, message: error.message };
  } catch (e: any) {
    return { name: 'Supabase DB', status: 'down', message: e.message };
  }
}

async function checkSupabaseStorage(): Promise<HealthCheck> {
  if (!supabase) {
    return { name: 'Supabase Storage', status: 'skip', message: 'Cliente não configurado' };
  }
  const t0 = performance.now();
  try {
    const { error } = await supabase.storage.from('product-images').list('products', { limit: 1 });
    const latencyMs = Math.round(performance.now() - t0);
    if (!error) {
      return { name: 'Supabase Storage', status: 'ok', latencyMs };
    }
    return { name: 'Supabase Storage', status: 'degraded', latencyMs, message: error.message };
  } catch (e: any) {
    return { name: 'Supabase Storage', status: 'down', message: e.message };
  }
}

async function checkCriticalImage(): Promise<HealthCheck> {
  const CRITICAL_IMAGE = '/images/products/placeholder.webp';
  const t0 = performance.now();
  try {
    const res = await fetch(CRITICAL_IMAGE, { method: 'HEAD' });
    const latencyMs = Math.round(performance.now() - t0);
    if (res.ok) {
      return { name: 'Imagem Placeholder', status: 'ok', latencyMs };
    }
    return {
      name: 'Imagem Placeholder',
      status: 'down',
      latencyMs,
      message: `HTTP ${res.status} para ${CRITICAL_IMAGE}`,
    };
  } catch (e: any) {
    return { name: 'Imagem Placeholder', status: 'down', message: e.message };
  }
}

async function checkAnalytics(): Promise<HealthCheck> {
  if (!supabase) {
    return { name: 'Analytics (Supabase)', status: 'skip', message: 'Cliente não configurado' };
  }
  const t0 = performance.now();
  try {
    const { error } = await supabase
      .from('analytics_events')
      .select('id')
      .limit(1)
      .single();
    const latencyMs = Math.round(performance.now() - t0);
    if (!error || error.code === 'PGRST116') {
      return { name: 'Analytics (Supabase)', status: 'ok', latencyMs };
    }
    return { name: 'Analytics (Supabase)', status: 'degraded', latencyMs, message: error.message };
  } catch (e: any) {
    return { name: 'Analytics (Supabase)', status: 'down', message: e.message };
  }
}

function checkLocalStorage(): HealthCheck {
  try {
    const key = '__mdi_health_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return { name: 'LocalStorage', status: 'ok' };
  } catch {
    return { name: 'LocalStorage', status: 'down', message: 'Acesso negado ou storage cheio' };
  }
}

function checkNetworkOnline(): HealthCheck {
  const online = typeof navigator !== 'undefined' && navigator.onLine;
  return {
    name: 'Conexão de Rede',
    status: online ? 'ok' : 'down',
    message: online ? undefined : 'navigator.onLine = false',
  };
}

// ── Aggregate ─────────────────────────────────────────────────────────────────

function aggregateStatus(checks: HealthCheck[]): CheckStatus {
  if (checks.some(c => c.status === 'down')) return 'down';
  if (checks.some(c => c.status === 'degraded')) return 'degraded';
  if (checks.every(c => c.status === 'skip')) return 'skip';
  return 'ok';
}

export async function runHealthCheck(timeout = 8000): Promise<HealthReport> {
  const withTimeout = <T>(promise: Promise<T>, fallback: T): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>(resolve => setTimeout(() => resolve(fallback), timeout)),
    ]);

  const [db, storage, image, analytics] = await Promise.all([
    withTimeout(checkSupabaseDB(), { name: 'Supabase DB', status: 'down' as CheckStatus, message: 'Timeout' }),
    withTimeout(checkSupabaseStorage(), { name: 'Supabase Storage', status: 'down' as CheckStatus, message: 'Timeout' }),
    withTimeout(checkCriticalImage(), { name: 'Imagem Placeholder', status: 'down' as CheckStatus, message: 'Timeout' }),
    withTimeout(checkAnalytics(), { name: 'Analytics', status: 'down' as CheckStatus, message: 'Timeout' }),
  ]);

  const network = checkNetworkOnline();
  const ls = checkLocalStorage();

  const checks: HealthCheck[] = [network, db, storage, image, analytics, ls];

  return {
    overall: aggregateStatus(checks),
    checkedAt: new Date().toISOString(),
    checks,
  };
}

export function statusColor(status: CheckStatus): string {
  return { ok: '#22c55e', degraded: '#f59e0b', down: '#ef4444', skip: '#94a3b8' }[status];
}

export function statusLabel(status: CheckStatus): string {
  return { ok: 'Online', degraded: 'Degradado', down: 'Offline', skip: 'Ignorado' }[status];
}
