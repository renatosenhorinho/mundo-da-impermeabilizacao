import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  getAnalyticsEvents, AnalyticsEvent, getLocalLeads, Lead,
  BehavioralMetrics, onHotLead, markLeadConverted, LeadScoreBreakdown
} from '@/lib/analytics';
import { products, Product, saveCustomProducts, CATEGORIAS, generateSlug } from '@/data/products';
import { supabase } from '@/lib/supabase';
import { MAX_DESTAQUE } from '@/config/constants';
import { DateRangeSelector } from '@/components/ui/date-range-selector';
import {
  DateRangeState,
  filterEventsByDateRange,
  formatRelativeDate,
  nowISO,
} from '@/utils/dateUtils';

type Tab = 'dashboard' | 'catalogo' | 'heatmap' | 'produtos' | 'paginas' | 'conversao' | 'sessoes';

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

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
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
        
        resolve(canvas.toDataURL('image/webp', 0.8));
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

export const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
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
  const [catalogSort, setCatalogSort] = useState<'recentes' | 'nome' | 'destaque'>('recentes');
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState<string | null>(null);
  const [hotLeadAlert, setHotLeadAlert] = useState<Lead | null>(null);
  const [conversionModalId, setConversionModalId] = useState<string | null>(null);
  const [conversionValue, setConversionValue] = useState('');
  const [modalTab, setModalTab] = useState<'basico' | 'conteudo' | 'preview'>('basico');
  const [specsInput, setSpecsInput] = useState<{key: string; val: string}[]>([{key: '', val: ''}]);
  const [comoUsarInput, setComoUsarInput] = useState<string[]>(['']);
  const [aplicacaoInput, setAplicacaoInput] = useState<string[]>([]);

  const APLICACAO_OPTS = [
    'Lajes planas e inclinadas',
    'Coberturas e telhados',
    'Terraços e varandas',
    'Calhas e rufos',
    'Reservatórios e piscinas',
    'Paredes e fachadas',
    'Banheiros e áreas molhadas',
    'Piscinas e tanques',
  ];

  // Hot Lead Alert listener
  useEffect(() => {
    const unsub = onHotLead((lead) => {
      setHotLeadAlert(lead);
      setTimeout(() => setHotLeadAlert(null), 8000);
    });
    return unsub;
  }, []);

  useEffect(() => {
    // Check real Supabase session on load
    const checkSession = async () => {
      try {
        if (!supabase) {
          // LOCAL FALLBACK (Dev & Prod)
          try {
            const rawSession = localStorage.getItem('mdi_admin_session');
            if (rawSession) {
              const session = JSON.parse(rawSession);
              if (session && session.value && session.expiresAt > Date.now()) {
                setIsAuthenticated(true);
              } else {
                localStorage.removeItem('mdi_admin_session');
              }
            }
          } catch (e) {
            localStorage.removeItem('mdi_admin_session');
          }
          setIsLoadingAuth(false);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        setIsAuthenticated(!!session);
        setIsLoadingAuth(false);

        // Setup Auth listener for tab-sync
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setIsAuthenticated(!!session);
        });
        return () => subscription.unsubscribe();
      } catch (err) {
        console.error('Auth Error:', err);
        setSystemError('Painel temporariamente indisponível. Tente novamente mais tarde.');
        setIsLoadingAuth(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      setEvents(getAnalyticsEvents());
      setCatalogItems(products); // Load the dynamic merged products

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
    }
  }, [isAuthenticated]);

  // Renovar sessão automaticamente quando o admin interage
  useEffect(() => {
    if (!isAuthenticated) return;
    
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
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (supabase) {
      setIsLoadingAuth(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoginError('Credenciais inválidas. Tente novamente.');
        setIsLoadingAuth(false);
      } else {
        setIsAuthenticated(true);
        setIsLoadingAuth(false);
      }
    } else {
      // Sistema de login simples com variável de ambiente (fallback se Supabase falhar/não existir)
      const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY;
      if (ADMIN_KEY && password === ADMIN_KEY) {
        localStorage.setItem('mdi_admin_session', JSON.stringify({
          value: true,
          expiresAt: Date.now() + 1000 * 60 * 60 * 6 // 6 horas
        }));
        setIsAuthenticated(true);
        window.location.href = "/admin"; // Auto-redirect forçado se exigido
      } else {
        setLoginError('Senha incorreta.');
      }
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('mdi_admin_session');
    window.location.href = "/";
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
  
  /** Gera nome de arquivo \u00fanico para evitar sobrescrita e colisoes no bucket */
  const generateUniqueFileName = () => {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `products/${timestamp}-${randomPart}.webp`;
  };

  /** Extrai o filePath relativo de uma URL p\u00fablica do Supabase para deletar */
  const extractFilePathFromUrl = (url: string): string | null => {
    if (!url || url.startsWith('data:')) return null;
    try {
      const match = url.match(/\/storage\/v1\/object\/public\/product-images\/(.+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  /** Remove imagem antiga do Supabase Storage (sem bloquear fluxo em caso de erro) */
  const deleteOldImage = async (oldUrl: string): Promise<void> => {
    if (!supabase || !oldUrl) return;
    const oldPath = extractFilePathFromUrl(oldUrl);
    if (!oldPath) return;
    try {
      await supabase.storage.from('product-images').remove([oldPath]);
    } catch (e) {
      // Falha silenciosa: imagem antiga n\u00e3o bloqueia o fluxo
      console.warn('N\u00e3o foi poss\u00edvel deletar imagem antiga:', oldPath);
    }
  };

  /** 
   * Upload principal: comprime \u2192 tenta Supabase \u2192 fallback base64 (s\u00f3 se arquivo pequeno)
   * Retorna a URL final (CDN p\u00fablica ou base64) e lanca erro se nenhum funcionar.
   */
  const uploadImage = async (file: File, oldUrl?: string): Promise<string> => {
    const MAX_BASE64_SIZE = 500_000; // 500KB limite para fallback local
    
    // 1. Comprimir primeiro (sempre)
    const base64 = await compressImage(file);
    
    // 2. Tentar Supabase Storage
    if (supabase) {
      try {
        const res = await fetch(base64);
        const blob = await res.blob();
        const filePath = generateUniqueFileName();

        const { error } = await supabase.storage
          .from('product-images')
          .upload(filePath, blob, {
            contentType: 'image/webp',
            upsert: false // Nunca sobrescrever, nome \u00fanico garante isso
          });

        if (error) throw new Error(error.message);

        // 3. Sucesso no Supabase: deletar imagem antiga e retornar nova URL
        if (oldUrl) await deleteOldImage(oldUrl);
        
        const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
        return data.publicUrl;
      } catch (e) {
        console.error('Supabase upload falhou, tentando fallback:', e);
        // Segue para fallback base64...
      }
    }
    
    // 4. Fallback base64 (apenas para arquivos pequenos)
    if (file.size <= MAX_BASE64_SIZE) {
      return base64;
    }
    
    // 5. Arquivo grande + Supabase falhou = erro controlado
    throw new Error(
      `Imagem muito grande para fallback offline (${Math.round(file.size / 1024)}KB). ` +
      'Verifique sua conex\u00e3o com o servidor e tente novamente.'
    );
  };

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Limpar input para permitir reselecionar o mesmo arquivo
    e.target.value = '';
    setIsUploadingImage(true);
    try {
      const oldUrl = editingProduct?.imagem || '';
      const finalUrl = await uploadImage(file, oldUrl);
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
      const urls = await Promise.all(files.map(f => uploadImage(f)));
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
        msg: `ðŸš« Limite atingido: já existem ${MAX_DESTAQUE} produtos em destaque. Remova um antes de adicionar outro.`
      });
      setTimeout(() => setSaveToast(null), 5000);
      return;
    }

    setIsSaving(true);
    try {
      let updatedCatalog = [...catalogItems];
      const slug = isNew ? generateSlug(editingProduct.nome) : editingProduct.slug!;

      const finalProduct: any = {
        ...(editingProduct as Product),
        slug,
        codigo: editingProduct.codigo || `SKU-${Date.now().toString().slice(-6)}`,
        nomeOriginal: editingProduct.nomeOriginal || editingProduct.nome,
        categoriaLabel: CATEGORIAS[editingProduct.categoria || 'manta-asfaltica']?.nome || editingProduct.categoria,
        ativo: true,
        ordem: editingProduct.ordem || 1,
        isCustom: true,
        updated_at: nowISO(),
      };

      if (isNew) {
        updatedCatalog.push(finalProduct);
      } else {
        updatedCatalog = updatedCatalog.map(p => p.slug === finalProduct.slug ? finalProduct : p);
      }

      setCatalogItems(updatedCatalog);
      const dynamicOnly = updatedCatalog.filter(p => (p as any).isCustom);
      await saveCustomProducts(dynamicOnly);

      setSaveToast({ type: 'success', msg: isNew ? 'Produto criado com sucesso!' : 'Produto atualizado com sucesso!' });
      setTimeout(() => setSaveToast(null), 3000);
      setIsModalOpen(false);
      setEditingProduct(null);
    } catch (err) {
      setSaveToast({ type: 'error', msg: 'Erro ao salvar. Tente novamente.' });
      setTimeout(() => setSaveToast(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (slug: string) => {
    const updatedCatalog = catalogItems.map(p =>
      p.slug === slug ? { ...p, ativo: false, isCustom: true, updated_at: nowISO() } : p
    );
    setCatalogItems(updatedCatalog);
    const dynamicOnly = updatedCatalog.filter(p => (p as any).isCustom);
    await saveCustomProducts(dynamicOnly);
    setDeleteConfirmSlug(null);
  };

  /** Toggle de disponibilidade — update otimista imediato + salva em background */
  const handleToggleDisponivel = async (slug: string, currentActive: boolean) => {
    const novoEstado = !currentActive;
    // Update otimista: UI muda instantaneamente
    const updatedCatalog = catalogItems.map(p =>
      p.slug === slug ? { ...p, disponivel: novoEstado, isCustom: true, updated_at: nowISO() } : p
    );
    setCatalogItems(updatedCatalog);

    // Toast de feedback
    setSaveToast({
      type: novoEstado ? 'success' : 'error',
      msg: novoEstado ? 'âœ… Produto reativado — visível no site.' : 'ðŸš« Produto desativado — oculto do site.'
    });
    setTimeout(() => setSaveToast(null), 3000);

    // Persiste em background
    try {
      const dynamicOnly = updatedCatalog.filter(p => (p as any).isCustom);
      await saveCustomProducts(dynamicOnly);

      if (supabase) {
        await supabase.from('products').update({ disponivel: novoEstado }).eq('slug', slug);
      }
    } catch (e) {
      // Revert se falhar
      setCatalogItems(catalogItems);
      setSaveToast({ type: 'error', msg: 'Erro ao salvar. Tente novamente.' });
      setTimeout(() => setSaveToast(null), 3000);
    }
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
      comoUsar: []
    });
    setSpecsInput([{key: '', val: ''}]);
    setComoUsarInput(['']);
    setAplicacaoInput([]);
    setModalTab('basico');
    setIsModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct({ ...product });
    setAplicacaoInput(product.aplicacao || []);
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
    let list = catalogItems.filter(p => p.ativo);
    if (catalogSearch) {
      const q = catalogSearch.toLowerCase();
      list = list.filter(p => p.nome.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q));
    }
    if (catalogSort === 'nome') list = [...list].sort((a, b) => a.nome.localeCompare(b.nome));
    if (catalogSort === 'destaque') list = [...list].sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0));
    return list;
  }, [catalogItems, catalogSearch, catalogSort]);

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

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center px-4 font-sans">
        <form onSubmit={handleLogin} className="bg-[#161B22] p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-800 relative overflow-hidden">
          {/* Subtle glow effect */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none"></div>

          <div className="text-center mb-8 relative z-10">
            <span className="material-symbols-outlined text-5xl text-emerald-500 mb-4 block" aria-hidden="true">admin_panel_settings</span>
            <h1 className="text-2xl font-black text-white tracking-wider">Painel Administrativo</h1>
            <p className="text-emerald-500/80 text-xs font-bold uppercase tracking-widest mt-2">Mundo da Impermeabilização</p>
          </div>

          {loginError && (
            <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs font-bold text-center">
              {loginError}
            </div>
          )}

          <div className="mb-4 relative z-10">
            <label className="block text-slate-400 text-[11px] font-bold mb-2 uppercase tracking-widest">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0E1117] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-all"
              placeholder="admin@empresa.com"
            />
          </div>

          <div className="mb-6 relative z-10">
            <label className="block text-slate-400 text-[11px] font-bold mb-2 uppercase tracking-widest">Senha / Master Key</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0E1117] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-all"
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
            />
          </div>
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-900/50 relative z-10">
            Acessar Painel
          </button>
        </form>
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
    { id: 'sessoes', label: 'Sessões', icon: 'supervised_user_circle' }
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
                <div key={p.slug} className="bg-[#161B22] border border-slate-800 rounded-xl p-4">
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
                    </div>
                    <div className="flex gap-1 shrink-0 flex-col items-end">
                      {/* Toggle de disponibilidade (mobile) */}
                      <button
                        onClick={() => handleToggleDisponivel(p.slug, (p as any).disponivel !== false)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                          (p as any).disponivel !== false ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                        title={(p as any).disponivel !== false ? 'Desativar' : 'Ativar'}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                          (p as any).disponivel !== false ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                      <span className={`text-[9px] font-bold ${
                        (p as any).disponivel !== false ? 'text-emerald-400' : 'text-rose-400'
                      }`}>{(p as any).disponivel !== false ? 'Disponível' : 'Inativo'}</span>
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
                      <tr className="hover:bg-slate-800/50 transition-colors">
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
                            {/* Toggle Disponibilidade */}
                            <button
                              onClick={() => handleToggleDisponivel(p.slug, (p as any).disponivel !== false)}
                              title={(p as any).disponivel !== false ? 'Clique para desativar' : 'Clique para ativar'}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                                (p as any).disponivel !== false ? 'bg-emerald-500' : 'bg-slate-600'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                  (p as any).disponivel !== false ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className={`text-[10px] font-bold ${
                              (p as any).disponivel !== false ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {(p as any).disponivel !== false ? 'Disponível' : 'Indisponível'}
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
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Marca *</label>
                    <input type="text" required value={editingProduct.marca}
                      onChange={e => setEditingProduct({ ...editingProduct, marca: e.target.value })}
                      className="w-full bg-[#0E1117] border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 transition-all outline-none"
                      placeholder="Ex: VEDACIT" />
                  </div>
                </div>

                {/* Categoria & Destaque */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Categoria *</label>
                    <select value={editingProduct.categoria}
                      onChange={e => setEditingProduct({ ...editingProduct, categoria: e.target.value as any })}
                      className="w-full bg-[#0E1117] border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 transition-all outline-none">
                      {Object.keys(CATEGORIAS).map(key => (
                        <option key={key} value={key}>{CATEGORIAS[key].nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center pt-6">
                    {(() => {
                      const isEditing = !!editingProduct.slug;
                      const isAlreadyDestaque = editingProduct.destaque;
                      const limitReached = destaqueAtual >= MAX_DESTAQUE && !isAlreadyDestaque;
                      return (
                        <div className="w-full">
                          <label className={`flex items-center gap-3 w-full ${limitReached ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                            <div className="relative shrink-0">
                              <input type="checkbox" checked={!!editingProduct.destaque}
                                disabled={limitReached}
                                onChange={e => {
                                  if (limitReached) return;
                                  setEditingProduct({ ...editingProduct, destaque: e.target.checked });
                                }}
                                className="sr-only" />
                              <div className={`block w-14 h-8 rounded-full transition-colors ${editingProduct.destaque ? 'bg-amber-500' : 'bg-slate-700'}`}></div>
                              <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${editingProduct.destaque ? 'translate-x-6' : ''}`}></div>
                            </div>
                            <div className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                              <div className="flex items-center gap-2">
                                Destacar na Home
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${limitReached ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400'}`}>
                                  {destaqueAtual}/{MAX_DESTAQUE}
                                </span>
                              </div>
                              <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                                {limitReached 
                                  ? 'Remova um destaque existente para selecionar este.'
                                  : 'Aparece na vitrine principal do site.'}
                              </span>
                            </div>
                          </label>
                          {limitReached && (
                            <div className="mt-2 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold px-3 py-1.5 rounded-lg">
                              <span className="material-symbols-outlined text-[14px]">warning</span>
                              Máximo de {MAX_DESTAQUE} produtos em destaque atingido
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

                {/* Para que serve */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Para que serve — Descrição Principal *</label>
                  <p className="text-[10px] text-slate-600 mb-2">Exibida em destaque na página, entre aspas.</p>
                  <textarea required value={editingProduct.resumo}
                    onChange={e => setEditingProduct({ ...editingProduct, resumo: e.target.value })}
                    className="w-full bg-[#0E1117] border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 transition-all outline-none h-24 resize-none"
                    placeholder="Manta asfáltica elastomérica para impermeabilização de lajes..." />
                </div>

                {/* Indicado Para */}
                <div className="border-t border-slate-800 pt-4">
                  <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">web</span>ConteÁºdo da Página
                  </p>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Indicado Para</label>
                  <p className="text-[10px] text-slate-600 mb-2">Aparece como chips na página do produto.</p>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {APLICACAO_OPTS.map(opt => {
                      const checked = aplicacaoInput.includes(opt);
                      return (
                        <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-bold transition-all ${checked ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>
                          <input type="checkbox" checked={checked} className="sr-only"
                            onChange={() => {
                              const next = checked ? aplicacaoInput.filter(x => x !== opt) : [...aplicacaoInput, opt];
                              setAplicacaoInput(next);
                              setEditingProduct({ ...editingProduct, aplicacao: next });
                            }} />
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'}`}>
                            {checked && <span className="material-symbols-outlined text-[10px] text-white">check</span>}
                          </span>
                          {opt}
                        </label>
                      );
                    })}
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
                  <p className="text-[10px] text-slate-600 mb-2">Chave â†’ Valor (ex: Espessura â†’ 3mm). Exibido como tabela.</p>
                  <div className="space-y-2">
                    {specsInput.map((spec, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="text" value={spec.key} placeholder="Chave"
                          onChange={e => { const n=[...specsInput]; n[i]={...n[i],key:e.target.value}; setSpecsInput(n); const o:Record<string,string>={}; n.filter(s=>s.key.trim()).forEach(s=>{o[s.key]=s.val;}); setEditingProduct({...editingProduct,especificacoes:o}); }}
                          className="flex-1 bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none" />
                        <span className="text-slate-600">â†’</span>
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
