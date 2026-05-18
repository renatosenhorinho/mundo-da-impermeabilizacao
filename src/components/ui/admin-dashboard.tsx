import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  getAnalyticsEvents, AnalyticsEvent, getLocalLeads, Lead,
  BehavioralMetrics, onHotLead, markLeadConverted, LeadScoreBreakdown
} from '@/lib/analytics';
import { products, Product, saveCustomProducts, CATEGORIAS, generateSlug } from '@/data/products';
import { normalizeBrandName } from '@/constants/brands';
import {
  productsStore,
  revalidateProducts,
  saveProductToSupabase,
  invalidateProductsCache,
  fetchProducts,
  fetchAllProductsForAdmin,
  invalidateAdminCache,
  removeProductFromAdminCache,
  patchProductInAdminCache,
} from '@/lib/products-service';
import { taxonomyStore, addTaxonomyItem, removeTaxonomyItem, syncProductTaxonomies } from '@/lib/taxonomy-service';
import { getBrands, deleteBrand, mergeBrands } from '@/lib/brands-service';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { MAX_DESTAQUE } from '@/config/constants';
import { DateRangeSelector, DateRangePresets } from '@/components/ui/date-range-selector';
import { ManageBrandsModal } from '@/components/ui/manage-brands-modal';
import { NormalizeBrandsModal } from '@/components/ui/normalize-brands-modal';
import {
  DateRangeState,
  filterEventsByDateRange,
  formatRelativeDate,
  nowISO,
} from '@/utils/dateUtils';

type Tab = 'dashboard' | 'catalogo' | 'heatmap' | 'produtos' | 'paginas' | 'conversao' | 'sessoes' | 'sistema';

interface AdminLogEntry {
  id: string;
  action: string;
  detail: string;
  at: string;
}

interface Insight {
  id: string;
  type: 'danger' | 'warning' | 'success' | 'info';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  action: string;
}

const renewSession = () => {
  try {
    const rawSession = localStorage.getItem("mdi_admin_session");
    if (rawSession) {
      const session = JSON.parse(rawSession);
      if (session?.value) {
        session.expiresAt = Date.now() + 1000 * 60 * 60 * 6; // Renova por +6h
        localStorage.setItem("mdi_admin_session", JSON.stringify(session));
      }
    }
  } catch (e) {
    // Silencia erros de parse
  }
};

/** Hard limit pós-compressão — rejeita se ainda passar disto */
const SIZE_HARD_CAP = 512_000; // 500 KB

/**
 * compressToBlob — pipeline zero-base64:
 *   1. Lê o arquivo via URL.createObjectURL (sem FileReader)
 *   2. Redimensiona via canvas (max 800×800)
 *   3. Exporta como Blob WebP via canvas.toBlob (sem toDataURL)
 *   4. Retorna { blob, previewUrl } — previewUrl é um ObjectURL temporário
 */
const compressToBlob = (file: File): Promise<{ blob: Blob; previewUrl: string }> => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = objectUrl;
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Falha ao comprimir imagem.'));
            return;
          }
          const previewUrl = URL.createObjectURL(blob);
          resolve({ blob, previewUrl });
        },
        'image/webp',
        0.8
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Formato de imagem não suportado.'));
    };
  });
};

