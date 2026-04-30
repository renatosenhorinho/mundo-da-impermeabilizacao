/**
 * real-images-v3.cjs
 * Matches by normalized NOME (not slug) to handle generateSlug() text correctly.
 * Covers all 123 remaining products that still have Unsplash URLs.
 */
const fs = require('fs'), path = require('path');

// ── Shared CDN constants ─────────────────────────────────────────────────────
const MLB = {
  manta_vedacit:  'https://http2.mlstatic.com/D_NQ_NP_712085-MLA93766628927_092025-O.webp',
  manta_viapol:   'https://http2.mlstatic.com/D_NQ_NP_994966-MLB51275468160_082022-O.webp',
  manta_dryko:    'https://dryko.com.br/wp-content/uploads/2021/04/VEDATUDO_500g_INCOLOR.jpg',
  fita_dryko:     'https://dryko.com.br/wp-content/uploads/2020/01/VEDATUDO-30CM.jpg',
  fita_viapol:    'https://http2.mlstatic.com/D_NQ_NP_994966-MLB51275468160_082022-O.webp',
  fita_generic:   'https://http2.mlstatic.com/D_NQ_NP_833866-MLB70494128062_072023-O.webp',
  primer:         'https://http2.mlstatic.com/D_NQ_NP_833866-MLB70494128062_072023-O.webp',
  selante_pu:     'https://http2.mlstatic.com/D_NQ_NP_908868-MLB80582294157_112024-O.webp',
  silicone:       'https://http2.mlstatic.com/D_NQ_NP_602161-MLB75836814324_042024-O.webp',
  epoxi_qtzolit:  'https://http2.mlstatic.com/D_Q_NP_2X_763541-MLB46583717784_072021-R.webp',
  epoxi_vedacit:  'https://http2.mlstatic.com/D_NQ_NP_944365-MLU73099955431_112023-O.webp',
  graute:         'https://http2.mlstatic.com/D_NQ_NP_668742-MLB81216503883_122024-O.webp',
  espuma_pu:      'https://http2.mlstatic.com/D_NQ_NP_963157-MLB71004128062_082023-O.webp',
  geotextil:      'https://http2.mlstatic.com/D_NQ_NP_753235-MLB47668600813_092021-O.webp',
  tubo_dren:      'https://http2.mlstatic.com/D_NQ_NP_699566-MLB74735516084_022024-O.webp',
  backer_rod:     'https://http2.mlstatic.com/D_NQ_NP_723376-MLB70494128064_072023-O.webp',
  xps:            'https://http2.mlstatic.com/D_NQ_NP_668742-MLB81216503883_122024-O.webp',
  aditivo:        'https://http2.mlstatic.com/D_NQ_NP_833866-MLB70494128062_072023-O.webp',
  chapisco:       'https://http2.mlstatic.com/D_NQ_NP_906325-MLB47668600813_092021-O.webp',
  viaplus1000:    'https://http2.mlstatic.com/D_NQ_NP_906325-MLB47668600813_092021-O.webp',
  viaplus2000:    'https://http2.mlstatic.com/D_NQ_NP_994966-MLB51275468160_082022-O.webp',
  argamassa:      'https://http2.mlstatic.com/D_NQ_NP_906325-MLB47668600813_092021-O.webp',
  manta_liquida_branca: 'https://http2.mlstatic.com/D_NQ_NP_833866-MLB70494128062_072023-O.webp',
  manta_liquida_preta:  'https://http2.mlstatic.com/D_NQ_NP_712085-MLA93766628927_092025-O.webp',
  manta_liquida_acril:  'https://http2.mlstatic.com/D_NQ_NP_994966-MLB51275468160_082022-O.webp',
  desmoldante:    'https://http2.mlstatic.com/D_NQ_NP_906325-MLB47668600813_092021-O.webp',
  ferramenta:     'https://http2.mlstatic.com/D_NQ_NP_602161-MLB75836814324_042024-O.webp',
};

// ── Nome-based mapping ────────────────────────────────────────────────────────
// Key = normalized nome (lowercase, no accents, words separated by single space)
function norm(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim();
}

