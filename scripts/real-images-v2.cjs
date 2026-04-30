const fs = require('fs'), path = require('path');

// MLB = Mercado Livre CDN (stable). MFR = manufacturer CDN.
const MANTA_VEDACIT = 'https://http2.mlstatic.com/D_NQ_NP_712085-MLA93766628927_092025-O.webp';
const MANTA_VIAPOL  = 'https://http2.mlstatic.com/D_NQ_NP_906325-MLB47668600813_092021-O.webp';
const MANTA_DRYKO   = 'https://dryko.com.br/wp-content/uploads/2021/04/VEDATUDO_500g_INCOLOR.jpg';
const FITA_DRYKO    = 'https://dryko.com.br/wp-content/uploads/2020/01/VEDATUDO-30CM.jpg';
const FITA_VIAPOL   = 'https://http2.mlstatic.com/D_NQ_NP_994966-MLB51275468160_082022-O.webp';
const PRIMER_MLB    = 'https://http2.mlstatic.com/D_NQ_NP_833866-MLB70494128062_072023-O.webp';
const SELANTE_MLB   = 'https://http2.mlstatic.com/D_NQ_NP_908868-MLB80582294157_112024-O.webp';
const EPOXI_QTZ     = 'https://http2.mlstatic.com/D_Q_NP_2X_763541-MLB46583717784_072021-R.webp';
const EPOXI_VDC     = 'https://http2.mlstatic.com/D_NQ_NP_944365-MLU73099955431_112023-O.webp';
const GRAUTE_QTZ    = 'https://http2.mlstatic.com/D_NQ_NP_668742-MLB81216503883_122024-O.webp';
const ESPUMA_PU     = 'https://http2.mlstatic.com/D_NQ_NP_963157-MLB71004128062_082023-O.webp';
const GEOTEXTIL     = 'https://http2.mlstatic.com/D_NQ_NP_753235-MLB47668600813_092021-O.webp';
const TUBO_DREN     = 'https://http2.mlstatic.com/D_NQ_NP_699566-MLB74735516084_022024-O.webp';
const BACKER_ROD    = 'https://http2.mlstatic.com/D_NQ_NP_723376-MLB70494128064_072023-O.webp';
const XPS_PLACA     = 'https://http2.mlstatic.com/D_NQ_NP_668742-MLB81216503883_122024-O.webp';
const SILICONE_MLB  = 'https://http2.mlstatic.com/D_NQ_NP_602161-MLB75836814324_042024-O.webp';
const ADITIVO_VDC   = 'https://http2.mlstatic.com/D_NQ_NP_833866-MLB70494128062_072023-O.webp';
const VIAPLUS1000   = 'https://http2.mlstatic.com/D_NQ_NP_906325-MLB47668600813_092021-O.webp';
const VIAPLUS2000   = 'https://http2.mlstatic.com/D_NQ_NP_994966-MLB51275468160_082022-O.webp';
const FITA_PLASTIBAND = 'https://http2.mlstatic.com/D_NQ_NP_833866-MLB70494128062_072023-O.webp';

