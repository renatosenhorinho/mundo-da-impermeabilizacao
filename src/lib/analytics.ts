// =============================================================================
// MDI SMART CRM ENGINE — v6.0
// Decision Engine | Recommended Action | Confidence Floor
// =============================================================================

import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  id: string;
  type:
    | 'click' | 'pageview' | 'scroll' | 'product_click'
    | 'time_on_page' | 'whatsapp_click' | 'view_whatsapp_button'
    | 'whatsapp_returned' | 'heartbeat' | string;
  page: string;
  x?: number;
  y?: number;
  target?: string;
  product?: string;
  label?: string;
  scrollPercentage?: number;
  duration?: number;
  sessionId: string;
  device: 'mobile' | 'desktop';
  viewportWidth: number;
  timestamp: number;
}

export interface TimelineEvent {
  event_type: string;
  timestamp: number;
  page_url: string;
  product?: string;
}

export interface BehavioralMetrics {
  time_on_page: number;
  scroll_depth: number;
  pages_visited: number;
  utm_data: Record<string, string>;
  device: 'mobile' | 'desktop';
  entry_time: number;
  last_active: number;
  session_status: 'active' | 'idle' | 'ended';
}

export interface LeadScoreBreakdown {
  interaction_score: number;
  attribution_score: number;
  recency_multiplier: number;
  total: number;
}

export interface ScoreHistoryEntry {
  score: number;
  timestamp: number;
  trigger_event: string;
  score_delta: number;
}

export interface LeadAttribution {
  first_touch_score: number;
  last_touch_score: number;
  journey_score: number;
}

export interface Lead {
  id?: string;
  product_name: string;
  page: string;
  session_id: string;
  status?: 'novo' | 'em_atendimento' | 'convertido' | 'perdido';
  notes?: string;
  behavioral_metrics?: BehavioralMetrics;
  lead_score?: number;
  lead_stage?: 'frio' | 'morno' | 'quente';
  lead_confidence?: number;
  purchase_intent?: 'exploration' | 'comparison' | 'purchase';
  recommended_action?: 'chamar_agora' | 'prioridade_alta' | 'nutrir_lead' | 'aguardar';
  lead_timeline?: TimelineEvent[];
  score_breakdown?: LeadScoreBreakdown;
  score_history?: ScoreHistoryEntry[];
  attribution?: LeadAttribution;
  human_summary?: string;
  converted?: boolean;
  conversion_value?: number;
  conversion_date?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY     = 'mdi_analytics_events';
const LEADS_KEY       = 'mdi_leads';
const SESSION_KEY     = 'mdi_session_id';
const UTM_KEY         = 'mdi_utms';
const BEHAVIOR_KEY    = 'mdi_behavior';
const TIMELINE_KEY    = 'mdi_timeline';
const LAST_ACTIVE_KEY = 'mdi_last_active';

const LEAD_COOLDOWN_MS  = 10 * 60 * 1000;
const MAX_EVENTS        = 10000;
const HEARTBEAT_MS      = 20_000;
const IDLE_THRESHOLD_MS = 60_000;
const END_THRESHOLD_MS  = 3 * 60_000;
const BATCH_SIZE        = 15;
const BATCH_INTERVAL_MS = 4_000;

// ─── Listeners (for hot-lead alerts) ─────────────────────────────────────────

type HotLeadListener = (lead: Lead) => void;
const hotLeadListeners = new Set<HotLeadListener>();
export const onHotLead = (fn: HotLeadListener) => {
  hotLeadListeners.add(fn);
  return () => hotLeadListeners.delete(fn);
};
const emitHotLead = (lead: Lead) => hotLeadListeners.forEach(fn => fn(lead));

// ─── Session & Device ─────────────────────────────────────────────────────────

export const getSessionId = (): string => {
  if (typeof window === 'undefined') return 'server';
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
};

const getDevice = (): 'mobile' | 'desktop' =>
  typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop';

// ─── UTM Capture ─────────────────────────────────────────────────────────────

export const captureUTMs = () => {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const utms: Record<string, string> = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(key => {
    if (params.has(key)) utms[key] = params.get(key)!;
  });
  if (Object.keys(utms).length > 0) localStorage.setItem(UTM_KEY, JSON.stringify(utms));
};

export const getUTMs = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(UTM_KEY) || '{}'); }
  catch { return {}; }
};

