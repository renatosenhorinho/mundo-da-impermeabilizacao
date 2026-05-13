/**
 * src/lib/ai-generator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gerador de texto automático para produtos — arquitetura desacoplada.
 * Provider priority: VITE_AI_PROVIDER env → local template fallback (default)
 *
 * Para ativar IA real: defina no .env:
 *   VITE_AI_PROVIDER=openai   + VITE_OPENAI_API_KEY=sk-...
 *   VITE_AI_PROVIDER=gemini   + VITE_GEMINI_API_KEY=...
 *   VITE_AI_PROVIDER=claude   + VITE_CLAUDE_API_KEY=...
 *
 * Sem chave configurada, usa o gerador local inteligente (sempre funciona).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ProductSummaryInput {
  nome: string;
  marca: string;
  categoria: string;
  subcategoria?: string;
}

export interface GeneratorResult {
  text: string;
  source: 'openai' | 'gemini' | 'claude' | 'local';
}

// ── Constante de limite ────────────────────────────────────────────────────────
const MAX_CHARS = 300;

// ── Templates locais por categoria ───────────────────────────────────────────
const CATEGORY_TEMPLATES: Record<string, (input: ProductSummaryInput) => string> = {
  'impermeabilizantes-cimenticios': ({ nome, marca }) =>
    `${nome} ${marca} é um impermeabilizante cimentício indicado para superfícies em contato com água sob pressão positiva ou negativa, como caixas d'água, reservatórios e piscinas. Excelente aderência ao concreto e alvenaria.`,

  'manta-liquida': ({ nome, marca }) =>
    `${nome} ${marca} é um impermeabilizante elastomérico de aplicação a frio, que forma membrana contínua e sem emendas. Indicado para lajes, varandas e terraços com exposição à umidade e variação térmica.`,

  'manta-asfaltica': ({ nome, marca }) =>
    `${nome} ${marca} é uma manta asfáltica elastomérica de alta resistência mecânica. Aplicada a quente, oferece proteção duradoura contra infiltrações em lajes de cobertura, terraços e estruturas de grande porte.`,

  'primer': ({ nome, marca }) =>
    `${nome} ${marca} é um primer asfáltico utilizado para imprimação e preparo de superfícies, garantindo a aderência de mantas e membranas. Compatível com concreto, argamassa e outros substratos porosos.`,

  'fitas-aluminizadas': ({ nome, marca }) =>
    `${nome} ${marca} é uma fita asfáltica autoadesiva com face aluminizada, utilizada para reparos rápidos em telhados, calhas, rufos e dutos. Resistente a intempéries e de fácil aplicação a frio.`,

  'selantes': ({ nome, marca }) =>
    `${nome} ${marca} é um selante elastomérico de alto desempenho para vedação de juntas de dilatação, trincas e encontros de materiais distintos. Mantém elasticidade permanente mesmo sob movimentação estrutural.`,

  'aditivos': ({ nome, marca }) =>
    `${nome} ${marca} é um aditivo impermeabilizante incorporado diretamente ao concreto ou argamassa. Reduz a permeabilidade da massa, prevenindo a ascensão de umidade em alvenarias, baldrames e fundações.`,

  'adesivos-e-epoxi': ({ nome, marca }) =>
    `${nome} ${marca} é uma resina epóxi bicomponente de alta resistência para colagem estrutural, reforço de concreto e chumbamento de ferragens. Indicado para reparos que exigem ancoragem de máxima performance.`,

  'graute-e-reparacao-estrutural': ({ nome, marca }) =>
    `${nome} ${marca} é um graute fluido sem retração, utilizado para o preenchimento de espaços e o nivelamento de bases em estruturas de concreto. Garante transferência uniforme de carga em pilares e equipamentos.`,

  'desmoldantes-e-cura': ({ nome, marca }) =>
    `${nome} ${marca} é um agente de cura que protege o concreto recém-lançado contra a perda prematura de água por evaporação, assegurando a hidratação completa do cimento e a resistência especificada do elemento estrutural.`,

  'drenagem-e-geotexteis': ({ nome, marca }) =>
    `${nome} ${marca} é um produto de drenagem e filtração geotêxtil utilizado em sistemas de impermeabilização enterrada. Protege as membranas contra cargas mecânicas e facilita o escoamento da água em jardins e subsolos.`,

  'ferramentas-e-acessorios': ({ nome, marca }) =>
    `${nome} ${marca} é um acessório de apoio para a execução e acabamento de sistemas de impermeabilização. Utilizado por aplicadores profissionais para garantir uniformidade e qualidade na aplicação de membranas e mantas.`,
};

// Fallback genérico para categorias não mapeadas
const GENERIC_TEMPLATE = ({ nome, marca, categoria }: ProductSummaryInput): string =>
  `${nome} ${marca} é um produto para impermeabilização na linha ${categoria.replace(/-/g, ' ')}, indicado para uso profissional em obras residenciais e comerciais. Consulte a ficha técnica para informações de aplicação e rendimento.`;

// ── Truncar sem cortar palavras ───────────────────────────────────────────────
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.substring(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.substring(0, lastSpace) : cut).replace(/[,.]?$/, '') + '.';
}

// ── Gerador local (always-available) ─────────────────────────────────────────
function generateLocal(input: ProductSummaryInput): GeneratorResult {
  const template = CATEGORY_TEMPLATES[input.categoria] || GENERIC_TEMPLATE;
  const raw = template(input).trim();
  return { text: truncate(raw, MAX_CHARS), source: 'local' };
}

// ── OpenAI provider ───────────────────────────────────────────────────────────
async function generateOpenAI(input: ProductSummaryInput, apiKey: string): Promise<GeneratorResult> {
  const prompt = buildPrompt(input);
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const text = truncate(data.choices?.[0]?.message?.content?.trim() || '', MAX_CHARS);
  return { text, source: 'openai' };
}

// ── Gemini provider ───────────────────────────────────────────────────────────
async function generateGemini(input: ProductSummaryInput, apiKey: string): Promise<GeneratorResult> {
  const prompt = buildPrompt(input);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = truncate(data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '', MAX_CHARS);
  return { text, source: 'gemini' };
}

// ── Prompt compartilhado ──────────────────────────────────────────────────────
function buildPrompt({ nome, marca, categoria }: ProductSummaryInput): string {
  return [
    `Gere uma descrição técnica profissional para o produto de impermeabilização abaixo.`,
    `Regras: máximo 280 caracteres, português brasileiro, tom técnico, sem emojis, sem marketing exagerado, sem texto genérico. Retorne APENAS o texto, sem aspas.`,
    `Produto: ${nome}`,
    `Marca: ${marca}`,
    `Categoria: ${categoria}`,
  ].join('\n');
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * generateProductSummary — ponto de entrada único.
 * Tenta o provider configurado, cai para local em qualquer falha.
 */
export async function generateProductSummary(
  input: ProductSummaryInput,
  options: { retries?: number } = {}
): Promise<GeneratorResult> {
  const { retries = 1 } = options;

  if (!input.nome?.trim() || !input.marca?.trim()) {
    throw new Error('Nome e marca são obrigatórios para gerar a descrição.');
  }

  const provider = import.meta.env.VITE_AI_PROVIDER as string | undefined;
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  // Sem provider configurado → local imediato
  if (!provider || provider === 'local') {
    return generateLocal(input);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (provider === 'openai' && openaiKey) return await generateOpenAI(input, openaiKey);
      if (provider === 'gemini' && geminiKey) return await generateGemini(input, geminiKey);
      // Provider configurado mas sem chave válida → cai pro local
      return generateLocal(input);
    } catch (e: any) {
      lastError = e;
      if (attempt < retries) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }

  console.warn('[ai-generator] Provider falhou, usando fallback local:', lastError?.message);
  return generateLocal(input);
}