const MAP = {
  // ── MANTAS ASFÁLTICAS ─────────────────────────────────────────────────────
  'manta-asfaltica-vedacit-3mm': MANTA_VEDACIT,
  'manta-asfaltica-vedacit-4mm': MANTA_VEDACIT,
  'manta-asfaltica-viapol-4mm': MANTA_VIAPOL,
  'viapol-betumanta-3-pp-manta-asfaltica': MANTA_VIAPOL,
  'viapol-betumanta-2-e-manta-asfaltica': MANTA_VIAPOL,
  'viapol-torodin-3500-3-pp-manta-asfaltica': MANTA_VIAPOL,
  'viapol-manta-premium-ardosia-cinza-3mm': MANTA_VIAPOL,
  'viapol-manta-premium-ardosia-verde-3mm': MANTA_VIAPOL,
  'viapol-manta-premium-ardosia-vermelho-3mm': MANTA_VIAPOL,
  'viapol-manta-premium-ardosia-verde-4mm': MANTA_VIAPOL,
  'vedacit-pro-ii-b-poliester-3mm': MANTA_VEDACIT,
  'vedacit-pro-ii-b-poliester-4mm': MANTA_VEDACIT,
  'vedacit-pro-ii-b-aluminio-poliester-3mm': MANTA_VEDACIT,
  'vedacit-pro-ii-b-aluminio-glass-3mm': MANTA_VEDACIT,
  'vedacit-pro-iii-b-poliester-3mm': MANTA_VEDACIT,
  'vedacit-pro-iii-b-poliester-4mm': MANTA_VEDACIT,
  'vedacit-pro-iii-b-aluminio-3mm': MANTA_VEDACIT,
  'vedacit-pro-iii-b-aluminio-4mm-manta-asfaltica': MANTA_VEDACIT,
  'dryko-drykomanta-flex-tipo-ii-pp-3mm': MANTA_DRYKO,
  'dryko-drykomanta-tipo-iii-pp-3mm': MANTA_DRYKO,
  'dryko-drykomanta-tipo-iii-pp-4mm': MANTA_DRYKO,
  'dryko-drykomanta-top-tipo-iv-pp-4mm': MANTA_DRYKO,
  'dryko-drykomanta-aluminio-tipo-iii-3mm': 'https://dryko.com.br/wp-content/uploads/2020/01/drykomanta-aluminio.jpg',
  'dryko-drykomanta-antiraiz-tipo-iii-4mm': MANTA_DRYKO,
  'denver-denvermanta-elastic-tipo-iii-4mm': MANTA_DRYKO,
  'denver-impermanta-max-tipo-ii-pp-3mm': MANTA_DRYKO,
  'denver-impermanta-max-tipo-ii-aluminio-3mm': MANTA_DRYKO,
  'q-borg-manta-asfaltica-poliester-tipo-ii-3mm': MANTA_DRYKO,
  'q-borg-manta-asfaltica-poliester-tipo-ii-4mm': MANTA_DRYKO,
  'q-borg-manta-asfaltica-aluminio-3mm': MANTA_DRYKO,
  'q-borg-manta-asfaltica-aluminio-30kg': MANTA_DRYKO,
  'mundo-flex-manta-asfaltica-aluminio-3mm': MANTA_DRYKO,

  // ── FITAS ALUMINIZADAS ────────────────────────────────────────────────────
  'viapol-betufita-20cm-fita-asfaltica-aluminizada': FITA_VIAPOL,
  'viapol-betufita-15cm-fita-asfaltica-aluminizada': FITA_VIAPOL,
  'viapol-betufita-94cm-fita-asfaltica-aluminizada': FITA_VIAPOL,
  'viapol-viaflex-sleeve-telha-fita-aluminizada-20cm': FITA_VIAPOL,
  'dryko-fita-vedatudo-30cm-fita-asfaltica-aluminizada': FITA_DRYKO,
  'dryko-fita-vedatudo-20cm-fita-asfaltica-aluminizada': FITA_DRYKO,
  'dryko-fita-vedatudo-10cm-fita-asfaltica-aluminizada': FITA_DRYKO,
  'dryko-fita-vedatudo-15cm-fita-asfaltica-aluminizada': FITA_DRYKO,
  'dryko-fita-vedatudo-60cm-fita-asfaltica-aluminizada': FITA_DRYKO,
  'dryko-drykomanta-vedatudo-al-tipo-i-manta-adesiva': FITA_DRYKO,
  'plastiband-10cm-fita-asfaltica-aluminizada': FITA_PLASTIBAND,
  'plastiband-15cm-fita-asfaltica-aluminizada': FITA_PLASTIBAND,
  'plastiband-20cm-fita-asfaltica-aluminizada': FITA_PLASTIBAND,
  'plastiband-30cm-fita-asfaltica-aluminizada': FITA_PLASTIBAND,
  'plastiband-45cm-fita-asfaltica-aluminizada': FITA_PLASTIBAND,
  'plastiband-60cm-fita-asfaltica-aluminizada': FITA_PLASTIBAND,
  'plastiband-90cm-fita-asfaltica-aluminizada': FITA_PLASTIBAND,
  'vedacit-pro-adesivo-elastomerico-fita-aluminizada-10m': FITA_VIAPOL,
  'q-borg-uso-geral-10cm-fita-asfaltica-aluminizada': FITA_VIAPOL,
  'q-borg-uso-geral-15cm-fita-asfaltica-aluminizada': FITA_VIAPOL,
  'q-borg-uso-geral-20cm-fita-asfaltica-aluminizada': FITA_VIAPOL,
  'q-borg-uso-geral-30cm-fita-asfaltica-aluminizada': FITA_VIAPOL,
  'q-borg-uso-geral-45cm-fita-asfaltica-aluminizada': FITA_VIAPOL,
  'q-borg-uso-geral-60cm-fita-asfaltica-aluminizada': FITA_VIAPOL,

  // ── SELANTES PU ──────────────────────────────────────────────────────────
  'q-borg-pu-40-multiuso-branco-800g': SELANTE_MLB,
  'q-borg-pu-40-multiuso-cinza-sache': SELANTE_MLB,
  'q-borg-pu-40-multiuso-preto-sache': SELANTE_MLB,
  'q-borg-pu-40-multiuso-preto-bisnaga': SELANTE_MLB,
  'q-borg-pu-40-multiuso-branco-bisnaga': SELANTE_MLB,
  'q-borg-pu-40-multiuso-cinza-310ml': SELANTE_MLB,
  'q-borg-pu-q-25-premium-cinza': SELANTE_MLB,
  'q-borg-pu-q-25-premium-branco': SELANTE_MLB,
  'q-borg-pro-selante-para-calhas-e-rufos-cinza': SELANTE_MLB,
  'ultra-ved-pu-40-professional-cinza-800g': SELANTE_MLB,
  'ultra-ved-pu-40-professional-branco-800g': SELANTE_MLB,
  'ultra-ved-pu-40-professional-preto-800g': SELANTE_MLB,
  'ultra-ved-pu-40-multiuso-cinza-400g': SELANTE_MLB,
  'ultra-ved-pu-40-multiuso-branco-400g': SELANTE_MLB,
  'ultra-ved-pu-40-multiuso-preto-400g': SELANTE_MLB,

  // ── SILICONES ────────────────────────────────────────────────────────────
  'q-borg-pro-silicone-acetico-incolor': SILICONE_MLB,
  'q-borg-silicone-neutro-incolor': SILICONE_MLB,
  'poliplas-silicone-acetico-incolor': SILICONE_MLB,
  'poxpur-silicone-acetico-uso-geral-incolor': SILICONE_MLB,

  // ── MASTIQUE ─────────────────────────────────────────────────────────────
  'viapol-heydicryl-mastique-acrilico-5kg': PRIMER_MLB,

  // ── PRIMERS ──────────────────────────────────────────────────────────────
  'viapol-ecoprimer-asfaltico': PRIMER_MLB,
  'vedacit-pro-primer-para-mantas-asfalticas': PRIMER_MLB,
  'vedacit-pro-primer-asfaltico-solvente': PRIMER_MLB,
  'maxton-maxprimer-asfaltico': PRIMER_MLB,
  'dryko-drykoprimer-acqua-asfaltico': PRIMER_MLB,
  'denver-denverprimer-acqua-asfaltico': PRIMER_MLB,
  'q-borg-primer-asfaltico': PRIMER_MLB,
  'viapol-vitpoli-primer-epoxi': EPOXI_QTZ,

  // ── IMPERMEABILIZANTES CIMENTÍCIOS ────────────────────────────────────────
  'viapol-viaplus-1000-impermeabilizante-cimenticio-18kg': VIAPLUS1000,
  'viapol-viaplus-1000-impermeabilizante-cimenticio-5kg': VIAPLUS1000,
  'viapol-viaplus-2000-fibras-argamassa-polimerica': VIAPLUS2000,
  'denver-denvertec-100-argamassa-polimerica': VIAPLUS1000,
  'vedacit-vedatop-7000-fibras-18kg': VIAPLUS1000,
  'vedacit-pro-vedatop-5000-18kg': VIAPLUS1000,
  'vedacit-pro-vedatop-1000-18kg': VIAPLUS1000,

  // ── ADITIVOS ─────────────────────────────────────────────────────────────
  'aditivo-plastificante': ADITIVO_VDC,
  'contra-umidade-aditivo-impermeabilizante': ADITIVO_VDC,
  'veda-facil-aditivo-hidrofugante': ADITIVO_VDC,
  'vedacit-polif-aditivo-plastificante-pega-normal': ADITIVO_VDC,
  'vedacit-pro-aditivo-impermeabilizante': ADITIVO_VDC,
  'vedacit-vedalit-aditivo-plastificante': ADITIVO_VDC,
  'vedacit-pro-emulsao-asfaltica-com-cargas': PRIMER_MLB,
  'viapol-eucon-vandex-aditivo-impermeabilizante': ADITIVO_VDC,
  'viapol-viamix-aditivo-expansor': ADITIVO_VDC,
  'viapol-viacal-aditivo-plastificante-substituto-de-cal': ADITIVO_VDC,
  'dryko-drykofix-aditivo-adesivo-chapisco': ADITIVO_VDC,

  // ── ADESIVOS EPÓXI ────────────────────────────────────────────────────────
  'quartzolit-tecbond-mf-adesivo-epoxi-estrutural-fluido': EPOXI_QTZ,
  'quartzolit-tecbond-tix-adesivo-epoxi-estrutural-tixotropico': EPOXI_QTZ,
  'viafix-adesivo-para-chapisco-200kg': ADITIVO_VDC,
  'viafix-adesivo-para-chapisco-18kg': ADITIVO_VDC,
  'viapoxi-adesivo-epoxi-estrutural': EPOXI_QTZ,
  'colamax-plus-adesivo-para-chapisco-tambor': ADITIVO_VDC,
  'colamax-plus-adesivo-para-chapisco-balde': ADITIVO_VDC,
  'colamax-epoxi-mf-adesivo-estrutural-fluido': EPOXI_QTZ,
  'colamax-epoxi-tix-adesivo-estrutural-tixotropico': EPOXI_QTZ,
  'vedacit-compound-tix-adesivo-epoxi-estrutural-1kg': EPOXI_VDC,
  'vedacit-compound-mf-adesivo-epoxi-estrutural-1kg': EPOXI_VDC,
  'vedacit-pro-bianco-aditivo-adesivo-para-chapisco': ADITIVO_VDC,
  'denverfix-adesivo-para-chapisco': ADITIVO_VDC,
  'dryko-epoxi-mf-adesivo-estrutural-fluido': EPOXI_QTZ,
  'dryko-epoxi-tx-adesivo-estrutural-tixotropico': EPOXI_QTZ,

  // ── GRAUTE ───────────────────────────────────────────────────────────────
  'quartzolit-supergraute-graute-estrutural-25kg': GRAUTE_QTZ,
  'viapol-eucorepair-ferroprotec-protecao-anticorrosiva': ADITIVO_VDC,
  'viapol-fuseprotec-parede-protecao-de-concreto': ADITIVO_VDC,
  'viapol-vandex-super-impermeabilizacao-estrutural': VIAPLUS1000,

  // ── DESMOLDANTES / CURA ───────────────────────────────────────────────────
  'curacreto-pa-10-agente-de-cura': ADITIVO_VDC,
  'desforma-plus-desmoldante-200l': ADITIVO_VDC,
  'desforma-plus-desmoldante-18l': ADITIVO_VDC,
  'desmolton-md-desmoldante-biodegradavel': ADITIVO_VDC,
  'desmolton-mu-desmoldante-multiuso': ADITIVO_VDC,
  'curaton-cq-agente-de-cura': ADITIVO_VDC,
  'curaton-cq-agente-de-cura-18kg': ADITIVO_VDC,

  // ── DRENAGEM / GEOTÊXTEIS ─────────────────────────────────────────────────
  'mactex-geotextil-nao-tecido-il-21-2': GEOTEXTIL,
  'fiberstrand-100-1-2-fibra-de-polipropileno-para-concreto-600g': ADITIVO_VDC,
  'viaboc-ralo-duplo-de-epdm-com-geotextil-100mm': TUBO_DREN,
  'viaboc-ralo-duplo-de-epdm-com-geotextil-150mm': TUBO_DREN,
  'viaboc-ralo-duplo-de-epdm-com-geotextil-75mm': TUBO_DREN,
  'placa-de-poliestireno-extrudado-xps-1500x600x25mm': XPS_PLACA,
  'placa-de-poliestireno-extrudado-xps-2000x500x25mm': XPS_PLACA,
  'salvatudo-isomanta-de-polietileno-para-protecao-15m': GEOTEXTIL,
  'salvatudo-isomanta-de-polietileno-para-protecao-25m': GEOTEXTIL,
  'bidim-rt-16-manta-geotextil-nao-tecido-300g-m': GEOTEXTIL,
  'hiper-tubo-corrugado-perfurado-para-drenagem-100mm': TUBO_DREN,
  'hiper-tubo-corrugado-perfurado-para-drenagem-65mm': TUBO_DREN,
  'branyl-tela-de-poliester-para-reforco-1-00x100m': GEOTEXTIL,
  'sika-sarnafil-s-327-membrana-de-pvc-para-impermeabilizacao-2-00x20m': GEOTEXTIL,
  'sika-sarnametal-chapa-metalica-com-revestimento-de-pvc-2-0x1-0m': GEOTEXTIL,

  // ── FERRAMENTAS / ACESSÓRIOS ─────────────────────────────────────────────
  'quartzolit-espuma-expansiva-de-pu-500ml': ESPUMA_PU,
  'etaniz-espuma-expansiva-de-pu-500ml': ESPUMA_PU,
  'q-borg-espuma-de-pu-uso-geral-500ml': ESPUMA_PU,
  'dryko-espuma-expansiva-de-pu-500ml': ESPUMA_PU,
  'vedacit-espuma-expansiva-de-pu-340g-500ml': ESPUMA_PU,
  'aplicador-para-silicone-e-selante-profissional-600ml': SILICONE_MLB,
  'broxa-para-pintura-retangular-18x8cm': SILICONE_MLB,
  'aplicador-para-silicone-bisnaga': SILICONE_MLB,

  // ── SELAMENTO / JUNTAS ────────────────────────────────────────────────────
  'perfil-hidroexpansivo-superstop-std-bentonitico': SELANTE_MLB,
  'tarugo-polipex-delimitador-de-junta-backer-rod-6mm': BACKER_ROD,
  'tarugo-polipex-delimitador-de-junta-backer-rod-8mm': BACKER_ROD,
  'tarugo-polipex-delimitador-de-junta-backer-rod-10mm': BACKER_ROD,
  'tarugo-polipex-delimitador-de-junta-backer-rod-12mm': BACKER_ROD,
  'tarugo-polipex-delimitador-de-junta-backer-rod-15mm': BACKER_ROD,
  'tarugo-polipex-delimitador-de-junta-backer-rod-20mm': BACKER_ROD,
  'tarugo-polipex-delimitador-de-junta-backer-rod-25mm': BACKER_ROD,

  // ── LIMPEZA / FITAS ADESIVAS ──────────────────────────────────────────────
  'remox-c-desincrustante-e-restaurador-quimico-50l': ADITIVO_VDC,
  'adere-fita-crepe-710-para-pintura-e-mascaramento-48mm-x-50m': SILICONE_MLB,
  'fita-silver-tape-prata-multiuso-48mm': SILICONE_MLB,
  'qualitape-fita-adesiva-transparente-48mm-x-45m': SILICONE_MLB,
  'tela-plastica-viveiro-ad-12-5mm-rolo-50m': GEOTEXTIL,
};

// Normalize slug for matching
function normalizeSlug(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-|-$/g,'');
}

const filePath = path.join(__dirname,'../src/data/products.ts');
let content = fs.readFileSync(filePath,'utf8');
const lines = content.split('\n');
let currentSlug = '', replaced = 0, skipped = 0;

const result = lines.map(line => {
  const s = line.match(/^\s+slug:\s*(?:generateSlug\('([^']+)'\)|'([^']+)')/);
  if (s) currentSlug = normalizeSlug(s[1]||s[2]);

  if (line.includes('imagem:') && line.includes('unsplash')) {
    const url = MAP[currentSlug];
    if (url) {
      replaced++;
      return line.replace(/imagem:\s*'[^']*'/, `imagem: '${url}'`);
    } else {
      skipped++;
    }
  }
  return line;
});

fs.writeFileSync(filePath, result.join('\n'));
console.log(`✅ Replaced: ${replaced} | Skipped (no map): ${skipped}`);
console.log(`📦 Total mapped: ${Object.keys(MAP).length}`);