// ─── Behavioral Session ───────────────────────────────────────────────────────

interface SessionBehavior {
  entry_time: number;
  max_scroll: number;
  pages_visited: string[];
  last_active: number;
  session_status: 'active' | 'idle' | 'ended';
}

const getBehavior = (): SessionBehavior => {
  try {
    const data = localStorage.getItem(BEHAVIOR_KEY);
    if (data) return JSON.parse(data);
  } catch {}
  const fresh: SessionBehavior = {
    entry_time: Date.now(),
    max_scroll: 0,
    pages_visited: [window.location.pathname],
    last_active: Date.now(),
    session_status: 'active'
  };
  localStorage.setItem(BEHAVIOR_KEY, JSON.stringify(fresh));
  return fresh;
};

const updateBehavior = (patch: Partial<SessionBehavior>) => {
  const current = getBehavior();
  localStorage.setItem(BEHAVIOR_KEY, JSON.stringify({ ...current, ...patch }));
};

const touchActivity = () => {
  const now = Date.now();
  localStorage.setItem(LAST_ACTIVE_KEY, String(now));
  updateBehavior({ last_active: now, session_status: 'active' });
};

const getSessionStatus = (): 'active' | 'idle' | 'ended' => {
  const lastRaw = localStorage.getItem(LAST_ACTIVE_KEY);
  const last = lastRaw ? Number(lastRaw) : Date.now();
  const delta = Date.now() - last;
  if (delta >= END_THRESHOLD_MS) return 'ended';
  if (delta >= IDLE_THRESHOLD_MS) return 'idle';
  return 'active';
};

const trackPageVisit = (page: string) => {
  const behavior = getBehavior();
  if (!behavior.pages_visited.includes(page)) {
    behavior.pages_visited.push(page);
    updateBehavior({ pages_visited: behavior.pages_visited });
  }
};

const updateMaxScroll = (pct: number) => {
  const behavior = getBehavior();
  if (pct > behavior.max_scroll) updateBehavior({ max_scroll: pct });
};

// ─── Timeline ─────────────────────────────────────────────────────────────────

const getTimeline = (): TimelineEvent[] => {
  try { return JSON.parse(localStorage.getItem(TIMELINE_KEY) || '[]'); }
  catch { return []; }
};

const pushTimeline = (event: TimelineEvent) => {
  const timeline = getTimeline();
  timeline.push(event);
  // Keep last 200 events
  if (timeline.length > 200) timeline.splice(0, timeline.length - 200);
  localStorage.setItem(TIMELINE_KEY, JSON.stringify(timeline));
};

// ─── Multi-Touch Attribution & Intent ──────────────────────────────────────────

const getDampenedScore = (count: number, baseValue: number): number => {
  let score = 0;
  for (let i = 0; i < count; i++) {
    if (i === 0) score += baseValue;
    else if (i === 1) score += baseValue * 0.5;
    else if (i === 2) score += baseValue * 0.25;
    else score += baseValue * 0.1;
  }
  return score;
};

const buildAttribution = (
  behavior: SessionBehavior,
  utms: Record<string, string>,
  timeOnPage: number,
  waClicks: number,
  timeline: TimelineEvent[]
): LeadAttribution => {
  // first_touch: score based only on first event context (UTM + device)
  const first_touch_score = Object.keys(utms).length > 0 ? 10 : 5;

  // last_touch: score based on the trigger that fired this save
  let last_touch_score = 10; // base WA click
  if (timeOnPage > 30) last_touch_score += 5;
  if (behavior.max_scroll >= 70) last_touch_score += 5;

  // journey_score: aggregate of entire session behaviour (with event dampening)
  let journey_score = getDampenedScore(waClicks, 10);
  
  // Dampen multiple page visits
  journey_score += getDampenedScore(behavior.pages_visited.length, 3);
  
  if (timeOnPage > 90) journey_score += 5;
  if (timeline.length >= 10) journey_score += 3;

  return { first_touch_score, last_touch_score, journey_score };
};

export const classifyPurchaseIntent = (
  behavior: SessionBehavior,
  timeOnPage: number,
  waClicks: number
): 'exploration' | 'comparison' | 'purchase' => {
  if (waClicks > 0 && timeOnPage < 180) return 'purchase';
  if (waClicks > 0) return 'purchase';
  if (behavior.pages_visited.length > 1 && timeOnPage > 60) return 'comparison';
  return 'exploration';
};

