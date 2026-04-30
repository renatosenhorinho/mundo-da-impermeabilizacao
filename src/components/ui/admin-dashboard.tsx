import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  getAnalyticsEvents, AnalyticsEvent, getLocalLeads, Lead,
  BehavioralMetrics, onHotLead, markLeadConverted, LeadScoreBreakdown
} from '@/lib/analytics';
import { products, Product, saveCustomProducts, CATEGORIAS, generateSlug } from '@/data/products';
import { supabase } from '@/lib/supabase';
import { MAX_DESTAQUE } from '@/config/constants';

type Tab = 'dashboard' | 'cro' | 'catalogo' | 'leads' | 'heatmap' | 'produtos' | 'paginas' | 'conversao' | 'sessoes' | 'crm_intel';

interface Insight {
  id: string;
  type: 'danger' | 'warning' | 'success' | 'info';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  action: string;
}

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
          if (import.meta.env.DEV) {
            // SAFE DEV MODE ONLY
            console.warn('DEV MODE: Supabase not configured. Using local fallback.');
            const localSession = localStorage.getItem('mdi_admin_session');
            if (localSession) setIsAuthenticated(true);
            setIsLoadingAuth(false);
            return;
          }
          // PRODUCTION BLOCK
          setSystemError('Painel temporariamente indisponível. Tente novamente mais tarde.');
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
      // Local fallback ONLY IN DEV
      if (import.meta.env.DEV) {
        if (password === 'admin123') {
          localStorage.setItem('mdi_admin_session', JSON.stringify({ timestamp: Date.now() }));
          setIsAuthenticated(true);
        } else {
          setLoginError('Senha local incorreta.');
        }
      } else {
        setSystemError('Painel temporariamente indisponível. Tente novamente mais tarde.');
      }
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('mdi_admin_session');
    }
    setIsAuthenticated(false);
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
  const metrics = useMemo(() => {
    const pageviews = events.filter(e => e.type === 'pageview');
    const clicks = events.filter(e => e.type === 'click');
    const productClicks = events.filter(e => e.type === 'product_click');
    const whatsappClicks = events.filter(e => e.type === 'whatsapp_click');
    const timeEvents = events.filter(e => e.type === 'time_on_page');

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
  }, [events]);

  const clearData = () => {
    if (confirm('Tem certeza que deseja apagar todos os dados de Analytics?')) {
      localStorage.removeItem('mdi_analytics_events');
      setEvents([]);
    }
  };

  // ----------------------------------------------------
  // CMS ACTIONS
  // ----------------------------------------------------
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
        isCustom: true
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
    const updatedCatalog = catalogItems.map(p => p.slug === slug ? { ...p, ativo: false, isCustom: true } : p);
    setCatalogItems(updatedCatalog);

    const dynamicOnly = updatedCatalog.filter(p => (p as any).isCustom);
    await saveCustomProducts(dynamicOnly);
    setDeleteConfirmSlug(null);
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
            <h1 className="text-2xl font-black text-white tracking-wider">Workspace</h1>
            <p className="text-slate-400 text-sm mt-2">Gestão e Analytics Seguros</p>
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
              placeholder="••••••••"
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
    { id: 'crm_intel', label: 'CRM Inteligência', icon: 'psychology' },
    { id: 'catalogo', label: 'Gerenciar Produtos', icon: 'app_registration' },
    { id: 'leads', label: 'Leads (Comercial)', icon: 'local_mall' },
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

        {/* 🔥 Hot Lead Alert Banner */}
        {hotLeadAlert && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300 max-w-sm w-full">
            <div className="bg-rose-950 border border-rose-500 rounded-xl p-4 shadow-2xl shadow-rose-900/50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
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
                onClick={() => { setActiveTab('crm_intel'); setHotLeadAlert(null); }}
                className="mt-3 w-full text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white py-2 rounded-lg transition-colors"
              >
                Ver no CRM →
              </button>
            </div>
          </div>
        )}

        {/* 💰 Conversion Modal */}
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
                  ✓ Confirmar
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
            <header className="flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold text-white">Overview</h1>
                <p className="text-sm text-slate-400 mt-1">Métricas globais de performance.</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-emerald-500 font-medium tracking-widest uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Tracking
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
                    ⭐ {destaqueAtual}/{MAX_DESTAQUE} em destaque
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
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditProductModal(p)} className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button onClick={() => setDeleteConfirmSlug(deleteConfirmSlug === p.slug ? null : p.slug)}
                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
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
                          {p.destaque ? (
                            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-amber-500/20">
                              <span className="material-symbols-outlined text-[12px]">star</span> Em destaque
                            </span>
                          ) : (
                            <span className="inline-block bg-slate-800 text-slate-500 px-2.5 py-1 rounded-full text-[10px] font-bold border border-slate-700">Normal</span>
                          )}
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

        {/* TAB: LEADS (COMERCIAL / CRM) */}
        {activeTab === 'leads' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <header className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  <span className="material-symbols-outlined text-emerald-400 text-3xl">real_estate_agent</span>
                  CRM & Vendas
                </h1>
                <p className="text-sm text-slate-400 mt-1">Gerencie seu funil de vendas, atenda leads e feche negócios.</p>
              </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-[#161B22] p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="material-symbols-outlined text-6xl text-white">group</span>
                </div>
                <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">Total de Leads</h3>
                <p className="text-4xl font-black text-white">{leads.length}</p>
              </div>

              <div className="bg-[#161B22] p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group border-b-4 border-b-sky-500">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="material-symbols-outlined text-6xl text-sky-500">fiber_new</span>
                </div>
                <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">Novos</h3>
                <p className="text-4xl font-black text-sky-400">{metricsCRM.novos}</p>
              </div>

              <div className="bg-[#161B22] p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group border-b-4 border-b-amber-500">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="material-symbols-outlined text-6xl text-amber-500">support_agent</span>
                </div>
                <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">Em Atendimento</h3>
                <p className="text-4xl font-black text-amber-400">{metricsCRM.emAtendimento}</p>
              </div>

              <div className="bg-[#161B22] p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group border-b-4 border-b-emerald-500">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="material-symbols-outlined text-6xl text-emerald-500">monetization_on</span>
                </div>
                <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">Convertidos</h3>
                <p className="text-4xl font-black text-emerald-400">{metricsCRM.convertidos}</p>
                <div className="mt-2 text-emerald-500 text-xs font-bold">Taxa: {metricsCRM.taxaConversao}%</div>
              </div>
            </div>

            {/* Funil Visual */}
            <div className="bg-[#161B22] p-6 rounded-xl border border-slate-800 shadow-xl">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Funil Comercial</h3>
              <div className="flex gap-2 w-full h-12 rounded-full overflow-hidden font-bold text-xs">
                {metricsCRM.novos > 0 && <div style={{ width: `${(metricsCRM.novos / leads.length) * 100}%` }} className="bg-sky-500 flex items-center justify-center text-sky-950 transition-all">Novos ({metricsCRM.novos})</div>}
                {metricsCRM.emAtendimento > 0 && <div style={{ width: `${(metricsCRM.emAtendimento / leads.length) * 100}%` }} className="bg-amber-500 flex items-center justify-center text-amber-950 transition-all">Em Atendimento ({metricsCRM.emAtendimento})</div>}
                {metricsCRM.convertidos > 0 && <div style={{ width: `${(metricsCRM.convertidos / leads.length) * 100}%` }} className="bg-emerald-500 flex items-center justify-center text-emerald-950 transition-all">Vendas ({metricsCRM.convertidos})</div>}
              </div>
            </div>

            {/* Filtros e Busca */}
            <div className="bg-[#161B22] p-4 rounded-xl border border-slate-800 shadow-xl flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span>
                <input
                  type="text"
                  placeholder="Buscar por nome do produto..."
                  value={leadSearchQuery}
                  onChange={(e) => setLeadSearchQuery(e.target.value)}
                  className="w-full bg-[#0E1117] border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
                />
              </div>
              <div className="flex gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <select
                  value={leadStatusFilter}
                  onChange={(e) => setLeadStatusFilter(e.target.value as any)}
                  className="bg-[#0E1117] border border-slate-700 rounded-lg px-4 py-2 text-slate-300 outline-none focus:border-emerald-500 cursor-pointer text-sm font-bold"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="novo">Novos</option>
                  <option value="em_atendimento">Em Atendimento</option>
                  <option value="convertido">Convertidos</option>
                  <option value="perdido">Perdidos</option>
                </select>
                <select
                  value={leadStageFilter}
                  onChange={(e) => setLeadStageFilter(e.target.value as any)}
                  className="bg-[#0E1117] border border-slate-700 rounded-lg px-4 py-2 text-slate-300 outline-none focus:border-emerald-500 cursor-pointer text-sm font-bold"
                >
                  <option value="todos">🌡️ Todos Estágios</option>
                  <option value="quente">🔥 Quente</option>
                  <option value="morno">⚡ Morno</option>
                  <option value="frio">❄️ Frio</option>
                </select>
                <select
                  value={leadSortOrder}
                  onChange={(e) => setLeadSortOrder(e.target.value as any)}
                  className="bg-[#0E1117] border border-slate-700 rounded-lg px-4 py-2 text-slate-300 outline-none focus:border-emerald-500 cursor-pointer text-sm font-bold"
                >
                  <option value="recentes">Mais Recentes</option>
                  <option value="antigos">Mais Antigos</option>
                  <option value="score">Maior Score</option>
                </select>
              </div>
            </div>

            {/* Mobile Cards — Leads */}
            <div className="md:hidden space-y-3">
              {filteredLeads.length === 0 ? (
                <div className="bg-[#161B22] border border-slate-800 rounded-xl p-8 text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-600 block mb-2">search_off</span>
                  <p className="text-slate-500 font-bold text-sm">Nenhum lead encontrado.</p>
                </div>
              ) : filteredLeads.map((lead, idx) => {
                const id = lead.id || `temp-${idx}`;
                const status = lead.status || 'novo';
                return (
                  <div key={id} className="bg-[#161B22] border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm truncate">{lead.product_name}</p>
                        <p className="text-[11px] text-slate-500 truncate">Origem: {lead.page}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5 font-mono">{new Date(lead.created_at || Date.now()).toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusColors[status]}`}>
                          {statusLabels[status]}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          lead.lead_stage === 'quente' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          lead.lead_stage === 'morno' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        }`}>
                          {lead.lead_stage === 'quente' ? '🔥' : lead.lead_stage === 'morno' ? '⚡' : '❄️'}
                          {lead.lead_score ?? 0}pts
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {status !== 'em_atendimento' && (
                        <button onClick={() => handleUpdateLeadStatus(id, 'em_atendimento')}
                          className="flex-1 min-h-[44px] flex items-center justify-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-bold hover:bg-amber-500 hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[16px]">support_agent</span> Atender
                        </button>
                      )}
                      {status !== 'convertido' && (
                        <button onClick={() => handleUpdateLeadStatus(id, 'convertido')}
                          className="flex-1 min-h-[44px] flex items-center justify-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold hover:bg-emerald-500 hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[16px]">monetization_on</span> Venda
                        </button>
                      )}
                      {status !== 'perdido' && (
                        <button onClick={() => handleUpdateLeadStatus(id, 'perdido')}
                          className="flex-1 min-h-[44px] flex items-center justify-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold hover:bg-rose-500 hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[16px]">thumb_down</span> Perdido
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table — Leads */}
            <div className="hidden md:block bg-[#161B22] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 bg-[#0E1117] flex justify-between items-center">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pipeline de Leads ({filteredLeads.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-[#0E1117] text-slate-400 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold w-48">Data</th>
                      <th className="px-6 py-4 font-semibold">Produto de Interesse</th>
                      <th className="px-6 py-4 font-semibold">Score / Estágio</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Anotações</th>
                      <th className="px-6 py-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredLeads.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-bold flex flex-col items-center gap-2"><span className="material-symbols-outlined text-4xl">search_off</span>Nenhum lead encontrado com estes filtros.</td></tr>
                    ) : filteredLeads.map((lead, idx) => {
                      const id = lead.id || `temp-${idx}`;
                      const status = lead.status || 'novo';
                      const isEditingNotes = editingLeadId === id;

                      return (
                        <tr key={id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                            {new Date(lead.created_at || Date.now()).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-white block truncate max-w-[250px]">{lead.product_name}</span>
                            <span className="text-[10px] text-slate-500 block truncate max-w-[250px]">Origem: {lead.page}</span>
                            <div className="flex items-center gap-2 mt-1">
                              {lead.purchase_intent && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  lead.purchase_intent === 'purchase' ? 'bg-rose-500/10 text-rose-400' :
                                  lead.purchase_intent === 'comparison' ? 'bg-amber-500/10 text-amber-400' :
                                  'bg-sky-500/10 text-sky-400'
                                }`}>
                                  {lead.purchase_intent === 'purchase' ? '🛒 Intenção Compra' :
                                   lead.purchase_intent === 'comparison' ? '⚖️ Comparação' : '🔍 Exploração'}
                                </span>
                              )}
                              {(lead.behavioral_metrics as any)?.utm_data && Object.keys((lead.behavioral_metrics as any).utm_data).length > 0 && (
                                <span className="text-[9px] text-purple-400 font-bold">⚡ UTM: {(lead.behavioral_metrics as any).utm_data.utm_source}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {/* Score / Stage */}
                            <div className="flex flex-col gap-1 items-start">
                              <div className="flex flex-wrap items-center gap-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  lead.lead_stage === 'quente' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                  lead.lead_stage === 'morno'  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                }`}>
                                  {lead.lead_stage === 'quente' ? '🔥' : lead.lead_stage === 'morno' ? '⚡' : '❄️'}
                                  {lead.lead_stage ? lead.lead_stage.charAt(0).toUpperCase() + lead.lead_stage.slice(1) : 'Frio'}
                                  <span className="opacity-50 ml-1">({lead.lead_score ?? 0}pts)</span>
                                </span>
                                {lead.recommended_action && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                                    lead.recommended_action === 'chamar_agora' ? 'bg-rose-600/20 text-rose-500 border-rose-600/30 animate-pulse' :
                                    lead.recommended_action === 'prioridade_alta' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                    lead.recommended_action === 'nutrir_lead' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                    'bg-slate-500/20 text-slate-400 border-slate-500/30'
                                  }`}>
                                    {lead.recommended_action === 'chamar_agora' ? '🚨 Chamar Agora' :
                                     lead.recommended_action === 'prioridade_alta' ? '⚡ Prioridade' :
                                     lead.recommended_action === 'nutrir_lead' ? '🧠 Nutrir' : '⏳ Aguardar'}
                                  </span>
                                )}
                              </div>
                              {lead.lead_confidence !== undefined && (
                                <div className="flex items-center gap-1 w-full max-w-[80px]" title="Confiança do Score (0-100)">
                                  <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full ${
                                      lead.lead_confidence > 70 ? 'bg-emerald-500' :
                                      lead.lead_confidence > 40 ? 'bg-amber-500' : 'bg-rose-500'
                                    }`} style={{ width: `${lead.lead_confidence}%` }} />
                                  </div>
                                  <span className="text-[8px] text-slate-500 font-mono">{lead.lead_confidence}%</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold border ${statusColors[status]}`}>
                              {statusLabels[status]}
                            </span>
                          </td>
                          <td className="px-6 py-4 w-64">
                            {isEditingNotes ? (
                              <div className="flex items-center gap-2">
                                <input
                                  autoFocus
                                  type="text"
                                  value={leadNoteDraft}
                                  onChange={e => setLeadNoteDraft(e.target.value)}
                                  className="w-full bg-[#0E1117] border border-slate-700 rounded px-2 py-1 text-white text-xs"
                                  placeholder="Nome, zap, orçamento..."
                                  onKeyDown={e => e.key === 'Enter' && handleSaveLeadNote(id)}
                                />
                                <button onClick={() => handleSaveLeadNote(id)} className="text-emerald-400 hover:text-emerald-300"><span className="material-symbols-outlined text-[16px]">save</span></button>
                                <button onClick={() => setEditingLeadId(null)} className="text-slate-400 hover:text-white"><span className="material-symbols-outlined text-[16px]">close</span></button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {lead.human_summary && (
                                  <div className="bg-sky-500/10 border border-sky-500/20 p-2 rounded-lg">
                                    <p className="text-[10px] text-sky-300 whitespace-normal leading-relaxed">{lead.human_summary}</p>
                                  </div>
                                )}
                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => { setEditingLeadId(id); setLeadNoteDraft(lead.notes || ''); }}>
                                  <span className={`text-xs truncate max-w-[200px] ${lead.notes ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                                    {lead.notes || 'Adicionar nota...'}
                                  </span>
                                  <span className="material-symbols-outlined text-[14px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                            <a href={`https://wa.me/?text=Olá! Vi o produto ${lead.product_name} no site.`} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Simular Atendimento">
                              <span className="material-symbols-outlined text-[18px]">chat</span>
                            </a>

                            {/* Actions Dropdown Alternative (Buttons for Speed) */}
                            {status !== 'em_atendimento' && (
                              <button onClick={() => handleUpdateLeadStatus(id, 'em_atendimento')} className="p-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded hover:bg-amber-500 hover:text-white transition-colors" title="Marcar Em Atendimento">
                                <span className="material-symbols-outlined text-[16px]">support_agent</span>
                              </button>
                            )}
                            {status !== 'convertido' && (
                              <button onClick={() => handleUpdateLeadStatus(id, 'convertido')} className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500 hover:text-white transition-colors" title="Marcar Venda">
                                <span className="material-symbols-outlined text-[16px]">monetization_on</span>
                              </button>
                            )}
                            {status !== 'perdido' && (
                              <button onClick={() => handleUpdateLeadStatus(id, 'perdido')} className="p-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded hover:bg-rose-500 hover:text-white transition-colors" title="Marcar Perdido">
                                <span className="material-symbols-outlined text-[16px]">thumb_down</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}



        {/* TAB: CRM INTELIGÊNCIA */}
        {activeTab === 'crm_intel' && (() => {
          const hotLeads    = leads.filter(l => l.lead_stage === 'quente').sort((a,b) => (b.lead_score||0)-(a.lead_score||0));
          const mornoLeads  = leads.filter(l => l.lead_stage === 'morno');
          const frioLeads   = leads.filter(l => l.lead_stage === 'frio');
          const converted   = leads.filter(l => l.converted);
          const totalRev    = converted.reduce((s,l) => s + (l.conversion_value || 0), 0);
          const convRate    = leads.length > 0 ? ((converted.length / leads.length) * 100).toFixed(1) : '0.0';

          // Top pages by WA click
          const pageMap: Record<string,number> = {};
          leads.forEach(l => { pageMap[l.page] = (pageMap[l.page]||0)+1; });
          const topPages = Object.entries(pageMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

          // UTM sources
          const utmMap: Record<string,number> = {};
          leads.forEach(l => {
            const utm = (l.behavioral_metrics as any)?.utm_data?.utm_source;
            if (utm) utmMap[utm] = (utmMap[utm]||0)+1;
          });
          const topUTMs = Object.entries(utmMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

          // Avg time to WA click
          const timeSamples = leads.map(l => (l.behavioral_metrics as any)?.time_on_page || 0).filter(t=>t>0);
          const avgTime = timeSamples.length > 0 ? Math.round(timeSamples.reduce((a,b)=>a+b,0)/timeSamples.length) : 0;

          return (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400">psychology</span>
                  CRM Inteligência de Vendas
                </h1>
                <p className="text-sm text-slate-400 mt-1">Painel de decisão comercial em tempo real.</p>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Leads Quentes 🔥', value: hotLeads.length, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
                  { label: 'Taxa Conversão', value: convRate + '%', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                  { label: 'Receita Gerada', value: `R$ ${totalRev.toFixed(2)}`, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                  { label: 'Tempo Médio/Clique', value: avgTime + 's', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
                ].map(k => (
                  <div key={k.label} className={`${k.bg} border rounded-xl p-4`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{k.label}</p>
                    <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Stage Distribution */}
              <div className="bg-[#161B22] border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Distribuição de Estágios</h3>
                <div className="flex gap-2 h-8 w-full rounded-full overflow-hidden">
                  {hotLeads.length > 0 && <div style={{ width: `${(hotLeads.length/Math.max(leads.length,1))*100}%` }} className="bg-rose-500 flex items-center justify-center text-[10px] font-black text-white">🔥{hotLeads.length}</div>}
                  {mornoLeads.length > 0 && <div style={{ width: `${(mornoLeads.length/Math.max(leads.length,1))*100}%` }} className="bg-amber-500 flex items-center justify-center text-[10px] font-black text-white">⚡{mornoLeads.length}</div>}
                  {frioLeads.length > 0 && <div style={{ width: `${(frioLeads.length/Math.max(leads.length,1))*100}%` }} className="bg-sky-600 flex items-center justify-center text-[10px] font-black text-white">❄️{frioLeads.length}</div>}
                  {leads.length === 0 && <div className="w-full bg-slate-800 flex items-center justify-center text-slate-500 text-xs">Sem leads ainda</div>}
                </div>
                <div className="flex gap-4 mt-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>Quente ({hotLeads.length})</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>Morno ({mornoLeads.length})</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-600 inline-block"></span>Frio ({frioLeads.length})</span>
                </div>
              </div>

              {/* Top 10 Hot Leads */}
              <div className="bg-[#161B22] border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800 bg-[#0E1117] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">🔥 Top Leads Mais Quentes</h3>
                  <span className="text-[10px] text-slate-500 font-mono">ordenado por score desc</span>
                </div>
                {hotLeads.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">Nenhum lead quente ainda. Continue capturando tráfego!</div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {hotLeads.slice(0,10).map((lead, i) => {
                      const bm = lead.behavioral_metrics as any;
                      return (
                        <div key={lead.id||i} className={`p-4 flex items-center gap-4 hover:bg-slate-800/40 transition-colors ${i === 0 ? 'bg-rose-500/5' : ''}`}>
                          <span className="text-2xl font-black text-slate-600 w-6 shrink-0 text-center">
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white text-sm truncate">{lead.product_name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{lead.page}</p>
                            <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
                              {bm?.time_on_page > 0 && <span>⏱ {bm.time_on_page}s na página</span>}
                              {bm?.scroll_depth > 0 && <span>📜 {bm.scroll_depth}% scroll</span>}
                              {bm?.pages_visited > 1 && <span>📄 {bm.pages_visited} páginas</span>}
                              {Object.keys(bm?.utm_data || {}).length > 0 && <span className="text-purple-400">⚡ UTM</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-rose-400 font-black text-lg">{lead.lead_score}</div>
                            <div className="text-[9px] text-slate-500 font-mono">pts</div>
                          </div>
                          {!lead.converted && (
                            <button
                              onClick={() => setConversionModalId(lead.id!)}
                              className="shrink-0 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg hover:bg-emerald-500 hover:text-white transition-colors"
                            >
                              Converteu!
                            </button>
                          )}
                          {lead.converted && (
                            <span className="shrink-0 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                              ✓ {lead.conversion_value ? `R$${lead.conversion_value}` : 'Venda'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Grid: Top Pages + UTM Sources */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Top Pages by Conversion */}
                <div className="bg-[#161B22] border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-800 bg-[#0E1117]">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">📊 Páginas com Mais Conversões</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {topPages.length === 0 ? <p className="text-slate-500 text-xs text-center py-4">Sem dados ainda</p> : topPages.map(([page, count]) => (
                      <div key={page}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-300 truncate max-w-[70%]">{page}</span>
                          <span className="text-emerald-400 font-bold">{count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(count/topPages[0][1])*100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* UTM Sources */}
                <div className="bg-[#161B22] border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-800 bg-[#0E1117]">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">📈 Origens UTM (ROI de Tráfego)</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {topUTMs.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-4">Sem UTMs capturadas. Use links com utm_source=google etc.</p>
                    ) : topUTMs.map(([source, count]) => (
                      <div key={source}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-purple-300 truncate max-w-[70%]">⚡ {source}</span>
                          <span className="text-purple-400 font-bold">{count} leads</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(count/topUTMs[0][1])*100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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
            <div>
              <h1 className="text-2xl font-bold text-white">Inteligência de Produtos</h1>
              <p className="text-sm text-slate-400 mt-1">Ranking de interesse vs intenção de compra.</p>
            </div>

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

        {/* TAB: PÁGINAS */}
        {activeTab === 'paginas' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h1 className="text-2xl font-bold text-white">Performance de Páginas</h1>
              <p className="text-sm text-slate-400 mt-1">Tráfego e retenção por rota.</p>
            </div>
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

        {/* TAB: CONVERSÃO */}
        {activeTab === 'conversao' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h1 className="text-2xl font-bold text-white">Funil de Vendas</h1>
              <p className="text-sm text-slate-400 mt-1">Jornada macro do usuário único.</p>
            </div>
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

        {/* TAB: SESSÕES */}
        {activeTab === 'sessoes' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h1 className="text-2xl font-bold text-white">Sessões Recentes</h1>
              <p className="text-sm text-slate-400 mt-1">Análise de visitantes individuais (anonimizados).</p>
            </div>
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
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">URL da Imagem</label>
                  <div className="flex gap-3 items-start">
                    <input type="text" value={editingProduct.imagem}
                      onChange={e => setEditingProduct({ ...editingProduct, imagem: e.target.value })}
                      className="flex-1 bg-[#0E1117] border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 transition-all outline-none"
                      placeholder="/images/products/... ou http://..." />
                    <div className="w-14 h-14 bg-white rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center p-1 shrink-0">
                      {editingProduct.imagem ? (
                        <img src={editingProduct.imagem} alt="Preview" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <span className="material-symbols-outlined text-slate-400">image</span>
                      )}
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
                    <span className="material-symbols-outlined text-sm">web</span>Conteúdo da Página
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