const BY_NOME = {
  // Fitas
  'q-borg uso geral 90cm fita asfaltica aluminizada': MLB.fita_viapol,

  // Manta Liquida - Viapol Vedalage
  'viapol vedalage manta liquida branca': MLB.manta_liquida_branca,
  'viapol vedalage plus manta liquida telha': MLB.manta_liquida_branca,
  'viapol vedalage manta liquida preta asfaltica': MLB.manta_liquida_preta,

  // Manta Liquida - Maxton
  'maxton maxpren laje manta liquida branca': MLB.manta_liquida_branca,
  'maxton maxpren pintura impermeavel parede premium': MLB.manta_liquida_branca,
  'maxton maxpren pro manta liquida aluminio': MLB.manta_liquida_preta,

  // Manta Liquida - outros
  'do mestre manta liquida branca': MLB.manta_liquida_branca,
  'hydrolin manta liquida asfaltica': MLB.manta_liquida_preta,
  'denver elastic hp poliuretano': MLB.manta_liquida_preta,
  'dryko drykolaje top manta liquida branca': MLB.manta_liquida_branca,
  'soprema alsan acril manta liquida acrilica': MLB.manta_liquida_acril,
  'quartzolit acrifast manta liquida acrilica': MLB.manta_liquida_acril,
  'sika sikalastic 612 poliuretano cinza': MLB.manta_liquida_preta,

  // Vedacit Vedapren
  'vedacit pro vedapren manta liquida asfaltica preta': MLB.manta_liquida_preta,
  'vedacit pro vedapren manta liquida branca acrilica 18kg': MLB.manta_liquida_branca,
  'vedacit pro vedapren pintura impermeavel para parede 18kg': MLB.manta_liquida_branca,
  'vedacit pro primer asfaltico solvente 18l': MLB.primer,

  // Argamassa Polimerica - Viapol
  'viapol viaplus 5000 argamassa polimerica 18kg': MLB.viaplus1000,
  'viapol viapolseca po 2 cimento rapido 15kg': MLB.argamassa,
  'viapol viapolseca po 2 cimento rapido 4kg': MLB.argamassa,
  'viapol viaplus protec argamassa polimerica 18kg': MLB.viaplus1000,
  'viapol vedamat 100 argamassa polimerica 18kg': MLB.viaplus1000,

  // Argamassa - Maxton
  'maxton veda facil plus argamassa polimerica 18kg': MLB.argamassa,
  'maxton veda facil flex argamassa polimerica flexivel 18kg': MLB.argamassa,
  'maxton veda facil flex fibras argamassa polimerica 18kg': MLB.argamassa,
  'maxton veda facil flex uv argamassa polimerica 18kg': MLB.argamassa,
  'maxton veda facil rodape argamassa impermeabilizante 4kg': MLB.argamassa,

  // Argamassa - Denver
  'denver denvertec 540 argamassa polimerica flexivel 18kg': MLB.argamassa,
  'denver denvertec 540 argamassa polimerica fibras 18kg': MLB.argamassa,
  'denver denvertec 100 argamassa polimerica': MLB.argamassa,

  // Argamassa - Vedacit Vedatop
  'vedacit vedatop 7000 fibras 18kg': MLB.viaplus1000,
  'vedacit pro vedatop 5000 18kg': MLB.viaplus1000,
  'vedacit pro vedatop 1000 18kg': MLB.viaplus1000,

  // Argamassa - Viapol Viaplus 2000
  'viapol viaplus 2000 fibras argamassa polimerica': MLB.viaplus2000,

  // Primers adicionais
  'viapol ecoprimer asfaltico': MLB.primer,

  // Cimento rapido
  'viapol viapolseca po 2 cimento rapido': MLB.argamassa,

  // Mantas Ardosiadas - Viapol (já em product-images.json mas com unsplash no campo imagem)
  'viapol manta premium ardosia cinza 3mm': MLB.manta_viapol,
  'viapol manta premium ardosia verde 3mm': MLB.manta_viapol,
  'viapol manta premium ardosia vermelho 3mm': MLB.manta_viapol,
  'viapol manta premium ardosia verde 4mm': MLB.manta_viapol,
  'viapol betumanta 3 pp manta asfaltica': MLB.manta_viapol,
  'viapol betumanta 2 e manta asfaltica': MLB.manta_viapol,
  'viapol torodin 3500 3 pp manta asfaltica': MLB.manta_viapol,
  'manta asfaltica vedacit 3mm': MLB.manta_vedacit,
  'manta asfaltica vedacit 4mm': MLB.manta_vedacit,
  'manta asfaltica viapol 4mm': MLB.manta_viapol,

  // Vedacit Pro Mantas
  'vedacit pro ii b poliester 3mm': MLB.manta_vedacit,
  'vedacit pro ii b poliester 4mm': MLB.manta_vedacit,
  'vedacit pro ii b aluminio poliester 3mm': MLB.manta_vedacit,
  'vedacit pro ii b aluminio glass 3mm': MLB.manta_vedacit,
  'vedacit pro iii b poliester 3mm': MLB.manta_vedacit,
  'vedacit pro iii b poliester 4mm': MLB.manta_vedacit,
  'vedacit pro iii b aluminio 3mm': MLB.manta_vedacit,
  'vedacit pro iii b aluminio 4mm manta asfaltica': MLB.manta_vedacit,

  // Dryko Mantas
  'dryko drykomanta flex tipo ii pp 3mm': MLB.manta_dryko,
  'dryko drykomanta tipo iii pp 3mm': MLB.manta_dryko,
  'dryko drykomanta tipo iii pp 4mm': MLB.manta_dryko,
  'dryko drykomanta top tipo iv pp 4mm': MLB.manta_dryko,
  'dryko drykomanta aluminio tipo iii 3mm': MLB.manta_dryko,
  'dryko drykomanta antiraiz tipo iii 4mm': MLB.manta_dryko,
  'denver denvermanta elastic tipo iii 4mm': MLB.manta_dryko,
  'denver impermanta max tipo ii pp 3mm': MLB.manta_dryko,
  'denver impermanta max tipo ii aluminio 3mm': MLB.manta_dryko,
  'q-borg manta asfaltica poliester tipo ii 3mm': MLB.manta_dryko,
  'q-borg manta asfaltica poliester tipo ii 4mm': MLB.manta_dryko,
  'q-borg manta asfaltica aluminio 3mm': MLB.manta_dryko,
  'q-borg manta asfaltica aluminio 30kg': MLB.manta_dryko,
  'mundo flex manta asfaltica aluminio 3mm': MLB.manta_dryko,

  // Dryko Fitas
  'dryko fita vedatudo 30cm fita asfaltica aluminizada': MLB.fita_dryko,
  'dryko fita vedatudo 20cm fita asfaltica aluminizada': MLB.fita_dryko,
  'dryko fita vedatudo 10cm fita asfaltica aluminizada': MLB.fita_dryko,
  'dryko fita vedatudo 15cm fita asfaltica aluminizada': MLB.fita_dryko,
  'dryko fita vedatudo 60cm fita asfaltica aluminizada': MLB.fita_dryko,
  'dryko drykomanta vedatudo al tipo i manta adesiva': MLB.fita_dryko,

  // Viapol Betufita
  'viapol betufita 20cm fita asfaltica aluminizada': MLB.fita_viapol,
  'viapol betufita 15cm fita asfaltica aluminizada': MLB.fita_viapol,
  'viapol betufita 94cm fita asfaltica aluminizada': MLB.fita_viapol,
  'viapol viaflex sleeve telha fita aluminizada': MLB.fita_viapol,

  // Plastiband
  'plastiband 10cm fita asfaltica aluminizada': MLB.fita_generic,
  'plastiband 15cm fita asfaltica aluminizada': MLB.fita_generic,
  'plastiband 20cm fita asfaltica aluminizada': MLB.fita_generic,
  'plastiband 30cm fita asfaltica aluminizada': MLB.fita_generic,
  'plastiband 45cm fita asfaltica aluminizada': MLB.fita_generic,
  'plastiband 60cm fita asfaltica aluminizada': MLB.fita_generic,
  'plastiband 90cm fita asfaltica aluminizada': MLB.fita_generic,
  'vedacit pro adesivo elastomerico fita aluminizada 10m': MLB.fita_generic,
  'q-borg uso geral 10cm fita asfaltica aluminizada': MLB.fita_viapol,
  'q-borg uso geral 15cm fita asfaltica aluminizada': MLB.fita_viapol,
  'q-borg uso geral 20cm fita asfaltica aluminizada': MLB.fita_viapol,
  'q-borg uso geral 30cm fita asfaltica aluminizada': MLB.fita_viapol,
  'q-borg uso geral 45cm fita asfaltica aluminizada': MLB.fita_viapol,
  'q-borg uso geral 60cm fita asfaltica aluminizada': MLB.fita_viapol,

  // Selantes PU - Q-Borg
  'q-borg pu 40 multiuso branco 800g': MLB.selante_pu,
  'q-borg pu 40 multiuso cinza sache': MLB.selante_pu,
  'q-borg pu 40 multiuso preto sache': MLB.selante_pu,
  'q-borg pu 40 multiuso preto bisnaga': MLB.selante_pu,
  'q-borg pu 40 multiuso branco bisnaga': MLB.selante_pu,
  'q-borg pu 40 multiuso cinza 310ml': MLB.selante_pu,
  'q-borg pu q-25 premium cinza': MLB.selante_pu,
  'q-borg pu q-25 premium branco': MLB.selante_pu,
  'q-borg pro selante para calhas e rufos cinza': MLB.selante_pu,
  'ultra ved pu 40 professional cinza 800g': MLB.selante_pu,
  'ultra ved pu 40 professional branco 800g': MLB.selante_pu,
  'ultra ved pu 40 professional preto 800g': MLB.selante_pu,
  'ultra ved pu 40 multiuso cinza 400g': MLB.selante_pu,
  'ultra ved pu 40 multiuso branco 400g': MLB.selante_pu,
  'ultra ved pu 40 multiuso preto 400g': MLB.selante_pu,

  // Silicones
  'q-borg pro silicone acetico incolor': MLB.silicone,
  'q-borg silicone neutro incolor': MLB.silicone,
  'poliplas silicone acetico incolor': MLB.silicone,
  'poxpur silicone acetico uso geral incolor': MLB.silicone,

  // Mastique
  'viapol heydicryl mastique acrilico 5kg': MLB.manta_liquida_branca,

  // Primers
  'vedacit pro primer para mantas asfalticas': MLB.primer,
  'vedacit pro primer asfaltico solvente 18l': MLB.primer,
  'maxton maxprimer asfaltico': MLB.primer,
  'dryko drykoprimer acqua asfaltico': MLB.primer,
  'denver denverprimer acqua asfaltico': MLB.primer,
  'q-borg primer asfaltico': MLB.primer,
  'viapol vitpoli primer epoxi': MLB.epoxi_qtzolit,

  // Aditivos
  'aditivo plastificante': MLB.aditivo,
  'contra umidade aditivo impermeabilizante': MLB.aditivo,
  'veda facil aditivo hidrofugante': MLB.aditivo,
  'vedacit polif aditivo plastificante pega normal': MLB.aditivo,
  'vedacit pro aditivo impermeabilizante': MLB.aditivo,
  'vedacit vedalit aditivo plastificante': MLB.aditivo,
  'vedacit pro emulsao asfaltica com cargas': MLB.primer,
  'viapol eucon vandex aditivo impermeabilizante': MLB.aditivo,
  'viapol viamix aditivo expansor': MLB.aditivo,
  'viapol viacal aditivo plastificante substituto de cal': MLB.aditivo,
  'dryko drykofix aditivo adesivo chapisco': MLB.chapisco,

  // Adesivos / Epóxi / Chapisco
  'quartzolit tecbond mf adesivo epoxi estrutural fluido': MLB.epoxi_qtzolit,
  'quartzolit tecbond tix adesivo epoxi estrutural tixotropico': MLB.epoxi_qtzolit,
  'viafix adesivo para chapisco 200kg': MLB.chapisco,
  'viafix adesivo para chapisco 18kg': MLB.chapisco,
  'viapoxi adesivo epoxi estrutural': MLB.epoxi_qtzolit,
  'colamax plus adesivo para chapisco tambor': MLB.chapisco,
  'colamax plus adesivo para chapisco balde': MLB.chapisco,
  'colamax epoxi mf adesivo estrutural fluido': MLB.epoxi_qtzolit,
  'colamax epoxi tix adesivo estrutural tixotropico': MLB.epoxi_qtzolit,
  'vedacit compound tix adesivo epoxi estrutural 1kg': MLB.epoxi_vedacit,
  'vedacit compound mf adesivo epoxi estrutural 1kg': MLB.epoxi_vedacit,
  'vedacit pro bianco aditivo adesivo para chapisco': MLB.chapisco,
  'denverfix adesivo para chapisco': MLB.chapisco,
  'dryko epoxi mf adesivo estrutural fluido': MLB.epoxi_qtzolit,
  'dryko epoxi tx adesivo estrutural tixotropico': MLB.epoxi_qtzolit,

  // Graute
  'quartzolit supergraute graute estrutural 25kg': MLB.graute,
  'viapol eucorepair ferroprotec protecao anticorrosiva': MLB.aditivo,
  'viapol fuseprotec parede protecao de concreto': MLB.aditivo,
  'viapol vandex super impermeabilizacao estrutural': MLB.viaplus1000,

  // Desmoldantes / Cura
  'curacreto pa 10 agente de cura': MLB.desmoldante,
  'desforma plus desmoldante 200l': MLB.desmoldante,
  'desforma plus desmoldante 18l': MLB.desmoldante,
  'desmolton md desmoldante biodegradavel': MLB.desmoldante,
  'desmolton mu desmoldante multiuso': MLB.desmoldante,
  'curaton cq agente de cura': MLB.desmoldante,
  'curaton cq agente de cura 18kg': MLB.desmoldante,

  // Drenagem / Geotêxteis
  'mactex geotextil nao tecido il 21 2': MLB.geotextil,
  'fiberstrand 100 1 2 fibra de polipropileno para concreto 600g': MLB.aditivo,
  'viaboc ralo duplo de epdm com geotextil 100mm': MLB.tubo_dren,
  'viaboc ralo duplo de epdm com geotextil 150mm': MLB.tubo_dren,
  'viaboc ralo duplo de epdm com geotextil 75mm': MLB.tubo_dren,
  'placa de poliestireno extrudado xps 1500x600x25mm': MLB.xps,
  'placa de poliestireno extrudado xps 2000x500x25mm': MLB.xps,
  'salvatudo isomanta de polietileno para protecao 15m': MLB.geotextil,
  'salvatudo isomanta de polietileno para protecao 25m': MLB.geotextil,
  'bidim rt 16 manta geotextil nao tecido 300g m': MLB.geotextil,
  'hiper tubo corrugado perfurado para drenagem 100mm': MLB.tubo_dren,
  'hiper tubo corrugado perfurado para drenagem 65mm': MLB.tubo_dren,
  'branyl tela de poliester para reforco 1 00x100m': MLB.geotextil,
  'sika sarnafil s 327 membrana de pvc para impermeabilizacao 2 00x20m': MLB.geotextil,
  'sika sarnametal chapa metalica com revestimento de pvc 2 0x1 0m': MLB.geotextil,

  // Espuma PU / Ferramentas
  'quartzolit espuma expansiva de pu 500ml': MLB.espuma_pu,
  'etaniz espuma expansiva de pu 500ml': MLB.espuma_pu,
  'q-borg espuma de pu uso geral 500ml': MLB.espuma_pu,
  'dryko espuma expansiva de pu 500ml': MLB.espuma_pu,
  'vedacit espuma expansiva de pu 340g 500ml': MLB.espuma_pu,
  'aplicador para silicone e selante profissional 600ml': MLB.ferramenta,
  'broxa para pintura retangular 18x8cm': MLB.ferramenta,
  'aplicador para silicone bisnaga': MLB.ferramenta,

  // Selamento / Juntas / Backer Rod
  'perfil hidroexpansivo superstop std bentonitico': MLB.selante_pu,
  'tarugo polipex delimitador de junta backer rod 6mm': MLB.backer_rod,
  'tarugo polipex delimitador de junta backer rod 8mm': MLB.backer_rod,
  'tarugo polipex delimitador de junta backer rod 10mm': MLB.backer_rod,
  'tarugo polipex delimitador de junta backer rod 12mm': MLB.backer_rod,
  'tarugo polipex delimitador de junta backer rod 15mm': MLB.backer_rod,
  'tarugo polipex delimitador de junta backer rod 20mm': MLB.backer_rod,
  'tarugo polipex delimitador de junta backer rod 25mm': MLB.backer_rod,

  // Limpeza / Fitas Adesivas
  'remox c desincrustante e restaurador quimico 50l': MLB.aditivo,
  'adere fita crepe 710 para pintura e mascaramento 48mm x 50m': MLB.ferramenta,
  'fita silver tape prata multiuso 48mm': MLB.ferramenta,
  'qualitape fita adesiva transparente 48mm x 45m': MLB.ferramenta,
  'tela plastica viveiro ad 12 5mm rolo 50m': MLB.geotextil,
};

// ── Apply to products.ts ─────────────────────────────────────────────────────
const filePath = path.join(__dirname, '../src/data/products.ts');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
let currentNome = '', replaced = 0, skipped = 0;

const result = lines.map(line => {
  const n = line.match(/^\s+nome:\s*'([^']+)'/);
  if (n) currentNome = norm(n[1]);

  if (line.includes('imagem:') && line.includes('unsplash')) {
    const url = BY_NOME[currentNome];
    if (url) {
      replaced++;
      return line.replace(/imagem:\s*'[^']*'/, `imagem: '${url}'`);
    } else {
      skipped++;
      if (skipped <= 10) console.warn(`  [no map] "${currentNome}"`);
    }
  }
  return line;
});

fs.writeFileSync(filePath, result.join('\n'));
console.log(`\n✅ Replaced: ${replaced}`);
console.log(`⚠️  Skipped (no map): ${skipped}`);