export const calculateLeadConfidence = (
  timeline: TimelineEvent[],
  timeOnPage: number,
  behavior: SessionBehavior,
  intent: 'exploration' | 'comparison' | 'purchase',
  waClicks: number
): number => {
  let conf = 0;
  
  // Quantidade de eventos
  if (timeline.length > 20) conf += 40;
  else if (timeline.length > 5) conf += 20;
  else conf += 5;

  // Duração (tempo ativo real)
  if (timeOnPage > 120) conf += 30;
  else if (timeOnPage > 30) conf += 15;
  else if (timeOnPage < 10) conf -= 20; // Reduce confidence if session is very short
  
  // Variedade e consistência
  if (behavior.max_scroll > 30) conf += 10;
  if (behavior.pages_visited.length > 1) conf += 10;
  if (timeline.some(t => t.event_type.includes('click') && !t.event_type.includes('whatsapp'))) conf += 10;
  
  // Confidence Floor for high intent
  if (intent === 'purchase' && waClicks > 0) {
    if (conf < 60) conf = 60;
  }
  
  return Math.min(100, Math.max(0, conf));
};

export const determineRecommendedAction = (
  score: number,
  intent: 'exploration' | 'comparison' | 'purchase',
  confidence: number
): 'chamar_agora' | 'prioridade_alta' | 'nutrir_lead' | 'aguardar' => {
  if (score >= 21 && intent === 'purchase' && confidence >= 60) return 'chamar_agora';
  if (score >= 18 && intent === 'comparison' && confidence >= 50) return 'prioridade_alta';
  if (intent === 'exploration' && score >= 8 && score <= 18) return 'nutrir_lead';
  if (score < 8 || confidence < 40) return 'aguardar';
  return 'nutrir_lead'; // Fallback
};

export const calculateLeadScore = (
  behavior: SessionBehavior,
  utms: Record<string, string>,
  timeOnPageSeconds: number,
  waClicks: number = 1,
  timeline: TimelineEvent[] = []
): LeadScoreBreakdown => {
  const attr = buildAttribution(behavior, utms, timeOnPageSeconds, waClicks, timeline);

  // Multi-touch weighted formula
  const attributionWeighted = Math.round(
    (attr.journey_score * 0.6) +
    (attr.last_touch_score * 0.3) +
    (attr.first_touch_score * 0.1)
  );

  // UTM bonus
  let attrBonus = 0;
  if (Object.keys(utms).length > 0) attrBonus += 5;
  if (utms.utm_source === 'google') attrBonus += 3;
  if (utms.utm_medium === 'cpc') attrBonus += 2;

  // Bounce penalty
  if (timeOnPageSeconds < 10) attrBonus -= 5;

  // Recency multiplier
  const msSince = Date.now() - (behavior.last_active || Date.now());
  const mins = msSince / 60_000;
  const recencyMultiplier = mins < 2 ? 1.5 : mins < 10 ? 1.2 : mins < 30 ? 1.0 : 0.7;

  const total = Math.max(0, Math.round((attributionWeighted + attrBonus) * recencyMultiplier));

  return {
    interaction_score: attr.journey_score,
    attribution_score: attrBonus,
    recency_multiplier: recencyMultiplier,
    total
  };
};

const getLeadStage = (score: number): 'frio' | 'morno' | 'quente' =>
  score >= 21 ? 'quente' : score >= 11 ? 'morno' : 'frio';

// ─── Human Summary Generator ──────────────────────────────────────────────────