export const AdminDashboard: React.FC = () => {
  const [systemError, setSystemError] = useState('');

  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [leadNoteDraft, setLeadNoteDraft] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Filtro global de período — persiste ao trocar de aba
  const [dateRange, setDateRange] = useState<DateRangeState>({ key: '30d' });

  // Filters State for CRM
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState<'todos' | Lead['status']>('todos');
  const [leadStageFilter, setLeadStageFilter] = useState<'todos' | 'frio' | 'morno' | 'quente'>('todos');
  const [leadSortOrder, setLeadSortOrder] = useState<'recentes' | 'antigos' | 'score'>('recentes');

  // CMS State
  const [catalogItems, setCatalogItems] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [saveToast, setSaveToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogBrandFilter, setCatalogBrandFilter] = useState('todas');
  const [catalogFeatureFilter, setCatalogFeatureFilter] = useState<'todos' | 'destaques'>('todos');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [catalogSort, setCatalogSort] = useState<'recentes' | 'nome' | 'destaque'>('recentes');
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState<string | null>(null);
  const [hotLeadAlert, setHotLeadAlert] = useState<Lead | null>(null);
  const [conversionModalId, setConversionModalId] = useState<string | null>(null);
  const [conversionValue, setConversionValue] = useState('');
  // Hardening extras
  const [showTrash, setShowTrash] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('mdi_maintenance') === 'true'; } catch { return false; }
  });
  const [adminLog, setAdminLog] = useState<AdminLogEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('mdi_admin_log') || '[]'); } catch { return []; }
  });
  const [healthReport, setHealthReport] = useState<import('@/lib/health-check').HealthReport | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [modalTab, setModalTab] = useState<'basico' | 'conteudo' | 'preview'>('basico');
  const [specsInput, setSpecsInput] = useState<{key: string; val: string}[]>([{key: '', val: ''}]);
  const [comoUsarInput, setComoUsarInput] = useState<string[]>(['']);
  const [aplicacaoInput, setAplicacaoInput] = useState<string[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  // Custom categories: extends CATEGORIAS without mutating it
  const [customCategories, setCustomCategories] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('mdi_custom_categories') || '{}'); } catch { return {}; }
  });
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    catalogItems.forEach(p => {
      if (p.marca) brands.add(normalizeBrandName(p.marca));
    });
    return Array.from(brands).sort();
  }, [catalogItems]);

  const [newBrandInput, setNewBrandInput] = useState('');
  const [showNewBrandInput, setShowNewBrandInput] = useState(false);
  const [showManageBrandsModal, setShowManageBrandsModal] = useState(false);
  const [showNormalizeBrandsModal, setShowNormalizeBrandsModal] = useState(false);

  // Taxonomy logic via service
  const taxonomy = React.useSyncExternalStore(taxonomyStore.subscribe, taxonomyStore.getSnapshot);
  const TIPO_OPTS = useMemo(() => taxonomy.filter(t => t.group_name === 'TIPO').map(t => t.label), [taxonomy]);
  const APLICACAO_OPTS = useMemo(() => taxonomy.filter(t => t.group_name === 'APLICACAO').map(t => t.label), [taxonomy]);

  const [tipoInput, setTipoInput] = useState<string[]>([]);
  const [customTipoOpts, setCustomTipoOpts] = useState<string[]>([]);
  const [newTipoOpt, setNewTipoOpt] = useState('');

  const [customAplicacaoOpts, setCustomAplicacaoOpts] = useState<string[]>([]);
  const [newAplicacaoOpt, setNewAplicacaoOpt] = useState('');

  // Hot Lead Alert listener
  useEffect(() => {
    const unsub = onHotLead((lead) => {
      setHotLeadAlert(lead);
      setTimeout(() => setHotLeadAlert(null), 8000);
    });
    return unsub;
  }, []);

  useEffect(() => {
    // Component is protected, so we assume auth is valid here
    setEvents(getAnalyticsEvents());
      // Initialise: Admin must see ALL products (active + inactive)
      fetchAllProductsForAdmin().then(all => {
        setCatalogItems(all);
      }).catch(console.error);

      // Load Leads
      const fetchLeads = async () => {
        if (!supabase) {
          setLeads(getLocalLeads());
          return;
        }
        try {
          const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
          if (!error && data) {
            setLeads(data);
            localStorage.setItem('mdi_leads', JSON.stringify(data)); // Sync fallback
          } else {
            setLeads(getLocalLeads());
          }
        } catch (e) {
          setLeads(getLocalLeads());
        }
      };
      fetchLeads();
  }, []);

  // Renovar sessão automaticamente quando o admin interage
  useEffect(() => {
    
    // Throttle para evitar escritas excessivas no localStorage
    let throttleTimer: any = null;
    const handleInteraction = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        renewSession();
        throttleTimer = null;
      }, 60000); // Limita a 1 gravação por minuto
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        renewSession();
      }
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, []);

  const { signOut } = useAuth();
  const handleLogout = async () => {
    await signOut();
  };

  const toggleHeatmap = () => {
    if (sessionStorage.getItem('mdi_show_heatmap') === 'true') {
      sessionStorage.removeItem('mdi_show_heatmap');
      alert('Mapa de calor desativado.');
    } else {
      sessionStorage.setItem('mdi_show_heatmap', 'true');
      window.location.href = '/';
    }
  };

  const isHeatmapActive = typeof window !== 'undefined' && sessionStorage.getItem('mdi_show_heatmap') === 'true';

  // ----------------------------------------------------
  // INTELLIGENCE & METRICS CALCULATIONS
  // ----------------------------------------------------
  // Eventos filtrados pelo período selecionado
  const filteredEvents = useMemo(
    () => filterEventsByDateRange(events, dateRange),
    [events, dateRange]
  );

  const metrics = useMemo(() => {
    const pageviews = filteredEvents.filter(e => e.type === 'pageview');
    const clicks = filteredEvents.filter(e => e.type === 'click');
    const productClicks = filteredEvents.filter(e => e.type === 'product_click');
    const whatsappClicks = filteredEvents.filter(e => e.type === 'whatsapp_click');
    const timeEvents = filteredEvents.filter(e => e.type === 'time_on_page');

    // Unique Sessions
    const uniqueSessions = new Set(events.map(e => e.sessionId)).size;

    // Mobile vs Desktop
    const mobileCount = events.filter(e => e.type === 'pageview' && e.device === 'mobile').length;
    const desktopCount = pageviews.length - mobileCount;

    // Top Pages
    const pagesMap: Record<string, { views: number; totalTime: number }> = {};
    pageviews.forEach(e => {
      if (!pagesMap[e.page]) pagesMap[e.page] = { views: 0, totalTime: 0 };
      pagesMap[e.page].views += 1;
    });
    timeEvents.forEach(e => {
      if (pagesMap[e.page] && e.duration) pagesMap[e.page].totalTime += e.duration;
    });
    const topPages = Object.entries(pagesMap).map(([page, data]) => ({
      page,
      views: data.views,
      avgTime: data.views > 0 ? Math.round(data.totalTime / data.views) : 0
    })).sort((a, b) => b.views - a.views);

    // Top Products
    const productsMap: Record<string, { clicks: number; whatsapp: number }> = {};
    productClicks.forEach(e => {
      if (!e.product) return;
      if (!productsMap[e.product]) productsMap[e.product] = { clicks: 0, whatsapp: 0 };
      productsMap[e.product].clicks += 1;
    });
    whatsappClicks.forEach(e => {
      if (!e.product) return;
      if (!productsMap[e.product]) productsMap[e.product] = { clicks: 0, whatsapp: 0 };
      productsMap[e.product].whatsapp += 1;
    });
    const topProducts = Object.entries(productsMap).map(([product, data]) => {
      const conversionRate = data.clicks > 0 ? Math.round((data.whatsapp / data.clicks) * 100) : 0;
      // Calculate Score (0-100)
      // Base: clicks give up to 40 pts (if >= 50), conversion gives up to 60 pts (if >= 20%)
      const clickScore = Math.min(40, (data.clicks / 50) * 40);
      const convScore = Math.min(60, (conversionRate / 20) * 60);
      const score = Math.round(clickScore + convScore);

      return {
        product,
        clicks: data.clicks,
        whatsapp: data.whatsapp,
        conversionRate,
        score
      };
    }).sort((a, b) => b.score - a.score);

    // Funnel
    const funnelSiteViews = uniqueSessions;
    const funnelProductViews = new Set(productClicks.map(e => e.sessionId)).size;
    const funnelWhatsappClicks = new Set(whatsappClicks.map(e => e.sessionId)).size;

    // CRO Insights Engine
    const insights: Insight[] = [];
    const mobilePct = pageviews.length > 0 ? Math.round((mobileCount / pageviews.length) * 100) : 0;

    // Global Insight
    if (mobilePct > 70 && topProducts.length > 0) {
      insights.push({
        id: 'global-1',
        type: 'info',
        priority: 'medium',
        title: 'Tráfego Majoritariamente Mobile',
        message: `${mobilePct}% dos seus acessos vêm de celulares e focam nos primeiros produtos.`,
        action: 'Mantenha os cards grandes, botões fixos na base e elimine textos longos.'
      });
    }

    // Product Insights
    topProducts.forEach(p => {
      // Baixa conversão, alto interesse
      if (p.clicks > 5 && p.whatsapp === 0) { // Using 5 instead of 50 for realistic testing empty data
        insights.push({
          id: `prod-bad-${p.product}`,
          type: 'danger',
          priority: 'high',
          title: `Gargalo de Vendas: ${p.product}`,
          message: `Produto tem muito interesse (${p.clicks} cliques) mas NENHUMA conversão.`,
          action: 'Revisar CTA, adicionar prova social ou mudar imagem.'
        });
      } else if (p.clicks > 10 && p.conversionRate < 10) {
        insights.push({
          id: `prod-warn-${p.product}`,
          type: 'warning',
          priority: 'medium',
          title: `Baixa Conversão: ${p.product}`,
          message: `Apenas ${p.conversionRate}% dos interessados pedem orçamento.`,
          action: 'Melhorar copy de benefício ou enfatizar urgência.'
        });
      }

      // Produto Campeão
      if (p.conversionRate >= 20 && p.clicks >= 3) {
        insights.push({
          id: `prod-good-${p.product}`,
          type: 'success',
          priority: 'low',
          title: `Produto Campeão: ${p.product}`,
          message: `Taxa de conversão excelente (${p.conversionRate}%).`,
          action: 'Destacar produto na home ou subir na listagem.'
        });
      }
    });

    // Page Insights
    topPages.forEach(p => {
      if (p.views > 20 && p.avgTime < 5) {
        insights.push({
          id: `page-bounce-${p.page}`,
          type: 'warning',
          priority: 'medium',
          title: `Fricção na Página: ${p.page}`,
          message: `Usuários acessam mas saem rapidamente (média de ${p.avgTime}s).`,
          action: 'Verifique se há quebra visual ou lentidão de carregamento na página.'
        });
      }
    });

    // Sort insights by priority
    insights.sort((a, b) => {
      const p = { high: 3, medium: 2, low: 1 };
      return p[b.priority] - p[a.priority];
    });

    // Sessions
    const sessionsMap: Record<string, { events: number; lastTime: number; firstTime: number; pages: Set<string> }> = {};
    events.forEach(e => {
      if (!sessionsMap[e.sessionId]) {
        sessionsMap[e.sessionId] = { events: 0, firstTime: e.timestamp, lastTime: e.timestamp, pages: new Set() };
      }
      sessionsMap[e.sessionId].events += 1;
      sessionsMap[e.sessionId].lastTime = Math.max(sessionsMap[e.sessionId].lastTime, e.timestamp);
      sessionsMap[e.sessionId].firstTime = Math.min(sessionsMap[e.sessionId].firstTime, e.timestamp);
      if (e.page) sessionsMap[e.sessionId].pages.add(e.page);
    });
    const sessions = Object.entries(sessionsMap).map(([id, data]) => ({
      id,
      events: data.events,
      duration: Math.round((data.lastTime - data.firstTime) / 1000),
      pagesCount: data.pages.size
    })).sort((a, b) => b.duration - a.duration);

    return {
      totalViews: pageviews.length,
      totalClicks: clicks.length,
      totalProductClicks: productClicks.length,
      whatsappClicks: whatsappClicks.length,
      uniqueSessions,
      mobilePercentage: pageviews.length > 0 ? Math.round((mobileCount / pageviews.length) * 100) : 0,
      desktopPercentage: pageviews.length > 0 ? Math.round((desktopCount / pageviews.length) * 100) : 0,
      conversionRate: uniqueSessions > 0 ? Math.round((funnelWhatsappClicks / uniqueSessions) * 100) : 0,
      topPages,
      topProducts,
      sessions,
      insights,
      funnel: {
        site: funnelSiteViews,
        product: funnelProductViews,
        whatsapp: funnelWhatsappClicks
      }
    };
  }, [events, dateRange]);

  // Última atualização do catálogo — produto com maior updated_at
  const lastCatalogUpdate = useMemo(() => {
    const withDate = catalogItems
      .map(p => (p as any).updated_at)
      .filter(Boolean)
      .map((d: string) => new Date(d).getTime())
      .filter((t: number) => !isNaN(t));
    if (!withDate.length) return null;
    return new Date(Math.max(...withDate));
  }, [catalogItems]);

  const clearData = () => {
    if (confirm('Tem certeza que deseja apagar todos os dados de Analytics?')) {
      localStorage.removeItem('mdi_analytics_events');
      setEvents([]);
    }
  };

  // ----------------------------------------------------
  // CMS ACTIONS
  // ----------------------------------------------------
  
  /** Gera caminho estruturado no bucket products: brand/slug/arquivo.webp */
  const generateProductFilePath = (marca?: string, nome?: string, isMain: boolean = true) => {
    const safeMarca = (marca || 'sem-marca').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const rawSlug = nome ? nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : `novo-produto-${Date.now()}`;
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 6);
    return `${safeMarca}/${rawSlug}/${isMain ? 'main' : `img-${randomPart}`}-${timestamp}.webp`;
  };

  /** Extrai o filePath relativo de uma URL pública do Supabase para deletar */
  const extractFilePathFromUrl = (url: string): { bucket: string, path: string } | null => {
    if (!url || url.startsWith('data:')) return null;
    try {
      const match = url.match(/\/storage\/v1\/object\/public\/(product-images|products)\/(.+)/);
      return match ? { bucket: match[1], path: match[2] } : null;
    } catch {
      return null;
    }
  };

  /** Remove imagem antiga do Supabase Storage (sem bloquear fluxo em caso de erro) */
  const deleteOldImage = async (oldUrl: string): Promise<void> => {
    if (!supabase || !oldUrl) return;
    const extract = extractFilePathFromUrl(oldUrl);
    if (!extract) return;
    try {
      await supabase.storage.from(extract.bucket).remove([extract.path]);
    } catch (e) {
      console.warn('Não foi possível deletar imagem antiga:', extract.path);
    }
  };

  /**
   * Upload pipeline — zero base64, zero localStorage blobs:
   *   1. compressToBlob (canvas WebP, sem FileReader)
   *   2. Hard limit 500KB — erro amigável se ainda pesada
   *   3. Supabase Storage upload com retry (2 tentativas) no bucket `products`
   *   4. Cache-bust timestamp na URL pública
   *   5. Offline: ObjectURL preview (sessão apenas, nunca persistido)
   */
  const uploadImage = async (file: File, oldUrl?: string, marca?: string, nome?: string, isMain: boolean = true): Promise<string> => {
    // Step 1 — comprimir para WebP Blob (zero base64)
    const { blob, previewUrl } = await compressToBlob(file);

    // Step 2 — hard size cap pós-compressão
    if (blob.size > SIZE_HARD_CAP) {
      URL.revokeObjectURL(previewUrl);
      throw new Error(
        `A imagem ainda está muito pesada (${Math.round(blob.size / 1024)}KB após compressão). ` +
        'Tente uma foto com resolução menor ou formato diferente.'
      );
    }

    // Step 3 — upload para Supabase Storage com retry
    if (supabase) {
      const MAX_RETRIES = 2;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const filePath = generateProductFilePath(marca, nome, isMain);
          const { error } = await supabase.storage
            .from('products')
            .upload(filePath, blob, {
              contentType: 'image/webp',
              upsert: false,
            });

          if (error) throw new Error(error.message);

          // Sucesso: deletar imagem antiga e retornar nova URL com cache-bust
          if (oldUrl) await deleteOldImage(oldUrl);
          URL.revokeObjectURL(previewUrl);
          const { data } = supabase.storage.from('products').getPublicUrl(filePath);
          return `${data.publicUrl}?v=${Date.now()}`;
        } catch (e: any) {
          lastError = e;
          if (attempt < MAX_RETRIES) {
            // Backoff: 1s, 2s
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
      }

      console.error('Supabase upload falhou após retries:', lastError?.message);
    }

    // Step 4 — fallback offline graceful
    // ObjectURL é válido apenas nesta sessão — NUNCA armazenado em DB/localStorage.
    console.warn('Supabase indisponível — usando prévia local (sessão apenas).');
    return previewUrl;
  };

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Limpar input para permitir reselecionar o mesmo arquivo
    e.target.value = '';
    setIsUploadingImage(true);
    try {
      const oldUrl = editingProduct?.imagem || '';
      const finalUrl = await uploadImage(file, oldUrl, editingProduct?.marca, editingProduct?.nome, true);
      setEditingProduct(prev => ({ ...prev, imagem: finalUrl }));
    } catch (error: any) {
      setSaveToast({ type: 'error', msg: error.message || 'Erro ao processar imagem.' });
      setTimeout(() => setSaveToast(null), 6000);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCarouselImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    e.target.value = '';
    setIsUploadingImage(true);
    try {
      const urls = await Promise.all(files.map(f => uploadImage(f, undefined, editingProduct?.marca, editingProduct?.nome, false)));
      setEditingProduct(prev => ({
        ...prev,
        imagens: [...(prev?.imagens || []), ...urls]
      }));
    } catch (error: any) {
      setSaveToast({ type: 'error', msg: error.message || 'Erro ao processar imagens do carrossel.' });
      setTimeout(() => setSaveToast(null), 6000);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.nome) return;

    // Limitar produtos em destaque
    const destaqueCount = catalogItems.filter(p => p.destaque && p.ativo).length;
    const isNew = !editingProduct.slug;
    if (editingProduct.destaque && isNew && destaqueCount >= MAX_DESTAQUE) {
      setSaveToast({
        type: 'error',
        msg: `🚫 Limite atingido: já existem ${MAX_DESTAQUE} produtos em destaque. Remova um antes de adicionar outro.`
      });
      setTimeout(() => setSaveToast(null), 5000);
      return;
    }

    setIsSaving(true);
    try {
      const slug = isNew ? generateSlug(editingProduct.nome) : editingProduct.slug!;

      const finalProduct: Product = {
        ...(editingProduct as Product),
        slug,
        codigo: editingProduct.codigo || `SKU-${Date.now().toString().slice(-6)}`,
        nomeOriginal: editingProduct.nomeOriginal || editingProduct.nome!,
        categoriaLabel:
          CATEGORIAS[editingProduct.categoria || 'manta-asfaltica']?.nome ||
          editingProduct.categoriaLabel ||
          editingProduct.categoria || '',
        ativo: editingProduct.ativo !== false,
        ordem: editingProduct.ordem || 1,
        isCustom: true,
      } as any;

      // ── Step 1: Optimistic local update ──────────────────────────────────
      const updatedCatalog = isNew
        ? [...catalogItems, finalProduct]
        : catalogItems.map(p => p.slug === finalProduct.slug ? finalProduct : p);

      setCatalogItems(updatedCatalog);

      // ── Step 2: Persist to Supabase (primary) ────────────────────────────
      await saveProductToSupabase(finalProduct);

      // ── Step 3: Also update localStorage fallback (backward compat) ──────
      const dynamicOnly = updatedCatalog.filter(p => (p as any).isCustom);
      await saveCustomProducts(dynamicOnly);

      // ── Step 3.5: Sync taxonomies (Tipo and Aplicação) to global store ───
      await syncProductTaxonomies(finalProduct.tipo || [], finalProduct.aplicacao || []);

      // ── Step 4: Invalidate cache and refetch — Admin sees all (including inactive) ──
      invalidateProductsCache(); invalidateAdminCache();
      fetchAllProductsForAdmin().then(all => setCatalogItems(all)).catch(console.error);

      setSaveToast({ type: 'success', msg: isNew ? '✅ Produto criado com sucesso!' : '✅ Produto atualizado com sucesso!' });
      setTimeout(() => setSaveToast(null), 3000);
      setIsModalOpen(false);
      setEditingProduct(null);
      await logAdminAction(isNew ? 'CREATE_PRODUCT' : 'UPDATE_PRODUCT', `Produto '${finalProduct.nome}' (${slug})`);
    } catch (err: any) {
      setSaveToast({ type: 'error', msg: err?.message || 'Erro ao salvar. Tente novamente.' });
      setTimeout(() => setSaveToast(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  /** Registra ação no log de admin (localStorage + Supabase se disponível) */
  const logAdminAction = async (action: string, detail: string) => {
    const entry: AdminLogEntry = { id: crypto.randomUUID(), action, detail, at: nowISO() };
    const updated = [entry, ...adminLog].slice(0, 200); // max 200 entradas
    setAdminLog(updated);
    try { localStorage.setItem('mdi_admin_log', JSON.stringify(updated)); } catch { /* storage full */ }
    if (supabase) {
      try {
        await supabase.from('admin_logs').insert({ action, detail, created_at: entry.at });
      } catch { /* tabela pode não existir ainda — silencioso */ }
    }
  };

  /** Exclui o produto (remove do banco e do painel) */
  const handleDeleteProduct = async (slug: string) => {
    const produto = catalogItems.find(p => p.slug === slug);
    const updatedCatalog = catalogItems.filter(p => p.slug !== slug);
    
    // Optimistic update
    setCatalogItems(updatedCatalog);
    const dynamicOnly = updatedCatalog.filter(p => (p as any).isCustom);
    await saveCustomProducts(dynamicOnly);
    
    if (supabase) {
      try {
        const { error } = await supabase.from('products').delete().eq('slug', slug);
        if (error) {
          if (import.meta.env.DEV) console.error('[ADMIN CRUD] DELETE Supabase error:', error);
          throw new Error(error.message);
        } else {
          if (import.meta.env.DEV) console.log('[ADMIN CRUD] DELETE OK:', { slug });
        }
      } catch (e: any) {
        // Revert se falhar
        setCatalogItems(catalogItems);
        setSaveToast({ type: 'error', msg: `Erro ao excluir: ${e?.message || 'Tente novamente.'}` });
        setTimeout(() => setSaveToast(null), 4000);
        return;
      }
    }
    
    // Remove do cache
    removeProductFromAdminCache(slug);
    invalidateProductsCache();
    
    await logAdminAction('DELETE', `Produto '${produto?.nome || slug}' excluído`);
    setSaveToast({ type: 'error', msg: `🗑️ "${produto?.nome || slug}" foi excluído.` });
    setTimeout(() => setSaveToast(null), 4000);
    setDeleteConfirmSlug(null);
  };

  /** Restaura produto da lixeira */
  const handleRestoreProduct = async (slug: string) => {
    const produto = catalogItems.find(p => p.slug === slug);
    const updatedCatalog = catalogItems.map(p =>
      p.slug === slug
        ? { ...p, ativo: true, isCustom: true, deleted_at: undefined, updated_at: nowISO() } as any
        : p
    );
    setCatalogItems(updatedCatalog);
    const dynamicOnly = updatedCatalog.filter(p => (p as any).isCustom);
    await saveCustomProducts(dynamicOnly);
    if (supabase) {
      try { await supabase.from('products').update({ active: true, deleted_at: null }).eq('slug', slug); } catch { /* silent */ }
    }
    // Sync frontend cache — Admin sees ALL products (active + inactive)
    invalidateProductsCache(); invalidateAdminCache();
    fetchAllProductsForAdmin().then(all => setCatalogItems(all)).catch(console.error);
    await logAdminAction('RESTORE', `Produto '${produto?.nome || slug}' restaurado da lixeira`);
    setSaveToast({ type: 'success', msg: `✅ "${produto?.nome || slug}" restaurado com sucesso!` });
    setTimeout(() => setSaveToast(null), 3000);
  };

  /** Exclusão permanente (apenas da lixeira) */
  const handlePermanentDelete = async (slug: string) => {
    const produto = catalogItems.find(p => p.slug === slug);
    const updatedCatalog = catalogItems.filter(p => p.slug !== slug);
    setCatalogItems(updatedCatalog);
    const dynamicOnly = updatedCatalog.filter(p => (p as any).isCustom);
    await saveCustomProducts(dynamicOnly);
    if (supabase) {
      try {
        const { error } = await supabase.from('products').delete().eq('slug', slug);
        if (error) {
          if (import.meta.env.DEV) console.error('[ADMIN CRUD] PERMANENT_DELETE Supabase error:', error);
        } else {
          if (import.meta.env.DEV) console.log('[ADMIN CRUD] PERMANENT_DELETE OK:', { slug });
        }
      } catch { /* silent */ }
    }
    // Remove from both caches so it never reappears on re-render or next fetch
    removeProductFromAdminCache(slug);
    invalidateProductsCache();
    await logAdminAction('PERMANENT_DELETE', `Produto '${produto?.nome || slug}' excluído permanentemente`);
    setSaveToast({ type: 'error', msg: `🗑️ "${produto?.nome || slug}" excluído permanentemente.` });
    setTimeout(() => setSaveToast(null), 3000);
  };

  /** Ativa/desativa modo manutenção */
  const handleToggleMaintenance = () => {
    const next = !maintenanceEnabled;
    setMaintenanceEnabled(next);
    localStorage.setItem('mdi_maintenance', String(next));
    logAdminAction('MAINTENANCE', next ? 'Modo manutenção ATIVADO' : 'Modo manutenção DESATIVADO');
    setSaveToast({ type: next ? 'error' : 'success', msg: next ? '🔧 Modo manutenção ativado — site oculto aos visitantes.' : '✅ Modo manutenção desativado — site online.' });
    setTimeout(() => setSaveToast(null), 4000);
  };

  /** Executa health check completo */
  const handleRunHealthCheck = async () => {
    setHealthLoading(true);
    try {
      const { runHealthCheck } = await import('@/lib/health-check');
      const report = await runHealthCheck();
      setHealthReport(report);
    } finally {
      setHealthLoading(false);
    }
  };

  /** Gera resumo com IA (local template ou provider configurado) */
  const handleGenerateSummary = async () => {
    if (!editingProduct?.nome?.trim() || !editingProduct?.marca?.trim()) {
      setSaveToast({ type: 'error', msg: 'Preencha Nome e Marca antes de gerar a descrição.' });
      setTimeout(() => setSaveToast(null), 3000);
      return;
    }
    setIsGeneratingAI(true);
    try {
      const { generateProductSummary } = await import('@/lib/ai-generator');
      const result = await generateProductSummary({
        nome: editingProduct.nome,
        marca: editingProduct.marca,
        categoria: editingProduct.categoria || 'manta-asfaltica',
      }, { retries: 1 });
      setEditingProduct(prev => ({ ...prev, resumo: result.text }));
    } catch (e: any) {
      setSaveToast({ type: 'error', msg: e.message || 'Erro ao gerar descrição.' });
      setTimeout(() => setSaveToast(null), 4000);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  /** Salva nova categoria personalizada */
  const handleAddCustomCategory = () => {
    const name = newCategoryInput.trim();
    if (!name) return;
    const slug = name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const updated = { ...customCategories, [slug]: name };
    setCustomCategories(updated);
    localStorage.setItem('mdi_custom_categories', JSON.stringify(updated));
    setEditingProduct(prev => ({ ...prev, categoria: slug as any, categoriaLabel: name }));
    setNewCategoryInput('');
    setShowNewCategoryInput(false);
    logAdminAction('ADD_CATEGORY', `Categoria '${name}' (${slug}) adicionada`);
  };

  /** Remove categoria personalizada */
  const handleRemoveCustomCategory = (slug: string) => {
    const { [slug]: _, ...rest } = customCategories;
    setCustomCategories(rest);
    localStorage.setItem('mdi_custom_categories', JSON.stringify(rest));
    logAdminAction('REMOVE_CATEGORY', `Categoria '${slug}' removida`);
  };

  /** Adiciona marca personalizada */
  const handleAddCustomBrand = () => {
    const raw = newBrandInput.trim();
    if (!raw) return;
    const name = normalizeBrandName(raw);
    if (!name) return;
    
    setEditingProduct(prev => ({ ...prev, marca: name }));
    setNewBrandInput('');
    setShowNewBrandInput(false);
    logAdminAction('ADD_BRAND', `Marca '${name}' adicionada`);
  };
  
  /** Remove marca personalizada */


  /** Adiciona opção personalizada de Indicado Para e auto-seleciona */
  const handleAddAplicacaoOpt = () => {
    const val = newAplicacaoOpt.trim();
    if (!val || aplicacaoInput.includes(val)) {
      setNewAplicacaoOpt('');
      return;
    }
    const newOpts = [...customAplicacaoOpts, val];
    const newSelected = [...aplicacaoInput, val];
    setCustomAplicacaoOpts(newOpts);
    setAplicacaoInput(newSelected);
    setEditingProduct(prev => ({ ...prev, aplicacao: newSelected }));
    setNewAplicacaoOpt('');
  };

  /** Adiciona opção de Tipo e auto-seleciona */
  const handleAddTipoOpt = () => {
    const val = newTipoOpt.trim();
    if (!val || tipoInput.includes(val)) {
      setNewTipoOpt('');
      return;
    }
    const newOpts = [...customTipoOpts, val];
    const newSelected = [...tipoInput, val];
    setCustomTipoOpts(newOpts);
    setTipoInput(newSelected);
    setEditingProduct(prev => ({ ...prev, tipo: newSelected }));
    setNewTipoOpt('');
  };

  /** Toggle ativo/inativo — corrigido para usar p.ativo (campo real do banco) */
  const handleToggleDisponivel = async (slug: string, currentAtivo: boolean) => {
    const novoEstado = !currentAtivo;
    const snapshotBeforeChange = catalogItems;

    if (import.meta.env.DEV) console.log('[ADMIN CRUD] toggleAtivo', { slug, currentAtivo, novoEstado });

    // Optimistic update
    const updatedCatalog = catalogItems.map(p =>
      p.slug === slug ? { ...p, ativo: novoEstado, isCustom: true } : p
    );
    setCatalogItems(updatedCatalog);

    try {
      if (supabase) {
        const { error } = await supabase
          .from('products')
          .update({ active: novoEstado })
          .eq('slug', slug);

        if (error) {
          if (import.meta.env.DEV) console.error('[ADMIN CRUD] toggleAtivo Supabase error:', error);
          throw new Error(error.message);
        }
        if (import.meta.env.DEV) console.log('[ADMIN CRUD] toggleAtivo OK — banco atualizado:', { slug, active: novoEstado });
      }

      // Patch cache in-place (sem refetch para evitar race condition)
      patchProductInAdminCache(slug, { ativo: novoEstado });
      invalidateProductsCache();

      setSaveToast({
        type: novoEstado ? 'success' : 'error',
        msg: novoEstado ? '✅ Produto reativado — visível no site.' : '🚫 Produto desativado — oculto do site.'
      });
      setTimeout(() => setSaveToast(null), 3000);
    } catch (e: any) {
      // Revert on failure
      setCatalogItems(snapshotBeforeChange);
      setSaveToast({ type: 'error', msg: `Erro ao salvar: ${e?.message || 'Tente novamente.'}` });
      setTimeout(() => setSaveToast(null), 4000);
    }
  };

  /** Exporta o catálogo em JSON */
  const handleExportCatalog = () => {
    const dataStr = JSON.stringify(catalogItems, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `mdi-catalogo-snapshot-${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    logAdminAction('EXPORT_CATALOG', 'Snapshot do catálogo exportado em JSON');
    setSaveToast({ type: 'success', msg: '✅ Snapshot exportado com sucesso.' });
    setTimeout(() => setSaveToast(null), 3000);
  };

  /** Importa o catálogo via JSON e sincroniza com o Supabase */
  const handleImportCatalog = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Clear input so same file can be selected again
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') return;
        const importedData = JSON.parse(result);

        if (!Array.isArray(importedData)) {
          throw new Error('O arquivo JSON não contém um array de produtos válido.');
        }

        // Validação básica do schema
        const isValid = importedData.every(item => item.slug && item.nome && item.categoria);
        if (!isValid) {
          throw new Error('Alguns produtos no JSON não possuem os campos obrigatórios (slug, nome, categoria).');
        }

        setIsSaving(true);
        setSaveToast({ type: 'info', msg: '⏳ Sincronizando catálogo importado...' });

        // Merge com itens existentes ou sobrescreve tudo?
        // A lógica do admin considera que os dynamicOnly (isCustom=true) sobem.
        const dynamicOnly = importedData.filter(p => p.isCustom !== false);
        await saveCustomProducts(dynamicOnly);

        // Invalida cache e revalida
        await revalidateProducts();
        
        // Atualiza estado do Admin
        setCatalogItems(productsStore.getSnapshot());

        setSaveToast({ type: 'success', msg: `✅ Catálogo importado com sucesso! (${importedData.length} produtos)` });
        setTimeout(() => setSaveToast(null), 4000);
        logAdminAction('IMPORT_CATALOG', `Catálogo importado (${importedData.length} produtos)`);

      } catch (err: any) {
        setSaveToast({ type: 'error', msg: `Erro ao importar: ${err.message}` });
        setTimeout(() => setSaveToast(null), 5000);
      } finally {
        setIsSaving(false);
      }
    };
    reader.readAsText(file);
  };

  const openNewProductModal = () => {
    setEditingProduct({
      nome: '',
      resumo: '',
      categoria: 'manta-asfaltica',
      marca: 'Vedacit',
      destaque: false,
      imagem: '',
      embalagem: 'Unidade',
      unidade: 'un',
      quantidadeEstoque: 100,
      aplicacao: [],
      tipo: [],
      comoUsar: []
    });
    setSpecsInput([{key: '', val: ''}]);
    setComoUsarInput(['']);
    setAplicacaoInput([]);
    setTipoInput([]);
    setModalTab('basico');
    setIsModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct({ ...product });
    setAplicacaoInput(product.aplicacao || []);
    setTipoInput(product.tipo || []);
    setComoUsarInput(product.comoUsar?.length ? product.comoUsar : ['']);
    const specs = product.especificacoes ? Object.entries(product.especificacoes).map(([k,v]) => ({key:k, val:v})) : [];
    setSpecsInput(specs.length ? specs : [{key:'',val:''}]);
    setModalTab('basico');
    setIsModalOpen(true);
  };

  // ----------------------------------------------------
  // CRM ACTIONS
  // ----------------------------------------------------
  const handleUpdateLeadStatus = async (id: string, status: Lead['status']) => {
    const updatedLeads = leads.map(l => l.id === id ? { ...l, status, updated_at: new Date().toISOString() } : l);
    setLeads(updatedLeads);
    localStorage.setItem('mdi_leads', JSON.stringify(updatedLeads));

    if (supabase) {
      await supabase.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    }
  };

  const handleSaveLeadNote = async (id: string) => {
    const updatedLeads = leads.map(l => l.id === id ? { ...l, notes: leadNoteDraft, updated_at: new Date().toISOString() } : l);
    setLeads(updatedLeads);
    localStorage.setItem('mdi_leads', JSON.stringify(updatedLeads));
    setEditingLeadId(null);
    setLeadNoteDraft('');

    if (supabase) {
      await supabase.from('leads').update({ notes: leadNoteDraft, updated_at: new Date().toISOString() }).eq('id', id);
    }
  };

  const statusColors = {
    'novo': 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    'em_atendimento': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'convertido': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'perdido': 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  };

  const statusLabels = {
    'novo': 'Novo',
    'em_atendimento': 'Em Atendimento',
    'convertido': 'Convertido',
    'perdido': 'Perdido'
  };

  const metricsCRM = useMemo(() => {
    const novos = leads.filter(l => !l.status || l.status === 'novo').length;
    const emAtendimento = leads.filter(l => l.status === 'em_atendimento').length;
    const convertidos = leads.filter(l => l.status === 'convertido').length;
    const taxaConversao = leads.length > 0 ? ((convertidos / leads.length) * 100).toFixed(1) : '0.0';
    return { novos, emAtendimento, convertidos, taxaConversao };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads
      .filter(l => leadStatusFilter === 'todos' || (l.status || 'novo') === leadStatusFilter)
      .filter(l => leadStageFilter === 'todos' || l.lead_stage === leadStageFilter)
      .filter(l => leadSearchQuery === '' || l.product_name.toLowerCase().includes(leadSearchQuery.toLowerCase()))
      .sort((a, b) => {
        if (leadSortOrder === 'score') return (b.lead_score || 0) - (a.lead_score || 0);
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return leadSortOrder === 'recentes' ? dateB - dateA : dateA - dateB;
      });
  }, [leads, leadStatusFilter, leadStageFilter, leadSearchQuery, leadSortOrder]);

  const filteredCatalog = useMemo(() => {
    let list = [...catalogItems]; // Admin shows ALL products, active and inactive
    if (catalogBrandFilter !== 'todas') {
      list = list.filter(p => normalizeBrandName(p.marca) === catalogBrandFilter);
    }
    if (catalogFeatureFilter === 'destaques') {
      list = list.filter(p => p.destaque);
    }
    if (statusFilter === 'active') {
      list = list.filter(p => p.ativo !== false);
    } else if (statusFilter === 'inactive') {
      list = list.filter(p => p.ativo === false);
    }
    if (catalogSearch) {
      const q = catalogSearch.toLowerCase();
      list = list.filter(p => p.nome.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q));
    }
    if (catalogSort === 'nome') list = [...list].sort((a, b) => a.nome.localeCompare(b.nome));
    if (catalogSort === 'destaque') list = [...list].sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0));
    return list;
  }, [catalogItems, catalogSearch, catalogSort, catalogBrandFilter, catalogFeatureFilter, statusFilter]);

  const destaqueAtual = catalogItems.filter(p => p.destaque && p.ativo).length;

  // ----------------------------------------------------
  // LOGIN SCREEN
  // ----------------------------------------------------
  if (systemError) {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center px-4">
        <div className="bg-[#161B22] border border-slate-800 p-8 rounded-2xl max-w-sm text-center shadow-2xl">
          <span className="material-symbols-outlined text-rose-500 text-5xl mb-4">cloud_off</span>
          <h2 className="text-xl font-bold text-white mb-2">Sistema Offline</h2>
          <p className="text-slate-400 text-sm">{systemError}</p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // DASHBOARD LAYOUT
  // ----------------------------------------------------
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const navItems: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'monitoring' },
    { id: 'catalogo', label: 'Gerenciar Produtos', icon: 'app_registration' },
    { id: 'heatmap', label: 'Heatmap', icon: 'local_fire_department' },
    { id: 'produtos', label: 'Insights de Produtos', icon: 'inventory_2' },
    { id: 'paginas', label: 'Páginas', icon: 'description' },
    { id: 'conversao', label: 'Conversão', icon: 'filter_alt' },
    { id: 'sessoes', label: 'Sessões', icon: 'supervised_user_circle' },
    { id: 'sistema', label: 'Sistema', icon: 'health_and_safety' },
  ];

  return (
    <div className="min-h-screen bg-[#0E1117] text-slate-300 font-sans flex flex-col md:flex-row">

      {/* Mobile Top Nav */}
      <div className="md:hidden bg-[#161B22] border-b border-slate-800 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-emerald-500">
            <span className="material-symbols-outlined text-xl">analytics</span>
            <span className="font-bold text-white text-sm tracking-wide">Analytics Pro</span>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white p-1">
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
        <div className="flex overflow-x-auto scrollbar-hide border-t border-slate-800">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${activeTab === item.id ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'
                }`}>
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="whitespace-nowrap">{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#161B22] border-r border-slate-800 flex-col h-screen sticky top-0 z-20">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 text-emerald-500">
            <span className="material-symbols-outlined text-2xl">analytics</span>
            <span className="font-bold text-white tracking-wide">Analytics Pro</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === item.id
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                }`}>
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">

        {/* ðŸ”¥ Hot Lead Alert Banner */}
        {hotLeadAlert && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300 max-w-sm w-full">
            <div className="bg-rose-950 border border-rose-500 rounded-xl p-4 shadow-2xl shadow-rose-900/50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">ðŸ”¥</span>
                  <div>
                    <p className="font-black text-white text-sm">Lead Quente Detectado!</p>
                    <p className="text-rose-300 text-xs mt-0.5 font-medium truncate max-w-[200px]">{hotLeadAlert.product_name}</p>
                    <p className="text-rose-400 text-[10px] font-mono">Score: {hotLeadAlert.lead_score}pts · {hotLeadAlert.page}</p>
                  </div>
                </div>
                <button onClick={() => setHotLeadAlert(null)} className="text-rose-400 hover:text-white shrink-0">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
              <button
                onClick={() => { setActiveTab('produtos'); setHotLeadAlert(null); }}
                className="mt-3 w-full text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white py-2 rounded-lg transition-colors"
              >
                Ver Insights â†’
              </button>
            </div>
          </div>
        )}

        {/* ðŸ’° Conversion Modal */}
        {conversionModalId && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
            <div className="bg-[#161B22] border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-black text-white mb-1">Registrar Conversão</h3>
              <p className="text-slate-400 text-sm mb-4">Informe o valor da venda (opcional).</p>
              <div className="mb-4">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Valor da Venda (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={conversionValue}
                  onChange={e => setConversionValue(e.target.value)}
                  className="w-full bg-[#0E1117] border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    await markLeadConverted(conversionModalId, parseFloat(conversionValue) || 0);
                    setLeads(prev => prev.map(l => l.id === conversionModalId
                      ? { ...l, converted: true, conversion_value: parseFloat(conversionValue) || 0, status: 'convertido' }
                      : l
                    ));
                    setConversionModalId(null);
                    setConversionValue('');
                  }}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  âœ“ Confirmar
                </button>
                <button
                  onClick={() => { setConversionModalId(null); setConversionValue(''); }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <header className="flex justify-between items-end flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-white">Overview</h1>
                <p className="text-sm text-slate-400 mt-1">Métricas globais de performance.</p>
              </div>
              <div className="flex items-center gap-3">
                <DateRangeSelector value={dateRange} onChange={setDateRange} />
                <span className="text-xs text-emerald-500 font-medium tracking-widest uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live
                </span>
              </div>
            </header>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Usuários Únicos" value={metrics.uniqueSessions} icon="person" color="text-white" />
              <MetricCard title="Cliques no WhatsApp" value={metrics.whatsappClicks} icon="chat" color="text-emerald-400" />
              <MetricCard title="Cliques em Produtos" value={metrics.totalProductClicks} icon="inventory_2" color="text-amber-400" />
              <MetricCard title="Taxa de Conversão" value={`${metrics.conversionRate}%`} icon="trending_up" color="text-indigo-400" />
            </div>

            {/* Card: Última Atualização do Catálogo */}
            <div className="bg-[#161B22] border border-slate-800 rounded-xl p-5 relative overflow-hidden group flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-indigo-400 text-xl">history</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">Última atualização do catálogo</p>
                <p className="text-white font-black text-lg mt-0.5 truncate">
                  {formatRelativeDate(lastCatalogUpdate)}
                </p>
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-indigo-400 text-6xl">edit_document</span>
              </div>
            </div>

            {/* Quick Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#161B22] border border-slate-800 rounded-xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Top Páginas</h3>
                <div className="space-y-3">
                  {metrics.topPages.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                      <span className="text-slate-300 truncate max-w-[200px]">{p.page}</span>
                      <span className="font-mono text-slate-400">{p.views} views</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#161B22] border border-slate-800 rounded-xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Top Produtos (Cliques)</h3>
                <div className="space-y-3">
                  {metrics.topProducts.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                      <span className="text-slate-300 truncate max-w-[200px]">{p.product}</span>
                      <span className="font-mono text-amber-400">{p.clicks} cliques</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CATALOGO (CMS) */}
        {activeTab === 'catalogo' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <header className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">app_registration</span>
                  Catálogo de Produtos
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {filteredCatalog.length} produtos
                  {catalogSearch && ` (filtrando)`}
                  &nbsp;·&nbsp;
                  <span className={destaqueAtual >= MAX_DESTAQUE ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                    â­ {destaqueAtual}/{MAX_DESTAQUE} em destaque
                  </span>
                </p>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                {/* Busca */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[18px]">search</span>
                  <input type="search" placeholder="Buscar produto..." value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    className="bg-[#0E1117] border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:border-indigo-500 outline-none w-44" />
                </div>
                {/* Brand Filter */}
                <select value={catalogBrandFilter} onChange={e => setCatalogBrandFilter(e.target.value)}
                  className="bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm outline-none focus:border-indigo-500 cursor-pointer">
                  <option value="todas">Todas as marcas</option>
                  {availableBrands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                {/* Feature Filter */}
                <select value={catalogFeatureFilter} onChange={e => setCatalogFeatureFilter(e.target.value as any)}
                  className="bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm outline-none focus:border-indigo-500 cursor-pointer">
                  <option value="todos">Todos (Destaque e Normal)</option>
                  <option value="destaques">Apenas em Destaque</option>
                </select>
                {/* Status Filter */}
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
                  className="bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm outline-none focus:border-indigo-500 cursor-pointer">
                  <option value="all">Todos os Status</option>
                  <option value="active">Apenas Ativos</option>
                  <option value="inactive">Apenas Desativados</option>
                </select>
                {/* Sort */}
                <select value={catalogSort} onChange={e => setCatalogSort(e.target.value as any)}
                  className="bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm outline-none focus:border-indigo-500 cursor-pointer">
                  <option value="recentes">Recentes</option>
                  <option value="nome">Nome A-Z</option>
                  <option value="destaque">Destaque primeiro</option>
                </select>
                <button onClick={openNewProductModal}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg text-sm min-h-[44px]">
                  <span className="material-symbols-outlined text-lg">add</span>
                  Novo
                </button>
                <div className="flex gap-1 ml-1 border-l border-slate-700 pl-2">
                  <button onClick={() => setShowNormalizeBrandsModal(true)} title="Assistente de Normalização de Marcas"
                    className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl transition-all h-[44px]">
                    <span className="material-symbols-outlined text-lg text-amber-400">auto_fix</span>
                  </button>
                  <button onClick={() => setShowManageBrandsModal(true)} title="Gerenciar Marcas"
                    className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl transition-all h-[44px]">
                    <span className="material-symbols-outlined text-lg text-sky-400">label</span>
                  </button>
                  <button onClick={handleExportCatalog} title="Exportar JSON (Snapshot)"
                    className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl transition-all h-[44px]">
                    <span className="material-symbols-outlined text-lg text-emerald-400">download</span>
                  </button>
                  <label title="Importar JSON"
                    className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl transition-all h-[44px] cursor-pointer">
                    <span className="material-symbols-outlined text-lg text-purple-400">upload</span>
                    <input type="file" accept=".json" className="hidden" onChange={handleImportCatalog} disabled={isSaving} />
                  </label>
                </div>
              </div>
            </header>

            {destaqueAtual >= MAX_DESTAQUE && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-2.5 rounded-xl text-xs font-bold">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                Limite de {MAX_DESTAQUE} produtos em destaque atingido. Remova um antes de adicionar outro.
              </div>
            )}

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredCatalog.map(p => (
                <div key={p.slug} className={`bg-[#161B22] border rounded-xl p-4 transition-opacity ${p.ativo === false ? 'border-rose-900/50 opacity-60' : 'border-slate-800'}`}>
                  <div className="flex gap-3 items-start">
                    <div className="w-14 h-14 bg-white rounded-lg overflow-hidden flex items-center justify-center p-1 border border-slate-700 shrink-0">
                      <img src={p.imagem || '/images/products/placeholder.webp'} alt={p.nome} className="w-full h-full object-contain mix-blend-multiply" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-200 text-sm truncate">{p.nome}</p>
                      <p className="text-[11px] text-slate-500 truncate">{p.categoriaLabel} · {p.marca}</p>
                       {p.destaque && (
                          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-500/20 mt-1">
                            <span className="material-symbols-outlined text-[11px]">star</span> Em destaque na Home
                          </span>
                        )}
                        {p.ativo === false && (
                          <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-rose-500/20 mt-1">
                            <span className="material-symbols-outlined text-[11px]">visibility_off</span> Desativado
                          </span>
                        )}
                    </div>
                    <div className="flex gap-1 shrink-0 flex-col items-end">
                      {/* Toggle ativo/inativo (mobile) */}
                      <button
                        onClick={() => handleToggleDisponivel(p.slug, p.ativo !== false)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                          p.ativo !== false ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                        title={p.ativo !== false ? 'Desativar' : 'Ativar'}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                          p.ativo !== false ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                      <span className={`text-[9px] font-bold ${
                        p.ativo !== false ? 'text-emerald-400' : 'text-rose-400'
                      }`}>{p.ativo !== false ? 'Ativo' : 'Inativo'}</span>
                      <div className="flex gap-1 mt-1">
                        <button onClick={() => openEditProductModal(p)} className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button onClick={() => setDeleteConfirmSlug(deleteConfirmSlug === p.slug ? null : p.slug)}
                          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors">
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  {deleteConfirmSlug === p.slug && (
                    <div className="mt-3 flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                      <span className="text-xs text-rose-300 font-bold flex-1">Confirmar exclusão?</span>
                      <button onClick={() => handleDeleteProduct(p.slug)}
                        className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg">Excluir</button>
                      <button onClick={() => setDeleteConfirmSlug(null)}
                        className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs font-bold rounded-lg">Cancelar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-[#161B22] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0E1117] text-slate-400 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Imagem</th>
                    <th className="px-6 py-4 font-semibold">Produto</th>
                    <th className="px-6 py-4 font-semibold">Categoria</th>
                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredCatalog.map(p => (
                    <React.Fragment key={p.slug}>
                      <tr className={`hover:bg-slate-800/50 transition-colors ${p.ativo === false ? 'opacity-60' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="w-12 h-12 bg-white rounded-md overflow-hidden flex items-center justify-center p-1 border border-slate-700">
                            <img src={p.imagem || '/images/products/placeholder.webp'} alt={p.nome} className="w-full h-full object-contain mix-blend-multiply" />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-200 line-clamp-1">{p.nome}</p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{p.marca}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs uppercase tracking-wider">{p.categoriaLabel}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-2">
                            {p.destaque && (
                              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-amber-500/20">
                                <span className="material-symbols-outlined text-[12px]">star</span> Em destaque
                              </span>
                            )}
                            {p.ativo === false && (
                              <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-rose-500/20">
                                <span className="material-symbols-outlined text-[12px]">visibility_off</span> Desativado
                              </span>
                            )}
                            {/* Toggle ativo/inativo (desktop) */}
                            <button
                              onClick={() => handleToggleDisponivel(p.slug, p.ativo !== false)}
                              title={p.ativo !== false ? 'Clique para desativar' : 'Clique para ativar'}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                                p.ativo !== false ? 'bg-emerald-500' : 'bg-slate-600'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                  p.ativo !== false ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className={`text-[10px] font-bold ${
                              p.ativo !== false ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {p.ativo !== false ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => openEditProductModal(p)} className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors" title="Editar">
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          <button onClick={() => setDeleteConfirmSlug(deleteConfirmSlug === p.slug ? null : p.slug)}
                            className="p-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors" title="Deletar">
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </td>
                      </tr>
                      {deleteConfirmSlug === p.slug && (
                        <tr className="bg-rose-950/30">
                          <td colSpan={5} className="px-6 py-3">
                            <div className="flex items-center gap-4 text-sm">
                              <span className="material-symbols-outlined text-rose-500">warning</span>
                              <span className="text-rose-300 font-bold flex-1">Excluir <em>"{p.nome}"</em>? Esta ação não pode ser desfeita.</span>
                              <button onClick={() => handleDeleteProduct(p.slug)}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-colors">Confirmar Exclusão</button>
                              <button onClick={() => setDeleteConfirmSlug(null)}
                                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-lg transition-colors">Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


        {/* TAB: HEATMAP */}
        {activeTab === 'heatmap' && (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl">
            <div>
              <h1 className="text-2xl font-bold text-white">Mapa de Calor</h1>
              <p className="text-sm text-slate-400 mt-1">Visualize exatamente onde seus usuários estão clicando.</p>
            </div>
            <div className="bg-[#161B22] border border-slate-800 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-rose-500 text-3xl">local_fire_department</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Overlay Dinâmico</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
                O mapa de calor é injetado diretamente no site para que você veja os cliques sob o contexto real do design.
              </p>
              <button
                onClick={toggleHeatmap}
                className={`px-6 py-3 rounded-lg font-bold text-sm transition-all shadow-md border ${isHeatmapActive
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/50 hover:bg-rose-500/20'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white border-transparent'
                  }`}
              >
                {isHeatmapActive ? 'Desativar Heatmap' : 'Ativar e Ir Para o Site'}
              </button>
            </div>
          </div>
        )}

        {/* TAB: PRODUTOS */}
        {activeTab === 'produtos' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <header className="flex justify-between items-end flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-white">Inteligência de Produtos</h1>
                <p className="text-sm text-slate-400 mt-1">Ranking de interesse vs intenção de compra.</p>
              </div>
              <DateRangeSelector value={dateRange} onChange={setDateRange} />
            </header>

            {/* Mobile Cards — Produtos */}
            <div className="md:hidden space-y-3">
              {metrics.topProducts.map(p => (
                <div key={p.product} className="bg-[#161B22] rounded-xl p-4 shadow-sm border border-slate-800">
                  <div className="font-semibold text-sm text-white flex items-center gap-2">
                    {p.score >= 80 && <span className="material-symbols-outlined text-amber-400 text-[16px]" title="Top Performer">star</span>}
                    {p.score < 30 && <span className="material-symbols-outlined text-rose-500 text-[16px]" title="Atenção Necessária">warning</span>}
                    <span className="truncate">{p.product}</span>
                  </div>
                  <div className="text-xs text-slate-400 mb-3 flex items-center gap-2 mt-1">
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden inline-block shrink-0">
                      <div className={`h-full ${p.score >= 80 ? 'bg-emerald-500' : p.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${p.score}%` }}></div>
                    </div>
                    <span>Score: {p.score}/100</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <div className="font-bold text-slate-300">{p.clicks}</div>
                      <div className="text-slate-500 mt-0.5">Cliques</div>
                    </div>
                    <div>
                      <div className="font-bold text-emerald-400">{p.whatsapp}</div>
                      <div className="text-slate-500 mt-0.5">WhatsApp</div>
                    </div>
                    <div>
                      <div className={`font-bold ${p.conversionRate >= 20 ? 'text-emerald-400' : p.conversionRate < 5 ? 'text-rose-400' : 'text-blue-400'}`}>
                        {p.conversionRate}%
                      </div>
                      <div className="text-slate-500 mt-0.5">Conversão</div>
                    </div>
                  </div>
                  
                  {p.conversionRate < 5 && p.clicks > 0 && (
                    <div className="mt-3 text-rose-400 text-xs font-bold bg-rose-500/10 px-2 py-1.5 rounded flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">warning</span> Baixa conversão
                    </div>
                  )}
                  {p.conversionRate > 20 && (
                    <div className="mt-3 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-1.5 rounded flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">local_fire_department</span> Produto forte
                    </div>
                  )}
                </div>
              ))}
              {metrics.topProducts.length === 0 && (
                <div className="bg-[#161B22] border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                  <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">inventory_2</span>
                  Nenhum clique registrado.
                </div>
              )}
            </div>

            {/* Desktop Table — Produtos */}
            <div className="hidden md:block bg-[#161B22] border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0E1117] text-slate-400 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Produto</th>
                    <th className="px-6 py-4 font-semibold text-right">Performance Score</th>
                    <th className="px-6 py-4 font-semibold text-right">Cliques Produto</th>
                    <th className="px-6 py-4 font-semibold text-right">Cliques WhatsApp</th>
                    <th className="px-6 py-4 font-semibold text-right">Conversão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {metrics.topProducts.map(p => (
                    <tr key={p.product} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          {p.score >= 80 && <span className="material-symbols-outlined text-amber-400 text-[16px]" title="Top Performer">star</span>}
                          {p.score < 30 && <span className="material-symbols-outlined text-rose-500 text-[16px]" title="Atenção Necessária">warning</span>}
                          {p.product}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${p.score >= 80 ? 'bg-emerald-500' : p.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${p.score}%` }}></div>
                          </div>
                          <span className="font-mono text-xs text-slate-400">{p.score}/100</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-400">{p.clicks}</td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-400 font-bold">{p.whatsapp}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${p.conversionRate >= 20 ? 'bg-emerald-500/10 text-emerald-400' :
                            p.conversionRate > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                          {p.conversionRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {metrics.topProducts.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">Nenhum clique em produto registrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: PÁGINAS */}
        {activeTab === 'paginas' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <header className="flex justify-between items-end flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-white">Performance de Páginas</h1>
                <p className="text-sm text-slate-400 mt-1">Tráfego e retenção por rota.</p>
              </div>
              <DateRangeSelector value={dateRange} onChange={setDateRange} />
            </header>
            <div className="bg-[#161B22] border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0E1117] text-slate-400 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Caminho (URL)</th>
                    <th className="px-6 py-4 font-semibold text-right">Visualizações</th>
                    <th className="px-6 py-4 font-semibold text-right">Tempo Médio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {metrics.topPages.map(p => (
                    <tr key={p.page} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-slate-300 font-mono text-xs">{p.page}</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-400">{p.views}</td>
                      <td className="px-6 py-4 text-right text-slate-400">{formatTime(p.avgTime)}</td>
                    </tr>
                  ))}
                  {metrics.topPages.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-8 text-slate-500">Nenhuma página registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: CONVERSÁƒO */}
        {activeTab === 'conversao' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <header className="flex justify-between items-end flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-white">Funil de Vendas</h1>
                <p className="text-sm text-slate-400 mt-1">Jornada macro do usuário Áºnico.</p>
              </div>
              <DateRangeSelector value={dateRange} onChange={setDateRange} />
            </header>
            <div className="max-w-2xl bg-[#161B22] border border-slate-800 rounded-xl p-8">
              <div className="space-y-6 relative">
                {/* Line connection */}
                <div className="absolute left-6 top-10 bottom-10 w-0.5 bg-slate-800 -z-0"></div>

                <FunnelStep
                  icon="language"
                  title="Visitaram o Site"
                  count={metrics.funnel.site}
                  percentage={100}
                  color="text-indigo-400"
                  bgColor="bg-indigo-500/10"
                />
                <FunnelStep
                  icon="inventory_2"
                  title="Interagiram com Produtos"
                  count={metrics.funnel.product}
                  percentage={metrics.funnel.site ? Math.round((metrics.funnel.product / metrics.funnel.site) * 100) : 0}
                  color="text-amber-400"
                  bgColor="bg-amber-500/10"
                />
                <FunnelStep
                  icon="chat"
                  title="Iniciaram Orçamento (WhatsApp)"
                  count={metrics.funnel.whatsapp}
                  percentage={metrics.funnel.product ? Math.round((metrics.funnel.whatsapp / metrics.funnel.product) * 100) : 0}
                  color="text-emerald-400"
                  bgColor="bg-emerald-500/10"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB: SESSÁ•ES */}
        {activeTab === 'sessoes' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <header className="flex justify-between items-end flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-white">Sessões Recentes</h1>
                <p className="text-sm text-slate-400 mt-1">Análise de visitantes individuais (anonimizados).</p>
              </div>
              <DateRangeSelector value={dateRange} onChange={setDateRange} />
            </header>
            <div className="bg-[#161B22] border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0E1117] text-slate-400 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Session ID</th>
                    <th className="px-6 py-4 font-semibold text-right">Ações (Eventos)</th>
                    <th className="px-6 py-4 font-semibold text-right">Páginas Únicas</th>
                    <th className="px-6 py-4 font-semibold text-right">Duração</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {metrics.sessions.slice(0, 20).map(s => (
                    <tr key={s.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{s.id.substring(0, 16)}...</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-300">{s.events}</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-300">{s.pagesCount}</td>
                      <td className="px-6 py-4 text-right text-slate-400">{formatTime(s.duration)}</td>
                    </tr>
                  ))}
                  {metrics.sessions.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-500">Nenhuma sessão registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tab: Sistema ── */}
        {activeTab === 'sistema' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <header>
              <h1 className="text-2xl font-bold text-white">Sistema</h1>
              <p className="text-sm text-slate-400 mt-1">Health check, manutenção e log de ações.</p>
            </header>

            {/* Maintenance Mode */}
            <div className="bg-[#161B22] border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-white font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-amber-400">construction</span>
                    Modo Manutenção
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Quando ativo, visitantes veem tela de manutenção. Admin continua acessível.</p>
                </div>
                <button
                  onClick={handleToggleMaintenance}
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none ${
                    maintenanceEnabled ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                    maintenanceEnabled ? 'translate-x-9' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {maintenanceEnabled && (
                <div className="mt-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                  <span className="material-symbols-outlined text-amber-400 text-[18px]">warning</span>
                  <span className="text-amber-300 text-xs font-bold">Site em manutenção — visitantes veem tela de aviso</span>
                </div>
              )}
            </div>

            {/* Health Check */}
            <div className="bg-[#161B22] border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-emerald-400">monitor_heart</span>
                  Health Check
                </p>
                <button
                  onClick={handleRunHealthCheck}
                  disabled={healthLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {healthLoading ? (
                    <span className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">refresh</span>
                  )}
                  {healthLoading ? 'Verificando...' : 'Verificar Sistema'}
                </button>
              </div>

              {healthReport ? (
                <div className="space-y-2">
                  <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-sm font-bold ${
                    healthReport.overall === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : healthReport.overall === 'degraded' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    <span className="material-symbols-outlined text-[18px]">
                      {healthReport.overall === 'ok' ? 'check_circle' : healthReport.overall === 'degraded' ? 'warning' : 'error'}
                    </span>
                    Status geral: {healthReport.overall.toUpperCase()} — {new Date(healthReport.checkedAt).toLocaleTimeString('pt-BR')}
                  </div>
                  {healthReport.checks.map(c => (
                    <div key={c.name} className="flex items-center justify-between px-4 py-3 bg-[#0E1117] rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          c.status === 'ok' ? 'bg-emerald-400'
                          : c.status === 'degraded' ? 'bg-amber-400'
                          : c.status === 'skip' ? 'bg-slate-600'
                          : 'bg-rose-400'
                        }`} />
                        <span className="text-sm text-slate-300">{c.name}</span>
                        {c.message && <span className="text-xs text-slate-500">— {c.message}</span>}
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-bold ${
                          c.status === 'ok' ? 'text-emerald-400'
                          : c.status === 'degraded' ? 'text-amber-400'
                          : c.status === 'skip' ? 'text-slate-500'
                          : 'text-rose-400'
                        }`}>{c.status.toUpperCase()}</span>
                        {c.latencyMs && <span className="block text-[10px] text-slate-500">{c.latencyMs}ms</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">Clique em "Verificar Sistema" para rodar o health check.</p>
              )}
            </div>

            {/* Admin Log */}
            <div className="bg-[#161B22] border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-indigo-400">history</span>
                  Log de Ações Administrativas
                </p>
                {adminLog.length > 0 && (
                  <button
                    onClick={() => { setAdminLog([]); localStorage.removeItem('mdi_admin_log'); }}
                    className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
                  >Limpar log</button>
                )}
              </div>
              {adminLog.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Nenhuma ação registrada ainda.</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {adminLog.map(entry => (
                    <div key={entry.id} className="flex items-start gap-3 px-3 py-2.5 bg-[#0E1117] rounded-lg">
                      <span className="text-[10px] font-mono text-slate-500 shrink-0 mt-0.5">{new Date(entry.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded shrink-0">{entry.action}</span>
                      <span className="text-xs text-slate-400">{entry.detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lixeira */}
            {catalogItems.filter(p => !!(p as any).deleted_at).length > 0 && (
              <div className="bg-[#161B22] border border-rose-900/30 rounded-xl p-6">
                <p className="text-white font-bold flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[20px] text-rose-400">delete</span>
                  Lixeira ({catalogItems.filter(p => !!(p as any).deleted_at).length} produtos)
                </p>
                <div className="space-y-2">
                  {catalogItems.filter(p => !!(p as any).deleted_at).map(p => (
                    <div key={p.slug} className="flex items-center justify-between px-4 py-3 bg-[#0E1117] rounded-lg">
                      <div>
                        <span className="text-sm text-slate-300 font-medium">{p.nome}</span>
                        <span className="block text-[10px] text-slate-500">Excluído em {new Date((p as any).deleted_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestoreProduct(p.slug)}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg transition-colors"
                        >Restaurar</button>
                        <button
                          onClick={() => handlePermanentDelete(p.slug)}
                          className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-lg transition-colors"
                        >Excluir</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Global actions */}
        <div className="mt-12 pt-6 border-t border-slate-800 flex justify-end">
          <button
            onClick={clearData}
            className="text-xs font-bold text-rose-500/50 hover:text-rose-400 transition-colors uppercase tracking-widest flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
            Purge Local Database
          </button>
        </div>

      </main>

      {/* CMS MODAL */}
      {isModalOpen && editingProduct && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="bg-[#161B22] border border-slate-700 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">
            <header className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#0E1117] rounded-t-2xl shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400">edit_document</span>
                {editingProduct.slug ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <form id="product-form" onSubmit={handleSaveProduct} className="space-y-5">
                {/* Nome & Marca */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Nome do Produto *</label>
                    <input type="text" required value={editingProduct.nome}
                      onChange={e => setEditingProduct({ ...editingProduct, nome: e.target.value })}
                      className="w-full bg-[#0E1117] border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                      placeholder="Ex: Vedacit 3mm" />
                  </div>
                  <div>
                    <label className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                      <span>Marca *</span>
                    </label>
                    {!showNewBrandInput ? (
                      <div className="relative">
                        <select required value={editingProduct.marca || ''}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '__new__') { setShowNewBrandInput(true); return; }
                            setEditingProduct({ ...editingProduct, marca: val });
                          }}
                          className="w-full bg-[#0E1117] border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 transition-all outline-none appearance-none"
                        >
                          <option value="" disabled>Selecione uma marca</option>
                          {Array.from(new Set([...availableBrands, editingProduct.marca])).filter(Boolean).sort().map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                          <option value="__new__" className="text-indigo-400 font-bold">➕ Nova Marca</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-lg">expand_more</span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input type="text" autoFocus
                          value={newBrandInput}
                          onChange={e => setNewBrandInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomBrand(); } if (e.key === 'Escape') setShowNewBrandInput(false); }}
                          className="flex-1 bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-3 text-white text-xs focus:border-indigo-500 transition-all outline-none"
                          placeholder="Nome da nova marca..."
                        />
                        <button type="button" onClick={handleAddCustomBrand} disabled={!newBrandInput.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50">OK</button>
                        <button type="button" onClick={() => setShowNewBrandInput(false)} className="px-3 py-2 text-slate-400 hover:text-white text-xs rounded-lg transition-colors flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">close</span></button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Categoria & Destaque */}
                <div className="flex flex-col gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Categoria *</label>
                    <div className="relative flex gap-2">
                      <select value={editingProduct.categoria}
                         onChange={e => {
                           const val = e.target.value;
                           if (val === '__new__') { setShowNewCategoryInput(true); return; }
                           const label = CATEGORIAS[val]?.nome || customCategories[val] || val;
                           setEditingProduct({ ...editingProduct, categoria: val as any, categoriaLabel: label });
                         }}
                         className="flex-1 bg-[#0E1117] border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 transition-all outline-none">
                         <optgroup label="Categorias padrão">
                           {Object.keys(CATEGORIAS).map(key => (
                             <option key={key} value={key}>{CATEGORIAS[key].nome}</option>
                           ))}
                         </optgroup>
                         {Object.keys(customCategories).length > 0 && (
                           <optgroup label="Categorias personalizadas">
                             {Object.keys(customCategories).map(slug => (
                               <option key={slug} value={slug}>{customCategories[slug]}</option>
                             ))}
                           </optgroup>
                         )}
                         <option value="__new__">➕ Nova categoria...</option>
                       </select>
                       
                       {customCategories[editingProduct.categoria || ''] && (
                         <button
                           type="button"
                           onClick={() => {
                             const slugToRemove = editingProduct.categoria;
                             if (window.confirm(`Remover categoria customizada "${customCategories[slugToRemove]}" globalmente?`)) {
                               const next = { ...customCategories };
                               delete next[slugToRemove];
                               setCustomCategories(next);
                               localStorage.setItem('mdi_custom_categories', JSON.stringify(next));
                               setEditingProduct({ ...editingProduct, categoria: '', categoriaLabel: '' });
                             }
                           }}
                           title="Remover Categoria Customizada"
                           className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 px-3 rounded-lg flex items-center justify-center transition-colors"
                         >
                           <span className="material-symbols-outlined text-[18px]">delete</span>
                         </button>
                       )}
                    </div>
                     {showNewCategoryInput && (
                       <div className="mt-2 flex gap-2">
                         <input
                           type="text"
                           autoFocus
                           value={newCategoryInput}
                           onChange={e => setNewCategoryInput(e.target.value)}
                           onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomCategory(); } if (e.key === 'Escape') setShowNewCategoryInput(false); }}
                           placeholder="Nome da nova categoria..."
                           className="flex-1 bg-[#0E1117] border border-indigo-500 rounded-lg px-3 py-2 text-white text-sm outline-none"
                         />
                         <button type="button" onClick={handleAddCustomCategory} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors">Criar</button>
                         <button type="button" onClick={() => setShowNewCategoryInput(false)} className="px-3 py-2 text-slate-400 hover:text-white text-xs rounded-lg transition-colors">✕</button>
                       </div>
                     )}
                  </div>
                  <div className="flex flex-col">
                    {(() => {
                      const isEditing = !!editingProduct.slug;
                      const isAlreadyDestaque = editingProduct.destaque;
                      const limitReached = destaqueAtual >= MAX_DESTAQUE && !isAlreadyDestaque;
                      return (
                        <div className="w-full bg-[#0E1117] border border-slate-800 p-4 rounded-xl">
                          <label className={`flex flex-col sm:flex-row sm:items-center gap-4 w-full ${limitReached ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                            <div className="relative shrink-0 flex items-center">
                              <input type="checkbox" checked={!!editingProduct.destaque}
                                disabled={limitReached}
                                onChange={e => {
                                  if (limitReached) return;
                                  setEditingProduct({ ...editingProduct, destaque: e.target.checked });
                                }}
                                className="sr-only" />
                              <div className={`block w-14 h-8 rounded-full transition-colors ${editingProduct.destaque ? 'bg-amber-500' : 'bg-slate-700'}`}></div>
                              <div className={`dot absolute left-1 bg-white w-6 h-6 rounded-full transition-transform ${editingProduct.destaque ? 'translate-x-6' : ''}`}></div>
                            </div>
                            <div className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-sm">Destacar na Home</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${limitReached ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-800 text-slate-400'}`}>
                                  {destaqueAtual} / {MAX_DESTAQUE}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 font-normal leading-snug">
                                {limitReached 
                                  ? 'O limite máximo de produtos na vitrine principal foi atingido.'
                                  : 'Ao ativar, este produto aparecerá com prioridade na vitrine principal da loja.'}
                              </p>
                            </div>
                          </label>
                          {limitReached && (
                            <div className="mt-4 flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold px-3 py-2.5 rounded-lg">
                              <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
                              <span>Para destacar este produto, você precisa remover o destaque de outro produto primeiro.</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Imagem */}
                <div className="bg-[#161B22] p-4 rounded-xl border border-slate-800">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Mídia do Produto</label>
                  
                  {/* Imagem Principal */}
                  <div className="mb-6">
                    <span className="block text-sm font-bold text-slate-300 mb-2">Imagem Principal *</span>
                    <div className="flex gap-4 items-start">
                      <div className="w-24 h-24 bg-[#0E1117] rounded-xl border-2 border-dashed border-slate-700 overflow-hidden flex items-center justify-center p-2 shrink-0 relative group">
                        {editingProduct.imagem ? (
                          <>
                            <img src={editingProduct.imagem} alt="Preview" className="max-w-full max-h-full object-contain" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button type="button" onClick={() => setEditingProduct({ ...editingProduct, imagem: '' })} className="text-rose-500 bg-rose-500/20 p-1.5 rounded-lg hover:bg-rose-500/40 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <span className="material-symbols-outlined text-slate-600 text-3xl">image</span>
                        )}
                      </div>
                      <div className="flex-1 space-y-3">
                        <label className={`flex items-center justify-center gap-2 font-bold py-2 px-4 rounded-lg transition-all w-full md:w-auto text-sm ${isUploadingImage ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 cursor-pointer'}`}>
                          {isUploadingImage ? (
                            <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span className="material-symbols-outlined text-[18px]">upload</span>
                          )}
                          {isUploadingImage ? 'Processando...' : 'Fazer Upload da Imagem'}
                          <input type="file" accept="image/*" disabled={isUploadingImage} onChange={handleMainImageUpload} className="hidden" />
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-xs font-bold">OU URL:</span>
                          <input type="text" value={editingProduct.imagem || ''}
                            disabled={isUploadingImage}
                            onChange={e => setEditingProduct({ ...editingProduct, imagem: e.target.value })}
                            className="flex-1 bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 transition-all outline-none text-xs disabled:opacity-50"
                            placeholder="https://..." />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Carrossel de Imagens */}
                  <div>
                    <span className="block text-sm font-bold text-slate-300 mb-2">Imagens do Carrossel (Opcional)</span>
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-3">
                        {(editingProduct.imagens || []).map((img, idx) => (
                          <div key={idx} className="w-16 h-16 bg-[#0E1117] rounded-lg border border-slate-700 overflow-hidden relative group">
                            <img src={img} alt={`Carousel ${idx}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button type="button" onClick={() => {
                                const newImgs = [...(editingProduct.imagens || [])];
                                newImgs.splice(idx, 1);
                                setEditingProduct({ ...editingProduct, imagens: newImgs });
                              }} className="text-rose-500 bg-rose-500/20 p-1 rounded-md hover:bg-rose-500/40">
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                              </button>
                            </div>
                          </div>
                        ))}
                        <label className={`w-16 h-16 rounded-lg flex items-center justify-center transition-colors group ${isUploadingImage ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' : 'bg-indigo-500/5 hover:bg-indigo-500/10 border-2 border-dashed border-indigo-500/30 cursor-pointer text-indigo-400'}`}>
                          {isUploadingImage ? (
                            <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span className="material-symbols-outlined group-hover:scale-110 transition-transform">add_photo_alternate</span>
                          )}
                          <input type="file" accept="image/*" multiple disabled={isUploadingImage} onChange={handleCarouselImagesUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Para que serve + IA */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Para que serve — Descrição Principal *</label>
                    <button
                      type="button"
                      onClick={handleGenerateSummary}
                      disabled={isGeneratingAI || !editingProduct?.nome?.trim() || !editingProduct?.marca?.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all border disabled:opacity-40 disabled:cursor-not-allowed
                        bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/30 text-violet-400"
                      title={!editingProduct?.nome?.trim() ? 'Preencha Nome e Marca primeiro' : 'Gerar descrição com IA'}
                    >
                      {isGeneratingAI ? (
                        <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                      )}
                      {isGeneratingAI ? 'Gerando...' : 'Gerar com IA'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 mb-2">Exibida em destaque na página, entre aspas. Máx. 300 caracteres.</p>
                  <textarea required value={editingProduct.resumo}
                    onChange={e => setEditingProduct({ ...editingProduct, resumo: e.target.value })}
                    maxLength={300}
                    className="w-full bg-[#0E1117] border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 transition-all outline-none h-24 resize-none"
                    placeholder="Manta asfáltica elastômerica para impermeabilização de lajes..." />
                  <div className="flex justify-end mt-1">
                    <span className={`text-[10px] font-mono ${
                      (editingProduct.resumo?.length || 0) > 280 ? 'text-amber-400' : 'text-slate-600'
                    }`}>{editingProduct.resumo?.length || 0}/300</span>
                  </div>
                </div>

                {/* Tipo de Produto — dinâmico */}
                <div className="border-t border-slate-800 pt-4 mb-6">
                  <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">category</span>Taxonomia Dinâmica
                  </p>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo do Produto</label>
                  <p className="text-[10px] text-slate-600 mb-3">Usado para os filtros da loja. Escolha as categorias que representam este produto.</p>

                  <div className="space-y-1.5 mb-3">
                    {tipoInput.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 group">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <input
                          type="text"
                          value={item}
                          readOnly
                          className="flex-1 bg-transparent border-0 border-b border-slate-800 text-sm text-slate-300 outline-none py-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = tipoInput.filter((_, i) => i !== idx);
                            setTipoInput(next);
                            setEditingProduct({ ...editingProduct, tipo: next });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-400 transition-all p-1 shrink-0"
                        >
                          <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const suggestions = [...TIPO_OPTS, ...customTipoOpts].filter(o => !tipoInput.includes(o));
                    return suggestions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {suggestions.map(opt => {
                          const isCustom = customTipoOpts.includes(opt);
                          return (
                            <div key={opt} className="flex items-center border border-slate-700 rounded-full group hover:border-emerald-500 transition-all overflow-hidden bg-[#0E1117]">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...tipoInput, opt];
                                  setTipoInput(next);
                                  setEditingProduct({ ...editingProduct, tipo: next });
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold text-slate-400 group-hover:text-emerald-300 transition-colors"
                              >+ {opt}</button>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!window.confirm(`Remover "${opt}" globalmente do sistema?`)) return;
                                  
                                  if (isCustom) {
                                    setCustomTipoOpts(prev => prev.filter(x => x !== opt));
                                  } else {
                                    const taxItem = taxonomy.find(t => t.slug === opt && t.group_name === 'TIPO');
                                    if (taxItem) {
                                      try {
                                        await removeTaxonomyItem(taxItem.id);
                                      } catch (err) {
                                        console.error('Failed to remove taxonomy item', err);
                                      }
                                    }
                                  }
                                }}
                                className="px-1.5 py-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border-l border-slate-700 group-hover:border-emerald-500 flex items-center justify-center"
                                title="Remover globalmente"
                              >
                                <span className="material-symbols-outlined text-[12px]">close</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null;
                  })()}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTipoOpt}
                      onChange={e => setNewTipoOpt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTipoOpt(); } }}
                      placeholder="Adicionar novo tipo..."
                      className="flex-1 bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddTipoOpt}
                      disabled={!newTipoOpt.trim()}
                      className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg transition-colors disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    </button>
                  </div>
                </div>

                {/* Indicado Para — dinâmico */}
                <div className="border-t border-slate-800 pt-4">
                  <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">web</span>Conteúdo da Página
                  </p>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Aplicação (Indicado Para)</label>
                  <p className="text-[10px] text-slate-600 mb-3">Usado também nos filtros da loja.</p>

                  {/* Itens já selecionados — editáveis inline */}
                  <div className="space-y-1.5 mb-3">
                    {aplicacaoInput.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 group">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        <input
                          type="text"
                          value={item}
                          onChange={e => {
                            const next = [...aplicacaoInput];
                            next[idx] = e.target.value;
                            setAplicacaoInput(next);
                            setEditingProduct({ ...editingProduct, aplicacao: next.filter(s => s.trim()) });
                          }}
                          className="flex-1 bg-transparent border-0 border-b border-slate-800 focus:border-indigo-500 text-sm text-slate-300 outline-none py-1 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = aplicacaoInput.filter((_, i) => i !== idx);
                            setAplicacaoInput(next);
                            setEditingProduct({ ...editingProduct, aplicacao: next });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-400 transition-all p-1 shrink-0"
                        >
                          <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Sugestões rápidas (APLICACAO_OPTS não selecionados ainda) */}
                  {(() => {
                    const suggestions = [...APLICACAO_OPTS, ...customAplicacaoOpts].filter(o => !aplicacaoInput.includes(o));
                    return suggestions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {suggestions.map(opt => {
                          const isCustom = customAplicacaoOpts.includes(opt);
                          return (
                            <div key={opt} className="flex items-center border border-slate-700 rounded-full group hover:border-indigo-500 transition-all overflow-hidden bg-[#0E1117]">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...aplicacaoInput, opt];
                                  setAplicacaoInput(next);
                                  setEditingProduct({ ...editingProduct, aplicacao: next });
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold text-slate-400 group-hover:text-indigo-300 transition-colors"
                              >+ {opt}</button>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!window.confirm(`Remover "${opt}" globalmente do sistema?`)) return;

                                  if (isCustom) {
                                    setCustomAplicacaoOpts(prev => prev.filter(x => x !== opt));
                                  } else {
                                    const taxItem = taxonomy.find(t => t.slug === opt && t.group_name === 'APLICACAO');
                                    if (taxItem) {
                                      try {
                                        await removeTaxonomyItem(taxItem.id);
                                      } catch (err) {
                                        console.error('Failed to remove taxonomy item', err);
                                      }
                                    }
                                  }
                                }}
                                className="px-1.5 py-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border-l border-slate-700 group-hover:border-indigo-500 flex items-center justify-center"
                                title="Remover globalmente"
                              >
                                <span className="material-symbols-outlined text-[12px]">close</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null;
                  })()}

                  {/* Adicionar opção personalizada */}
                  <div className="flex gap-2 mb-8">
                    <input
                      type="text"
                      value={newAplicacaoOpt}
                      onChange={e => setNewAplicacaoOpt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAplicacaoOpt(); } }}
                      placeholder="Adicionar opção personalizada..."
                      className="flex-1 bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddAplicacaoOpt}
                      disabled={!newAplicacaoOpt.trim()}
                      className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 text-xs font-bold rounded-lg transition-colors disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    </button>
                  </div>

                  {/* Como Usar */}
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Como Usar — Passo a Passo</label>
                  <p className="text-[10px] text-slate-600 mb-2">Numerado automaticamente na página.</p>
                  <div className="space-y-2 mb-5">
                    {comoUsarInput.map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                        <input type="text" value={step}
                          onChange={e => {
                            const next = [...comoUsarInput]; next[i] = e.target.value;
                            setComoUsarInput(next);
                            setEditingProduct({ ...editingProduct, comoUsar: next.filter(s => s.trim()) });
                          }}
                          className="flex-1 bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                          placeholder={`Passo ${i + 1}...`} />
                        {comoUsarInput.length > 1 && (
                          <button type="button" onClick={() => { const n = comoUsarInput.filter((_,j) => j !== i); setComoUsarInput(n); setEditingProduct({ ...editingProduct, comoUsar: n.filter(s=>s.trim()) }); }}
                            className="text-rose-500 hover:text-rose-400 p-1">
                            <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setComoUsarInput([...comoUsarInput, ''])}
                      className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs font-bold">
                      <span className="material-symbols-outlined text-[16px]">add_circle</span> Adicionar passo
                    </button>
                  </div>

                  {/* Especificações */}
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Especificações Técnicas</label>
                  <p className="text-[10px] text-slate-600 mb-2">Chave → Valor (ex: Espessura → 3mm). Exibido como tabela.</p>
                  <div className="space-y-2">
                    {specsInput.map((spec, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="text" value={spec.key} placeholder="Chave"
                          onChange={e => { const n=[...specsInput]; n[i]={...n[i],key:e.target.value}; setSpecsInput(n); const o:Record<string,string>={}; n.filter(s=>s.key.trim()).forEach(s=>{o[s.key]=s.val;}); setEditingProduct({...editingProduct,especificacoes:o}); }}
                          className="flex-1 bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none" />
                        <span className="text-slate-600">→</span>
                        <input type="text" value={spec.val} placeholder="Valor"
                          onChange={e => { const n=[...specsInput]; n[i]={...n[i],val:e.target.value}; setSpecsInput(n); const o:Record<string,string>={}; n.filter(s=>s.key.trim()).forEach(s=>{o[s.key]=s.val;}); setEditingProduct({...editingProduct,especificacoes:o}); }}
                          className="flex-1 bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none" />
                        {specsInput.length > 1 && (
                          <button type="button" onClick={() => setSpecsInput(specsInput.filter((_,j)=>j!==i))} className="text-rose-500 p-1">
                            <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setSpecsInput([...specsInput, {key:'',val:''}])}
                      className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs font-bold">
                      <span className="material-symbols-outlined text-[16px]">add_circle</span> Adicionar especificação
                    </button>
                  </div>
                </div>

                <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>Bloco Final (automático)
                  </p>
                  <p className="text-[10px] text-slate-500">Alerta de infiltração, "Por que escolher?" e botão Receber Orçamento são inseridos automaticamente em todas as páginas.</p>
                </div>
              </form>
            </div>

            <footer className="p-5 border-t border-slate-800 bg-[#0E1117] rounded-b-2xl flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving}
                className="px-5 py-3 rounded-lg text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[48px] disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" form="product-form" disabled={isSaving}
                className="px-6 py-3 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg flex items-center gap-2 min-h-[48px] disabled:opacity-70">
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Salvando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Salvar Produto
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Manage Brands Modal */}
      {showManageBrandsModal && (
        <ManageBrandsModal onClose={() => setShowManageBrandsModal(false)} />
      )}

      {/* Normalize Brands Modal */}
      {showNormalizeBrandsModal && (
        <NormalizeBrandsModal onClose={() => setShowNormalizeBrandsModal(false)} />
      )}

      {/* Toast Notification */}
      {saveToast && (
        <div className={`fixed bottom-6 right-6 z-[99999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border text-sm font-bold animate-in slide-in-from-bottom-3 duration-300 ${
          saveToast.type === 'success'
            ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300'
            : 'bg-rose-950 border-rose-500/40 text-rose-300'
        }`}>
          <span className="material-symbols-outlined text-[22px]">
            {saveToast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {saveToast.msg}
        </div>
      )}
    </div>
  );
};

// --- Subcomponents ---

const MetricCard = ({ title, value, icon, color }: { title: string, value: string | number, icon: string, color: string }) => (
  <div className="bg-[#161B22] border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
    <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform ${color}`}>
      <span className="material-symbols-outlined text-6xl" aria-hidden="true">{icon}</span>
    </div>
    <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-1 relative z-10">{title}</p>
    <p className={`text-3xl font-black relative z-10 ${color}`}>{value}</p>
  </div>
);

const FunnelStep = ({ icon, title, count, percentage, color, bgColor }: any) => (
  <div className="flex items-center gap-4 relative z-10 bg-[#161B22] group">
    <div className={`w-12 h-12 rounded-full ${bgColor} ${color} flex items-center justify-center border border-slate-800 group-hover:scale-110 transition-transform shadow-lg`}>
      <span className="material-symbols-outlined">{icon}</span>
    </div>
    <div className="flex-1 bg-[#0E1117] border border-slate-800 rounded-lg p-4 flex justify-between items-center">
      <span className="font-bold text-slate-200">{title}</span>
      <div className="text-right">
        <span className="block font-black text-xl text-white">{count} <span className="text-sm font-normal text-slate-500">usuários</span></span>
        <span className={`text-xs font-bold ${color}`}>{percentage}% de retenção</span>
      </div>
    </div>
  </div>
);

export default AdminDashboard;