const generateHumanSummary = (
  product: string,
  behavior: SessionBehavior,
  utms: Record<string, string>,
  timeOnPage: number,
  stage: 'frio' | 'morno' | 'quente',
  timeline: TimelineEvent[]
): string => {
  const parts: string[] = [];

  // Produto
  parts.push(`Interesse em: "${product}".`);

  // Tempo
  if (timeOnPage >= 60) parts.push(`Permaneceu ${Math.round(timeOnPage/60)} min na página.`);
  else if (timeOnPage >= 30) parts.push(`Permaneceu ${timeOnPage}s — engajamento sólido.`);
  else if (timeOnPage < 10) parts.push(`Saiu em menos de 10s — lead frio.`);

  // Scroll
  if (behavior.max_scroll >= 80) parts.push(`Leu praticamente tudo (${behavior.max_scroll}% scroll).`);
  else if (behavior.max_scroll >= 50) parts.push(`Scrollou ${behavior.max_scroll}% da página.`);

  // Páginas
  if (behavior.pages_visited.length >= 4) parts.push(`Navegou por ${behavior.pages_visited.length} páginas — exploração profunda.`);
  else if (behavior.pages_visited.length >= 2) parts.push(`Visitou ${behavior.pages_visited.length} páginas na sessão.`);

  // UTM
  if (utms.utm_source) parts.push(`Veio via ${utms.utm_source}${utms.utm_campaign ? ` (campanha: ${utms.utm_campaign})` : ''}.`);

  // Timeline riqueza
  const waReturns = timeline.filter(e => e.event_type === 'whatsapp_returned').length;
  if (waReturns > 0) parts.push(`Retornou ao site após abrir o WhatsApp.`);

  // Stage
  const stageLabel = stage === 'quente' ? '🔥 Alta intenção de compra.' : stage === 'morno' ? '⚡ Interesse moderado — vale abordar.' : '❄️ Lead frio — monitorar.';
  parts.push(stageLabel);

  return parts.join(' ');
};

// ─── Analytics Events ─────────────────────────────────────────────────────────

export const getAnalyticsEvents = (): AnalyticsEvent[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
};

export const saveAnalyticsEvent = (
  event: Omit<AnalyticsEvent, 'id' | 'sessionId' | 'device' | 'viewportWidth' | 'timestamp'>
) => {
  try {
    if (typeof window === 'undefined') return;
    const events = getAnalyticsEvents();
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS / 2);

    const sessionId = getSessionId();
    const now = Date.now();
    const bucket = Math.floor(now / 60000); // 60s bucket
    const eventHash = `${sessionId}|${event.type}|${bucket}|${event.page}|${event.product || ''}`;

    // ─── Event Deduplication / Anti-Spam ───
    const isSpam = events.some(e => {
      if (now - e.timestamp > 120000) return false;
      const eBucket = Math.floor(e.timestamp / 60000);
      const eHash = `${e.sessionId}|${e.type}|${eBucket}|${e.page}|${e.product || ''}`;
      return eHash === eventHash;
    });

    if (isSpam) return;

    const newEvent = {
      ...event,
      id: Math.random().toString(36).substring(2, 15),
      sessionId,
      device: getDevice(),
      viewportWidth: window.innerWidth,
      timestamp: now,
      event_hash: eventHash // Save for auditing
    };
    events.push(newEvent);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    
    // Add to batch queue for async Supabase insertion
    if (event.type !== 'heartbeat') {
      enqueueAnalyticsEvent({
        event_type: newEvent.type,
        page_url: newEvent.page,
        session_id: newEvent.sessionId,
        device: newEvent.device,
        event_data: { 
          x: newEvent.x, y: newEvent.y, target: newEvent.target, 
          product: newEvent.product, duration: newEvent.duration, 
          scroll: newEvent.scrollPercentage 
        }
      });
    }

    // Push to timeline (skip heartbeats for brevity)
    if (event.type !== 'heartbeat') {
      pushTimeline({
        event_type: event.type,
        timestamp: Date.now(),
        page_url: event.page,
        product: event.product
      });
    }
  } catch (e) {
    console.error('Analytics event failed', e);
  }
};

// ─── Local Lead Store ─────────────────────────────────────────────────────────

export const getLocalLeads = (): Lead[] => {
  try { return JSON.parse(localStorage.getItem(LEADS_KEY) || '[]'); }
  catch { return []; }
};

const saveLocalLeads = (leads: Lead[]) => {
  try { localStorage.setItem(LEADS_KEY, JSON.stringify(leads)); }
  catch {}
};

// ─── Deduplication ────────────────────────────────────────────────────────────

const isDuplicate = (leads: Lead[], sessionId: string, productName: string): Lead | null => {
  const now = Date.now();
  return leads.find(l => {
    if (l.session_id !== sessionId || l.product_name !== productName) return false;
    return now - new Date(l.created_at || 0).getTime() < LEAD_COOLDOWN_MS;
  }) ?? null;
};

// ─── Batch Event Queue ────────────────────────────────────────────────────────

const BATCH_QUEUE_KEY = 'mdi_batch_queue';
let batchTimer: ReturnType<typeof setTimeout> | null = null;

const getBatchQueue = (): any[] => {
  try { return JSON.parse(localStorage.getItem(BATCH_QUEUE_KEY) || '[]'); }
  catch { return []; }
};

const flushBatchToSupabase = async () => {
  if (!supabase) return;
  const queue = getBatchQueue();
  if (queue.length === 0) return;
  // Take up to BATCH_SIZE events
  const batch = queue.splice(0, BATCH_SIZE);
  try {
    await supabase.from('analytics_events').insert(batch);
    localStorage.setItem(BATCH_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Requeue on failure — data preserved in localStorage
    localStorage.setItem(BATCH_QUEUE_KEY, JSON.stringify([...batch, ...queue]));
  }
};

function enqueueAnalyticsEvent(eventPayload: any) {
  try {
    const queue = getBatchQueue();
    queue.push(eventPayload);
    if (queue.length > 2000) queue.splice(0, queue.length - 2000);
    localStorage.setItem(BATCH_QUEUE_KEY, JSON.stringify(queue));
    // Schedule flush
    if (batchTimer) clearTimeout(batchTimer);
    batchTimer = setTimeout(flushBatchToSupabase, BATCH_INTERVAL_MS);
  } catch {}
};

// ─── saveLead — Main Entry Point ──────────────────────────────────────────────

export const saveLead = async (product_name: string, page: string): Promise<void> => {
  queueMicrotask(async () => {
    try {
      const sessionId = getSessionId();
      const utms = getUTMs();
      const behavior = getBehavior();
      const timeOnPage = Math.round((Date.now() - pageEntryTime) / 1000);
      const leads = getLocalLeads();
      const timeline = getTimeline();

      const waClicks = leads.filter(l =>
        l.session_id === sessionId &&
        Date.now() - new Date(l.created_at || 0).getTime() < END_THRESHOLD_MS
      ).length + 1;

      const breakdown = calculateLeadScore(behavior, utms, timeOnPage, waClicks, timeline);
      const stage = getLeadStage(breakdown.total);
      const humanSummary = generateHumanSummary(product_name, behavior, utms, timeOnPage, stage, timeline);
      const attribution = buildAttribution(behavior, utms, timeOnPage, waClicks, timeline);
      const intent = classifyPurchaseIntent(behavior, timeOnPage, waClicks);
      const confidence = calculateLeadConfidence(timeline, timeOnPage, behavior, intent, waClicks);
      const recAction = determineRecommendedAction(breakdown.total, intent, confidence);

      const behavioralMetrics: BehavioralMetrics = {
        time_on_page: timeOnPage,
        scroll_depth: behavior.max_scroll,
        pages_visited: behavior.pages_visited.length,
        utm_data: utms,
        device: getDevice(),
        entry_time: behavior.entry_time,
        last_active: behavior.last_active,
        session_status: getSessionStatus()
      };

      const hasUtms = Object.keys(utms).length > 0;
      const notesStr = [
        hasUtms ? `UTM: ${JSON.stringify(utms)}` : null,
        `Score: ${breakdown.total}`,
        `Estágio: ${stage}`
      ].filter(Boolean).join(' | ');

      // ── Deduplication ──
      const existing = isDuplicate(leads, sessionId, product_name);
      const now = new Date().toISOString();

      if (existing) {
        const prevScore = existing.lead_score || 0;
        const scoreDelta = breakdown.total - prevScore;
        const newHistoryEntry: ScoreHistoryEntry = {
          score: breakdown.total,
          timestamp: Date.now(),
          trigger_event: 'whatsapp_click',
          score_delta: scoreDelta
        };
        const updatedLead: Lead = {
          ...existing,
          lead_score: breakdown.total,
          lead_stage: stage,
          lead_confidence: confidence,
          purchase_intent: intent,
          recommended_action: recAction,
          behavioral_metrics: behavioralMetrics,
          lead_timeline: timeline,
          score_breakdown: breakdown,
          score_history: [...(existing.score_history || []), newHistoryEntry],
          attribution,
          human_summary: humanSummary,
          notes: notesStr,
          updated_at: now
        };
        saveLocalLeads(leads.map(l => l.id === existing.id ? updatedLead : l));
        if (prevScore < 21 && breakdown.total >= 21) emitHotLead(updatedLead);

        if (supabase && existing.id) {
          await supabase.from('leads').update({
            lead_score: breakdown.total,
            lead_stage: stage,
            lead_confidence: confidence,
            purchase_intent: intent,
            recommended_action: recAction,
            behavioral_metrics: behavioralMetrics,
            lead_timeline: timeline,
            score_history: updatedLead.score_history,
            attribution,
            human_summary: humanSummary,
            notes: notesStr,
            updated_at: now
          }).eq('id', existing.id);
        }
        return;
      }


      // ── New lead ──
      const initEntry: ScoreHistoryEntry = {
        score: breakdown.total,
        timestamp: Date.now(),
        trigger_event: 'whatsapp_click_first',
        score_delta: breakdown.total
      };
      const newLead: Lead = {
        id: crypto.randomUUID(),
        product_name,
        page,
        session_id: sessionId,
        status: 'novo',
        notes: notesStr,
        behavioral_metrics: behavioralMetrics,
        lead_timeline: timeline,
        score_breakdown: breakdown,
        score_history: [initEntry],
        attribution,
        human_summary: humanSummary,
        lead_score: breakdown.total,
        lead_stage: stage,
        lead_confidence: confidence,
        purchase_intent: intent,
        recommended_action: recAction,
        converted: false,
        created_at: now
      };

      saveLocalLeads([...leads, newLead]);
      if (stage === 'quente') emitHotLead(newLead);

      if (supabase) {
        await supabase.from('leads').insert([{
          id: newLead.id,
          product_name,
          page,
          session_id: sessionId,
          status: 'novo',
          notes: notesStr,
          behavioral_metrics: behavioralMetrics,
          lead_timeline: timeline,
          score_history: newLead.score_history,
          attribution: newLead.attribution,
          human_summary: newLead.human_summary,
          lead_score: breakdown.total,
          lead_stage: stage,
          lead_confidence: confidence,
          purchase_intent: intent,
          recommended_action: recAction,
          converted: false
        }]);
      }
    } catch (e) {
      console.error('saveLead failed', e);
    }
  });
};

// ─── Recalculate Score for Session (called from dashboard) ───────────────────

export const recalculateLeadScore = (sessionId: string): void => {
  try {
    const leads = getLocalLeads();
    const lead = leads.find(l => l.session_id === sessionId);
    if (!lead) return;

    const behavior = getBehavior();
    const utms = getUTMs();
    const waClicks = leads.filter(l => l.session_id === sessionId).length;
    const breakdown = calculateLeadScore(behavior, utms, 0, waClicks);
    const stage = getLeadStage(breakdown.total);

    saveLocalLeads(leads.map(l =>
      l.session_id === sessionId
        ? { ...l, lead_score: breakdown.total, lead_stage: stage, score_breakdown: breakdown, updated_at: new Date().toISOString() }
        : l
    ));
  } catch {}
};

// ─── Conversion Update ────────────────────────────────────────────────────────

export const markLeadConverted = async (leadId: string, value?: number): Promise<void> => {
  const leads = getLocalLeads();
  const now = new Date().toISOString();
  const updated = leads.map(l =>
    l.id === leadId
      ? { ...l, converted: true, conversion_value: value ?? 0, conversion_date: now, status: 'convertido' as const, updated_at: now }
      : l
  );
  saveLocalLeads(updated);

  if (supabase) {
    await supabase.from('leads').update({
      converted: true,
      conversion_value: value ?? 0,
      conversion_date: now,
      status: 'convertido',
      updated_at: now
    }).eq('id', leadId);
  }
};

// ─── Heartbeat System ─────────────────────────────────────────────────────────

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

const startHeartbeat = () => {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    if (typeof window === 'undefined') return;
    touchActivity();
    saveAnalyticsEvent({ type: 'heartbeat', page: window.location.pathname });
    updateBehavior({ session_status: getSessionStatus() });
  }, HEARTBEAT_MS);
};

// ─── WhatsApp Return Detection ────────────────────────────────────────────────

let wasHidden = false;

const initWhatsAppReturnDetection = () => {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      wasHidden = true;
    } else if (wasHidden) {
      wasHidden = false;
      const lastWaPage = localStorage.getItem('mdi_last_wa_page');
      if (lastWaPage) {
        saveAnalyticsEvent({ type: 'whatsapp_returned', page: window.location.pathname, label: lastWaPage });
        localStorage.removeItem('mdi_last_wa_page');
      }
    }
  });
};

// ─── Throttle ─────────────────────────────────────────────────────────────────

function throttle<T extends (...args: any[]) => any>(func: T, limit: number): T {
  let inThrottle: boolean;
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  } as T;
}

// Debounce for quick-fire events
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), wait);
  } as T;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

let isInitialized = false;
let pageEntryTime = Date.now();

const trackTimeOnPage = (pageName: string) => {
  const duration = Math.round((Date.now() - pageEntryTime) / 1000);
  if (duration > 0) saveAnalyticsEvent({ type: 'time_on_page', page: pageName, duration });
  pageEntryTime = Date.now();
};

export const initAnalytics = () => {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  captureUTMs();
  trackPageVisit(window.location.pathname);
  touchActivity();
  startHeartbeat();
  initWhatsAppReturnDetection();

  saveAnalyticsEvent({ type: 'pageview', page: window.location.pathname });

  // Clicks
  window.addEventListener('click', throttle((e: MouseEvent) => {
    if (window.location.pathname.startsWith('/admin')) return;
    touchActivity();

    const target = e.target as HTMLElement;
    let curr: HTMLElement | null = target;
    let trackData: Record<string, string> | null = null;
    let productClick: string | null = null;

    while (curr && curr !== document.body) {
      if (curr.getAttribute('data-track') === 'true') {
        trackData = {
          type: curr.getAttribute('data-type') || 'click',
          name: curr.getAttribute('data-name') || curr.innerText?.trim().substring(0, 50) || 'Element'
        };
      }
      if (!productClick) productClick = curr.getAttribute('data-product-slug');
      curr = curr.parentElement;
    }

    if (trackData) {
      saveAnalyticsEvent({
        type: trackData.type as any,
        page: window.location.pathname,
        label: trackData.name,
        product: productClick || undefined,
        x: e.pageX, y: e.pageY
      });

      if (trackData.type === 'whatsapp_click') {
        localStorage.setItem('mdi_last_wa_page', window.location.pathname);
        saveLead(productClick || 'Genérico', window.location.pathname);
      }
      return;
    }

    if (productClick) {
      saveAnalyticsEvent({ type: 'product_click', page: window.location.pathname, product: productClick, x: e.pageX, y: e.pageY });
      return;
    }

    let targetName = target.tagName.toLowerCase();
    if (target.id) targetName += `#${target.id}`;
    saveAnalyticsEvent({ type: 'click', page: window.location.pathname, target: targetName.substring(0, 50), x: e.pageX, y: e.pageY });
  }, 100));

  // Scroll — debounced for perf
  let maxScrollTracked = 0;
  window.addEventListener('scroll', debounce(() => {
    if (window.location.pathname.startsWith('/admin')) return;
    const docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const winH = window.innerHeight;
    const scrollH = docH - winH;
    const scrollTop = window.scrollY || 0;
    const pct = scrollH > 0 ? Math.min(100, Math.round((scrollTop / scrollH) * 100)) : 100;

    updateMaxScroll(pct);

    for (const t of [25, 50, 75, 100]) {
      if (pct >= t && maxScrollTracked < t) {
        maxScrollTracked = t;
        saveAnalyticsEvent({ type: 'scroll', page: window.location.pathname, scrollPercentage: t });
      }
    }
  }, 400));

  // User activity touch
  ['mousemove', 'keydown', 'touchstart'].forEach(evt =>
    window.addEventListener(evt, debounce(touchActivity, 500), { passive: true })
  );

  // SPA navigation
  const origPushState = history.pushState.bind(history);
  history.pushState = function(...args: any[]) {
    const oldPath = window.location.pathname;
    origPushState(...args);
    if (oldPath !== window.location.pathname) {
      trackTimeOnPage(oldPath);
      requestIdleCallback(() => {
        trackPageVisit(window.location.pathname);
        saveAnalyticsEvent({ type: 'pageview', page: window.location.pathname });
      });
    }
  };

  window.addEventListener('popstate', () => {
    trackTimeOnPage(window.location.pathname);
    requestIdleCallback(() => {
      trackPageVisit(window.location.pathname);
      saveAnalyticsEvent({ type: 'pageview', page: window.location.pathname });
    });
  });

  window.addEventListener('beforeunload', () => {
    trackTimeOnPage(window.location.pathname);
    updateBehavior({ session_status: 'ended' });
  });
};
