import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const envPath = path.join(ROOT_DIR, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausentes no .env');
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

const IMAGES_DIR = path.join(ROOT_DIR, 'public', 'images', 'products', 'PRODUTOS_DENVER');
const BASE_WEB_PATH = '/images/products/PRODUTOS_DENVER/';

// Helper: Remove acentos
function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Helper: Normaliza para matching
function normalizeText(str) {
  if (!str) return '';
  let s = removeAccents(str).toUpperCase();
  // Remove special chars except spaces and alphanumeric
  s = s.replace(/[^A-Z0-9 ]/g, ' ');
  // Stop words / units
  const stopWords = ['CX', 'CAIXA', 'BD', 'BALDE', 'LT', 'LATA', 'GL', 'GALAO', 'KG', 'LITROS', 'LITRO', 'MM', 'CM', 'MT', 'METROS', 'M', 'L', 'TIPO', 'II', 'III', 'I'];
  const words = s.split(/\s+/).filter(w => w.length > 0 && !stopWords.includes(w));
  return words.join(' ');
}

// Jaccard similarity based on words
function calculateSimilarity(str1, str2) {
  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);
  const set1 = new Set(norm1.split(' '));
  const set2 = new Set(norm2.split(' '));
  
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return (intersection.size / union.size) * 100;
}

// Bigram similarity for better fuzzy match
function bigramSimilarity(str1, str2) {
  const s1 = normalizeText(str1).replace(/\s+/g, '');
  const s2 = normalizeText(str2).replace(/\s+/g, '');
  if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 100 : 0;
  
  const bigrams1 = new Set();
  for (let i = 0; i < s1.length - 1; i++) bigrams1.add(s1.substring(i, i + 2));
  
  let matches = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bg = s2.substring(i, i + 2);
    if (bigrams1.has(bg)) {
      matches++;
      bigrams1.delete(bg); // avoid double counting
    }
  }
  const total = Math.max(s1.length - 1, s2.length - 1);
  return (matches / total) * 100;
}

async function run() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  
  const FOLDER_NAME = path.basename(IMAGES_DIR);
  const BRAND_NAME = FOLDER_NAME.replace('PRODUTOS_', '');
  
  console.log(`🚀 Iniciando Sincronização de Imagens ${BRAND_NAME} (Modo: ${isApply ? 'APPLY' : 'DRY-RUN'})`);

  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`Pasta não encontrada: ${IMAGES_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(IMAGES_DIR).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));
  console.log(`📸 Encontradas ${files.length} imagens locais na pasta ${FOLDER_NAME}.`);

  // Pega apenas produtos da marca correspondente ou que possuem o nome da marca
  const { data: products, error } = await supabase
    .from('products')
    .select('id, slug, name, brand, image, images, active')
    .or(`brand.ilike.%${BRAND_NAME}%,name.ilike.%${BRAND_NAME}%,slug.ilike.%${BRAND_NAME}%`)
    .eq('active', true);

  if (error) {
    console.error('Erro ao buscar produtos:', error);
    process.exit(1);
  }

  console.log(`📦 Encontrados ${products.length} produtos correspondentes à marca ${BRAND_NAME}.`);

  const matchResults = [];
  const orphanFiles = new Set(files);
  const productsWithoutMatch = new Set(products.map(p => p.id));

  // Agrupar arquivos por nome base ignorando sufixos _capa, _foto2, _1, etc.
  const groupedFiles = {};
  files.forEach(f => {
    let base = f.replace(/\.[^/.]+$/, ""); // remove extension
    base = base.replace(/_(capa|foto[0-9]+|[0-9]+)$/i, "");
    base = base.replace(/ capa$/i, "");
    
    if (!groupedFiles[base]) groupedFiles[base] = [];
    groupedFiles[base].push(f);
  });

  // Matching
  for (const baseFileName of Object.keys(groupedFiles)) {
    let bestMatch = null;
    let bestScore = 0;

    for (const p of products) {
      const score1 = calculateSimilarity(baseFileName, p.name);
      const score2 = bigramSimilarity(baseFileName, p.name);
      const finalScore = Math.max(score1, score2);

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestMatch = p;
      }
    }

    if (bestMatch && bestScore >= 75) {
      matchResults.push({
        product: bestMatch,
        baseFileName,
        files: groupedFiles[baseFileName],
        score: bestScore
      });
      productsWithoutMatch.delete(bestMatch.id);
      groupedFiles[baseFileName].forEach(f => orphanFiles.delete(f));
    } else {
      console.warn(`⚠️ Arquivo '${baseFileName}' não teve score suficiente (${bestScore.toFixed(1)}%)`);
    }
  }

  const toUpdate = [];
  const conflicts = [];

  for (const match of matchResults) {
    const p = match.product;
    const sortedFiles = match.files.sort((a, b) => {
      // Prioridade: _capa > capa > _1 > sem sufixo > _foto2
      const sa = a.toLowerCase();
      const sb = b.toLowerCase();
      if (sa.includes('capa')) return -1;
      if (sb.includes('capa')) return 1;
      return sa.localeCompare(sb);
    });

    const newMainImage = BASE_WEB_PATH + sortedFiles[0];
    const newImagesArray = sortedFiles.map(f => BASE_WEB_PATH + f);

    // Mesclar com existentes (não apagar Supabase URLs válidas)
    let finalImage = p.image;
    let finalImages = Array.isArray(p.images) ? [...p.images] : [];

    if (!finalImage || finalImage.startsWith('blob:') || finalImage === 'null') {
      finalImage = newMainImage;
    } else if (match.score >= 90) {
      // Sobrescreve com local preferencial se for alta certeza e não for URL remota rica
      // Se a URL for de storage do supabase, podemos manter e adicionar a nova no array, 
      // mas a regra diz "usar como capa" se for do folder local e for o match
      finalImage = newMainImage; 
    }

    // Adiciona ao array sem duplicatas
    const imagesSet = new Set(finalImages);
    newImagesArray.forEach(img => imagesSet.add(img));
    finalImages = Array.from(imagesSet).filter(img => img && !img.startsWith('blob:') && img !== 'null');

    // Remove duplicates
    
    // Check conflicts (se score for menor que 90 mas >= 75)
    if (match.score < 90) {
      conflicts.push({
        productName: p.name,
        fileName: match.baseFileName,
        score: match.score
      });
    } else {
      toUpdate.push({
        id: p.id,
        slug: p.slug,
        name: p.name,
        oldImage: p.image,
        newImage: finalImage,
        oldImages: p.images,
        newImages: finalImages,
        score: match.score
      });
    }
  }

  const reportsDir = path.join(ROOT_DIR, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  
  let reportMd = `# ${BRAND_NAME} Image Sync Report\n**Data:** ${new Date().toLocaleString('pt-BR')}\n**Modo:** ${isApply ? 'APPLY' : 'DRY-RUN'}\n\n`;
  
  reportMd += `## Resumo\n`;
  reportMd += `- Total de produtos ${BRAND_NAME} no DB: ${products.length}\n`;
  reportMd += `- Imagens locais encontradas: ${files.length}\n`;
  reportMd += `- Matches seguros (>=90%): ${toUpdate.length}\n`;
  reportMd += `- Conflitos (75-89%): ${conflicts.length}\n`;
  reportMd += `- Produtos sem match: ${productsWithoutMatch.size}\n`;
  reportMd += `- Arquivos órfãos: ${orphanFiles.size}\n\n`;

  if (toUpdate.length > 0) {
    reportMd += `## 🟢 Imagens Atualizadas (Score >= 90%)\n`;
    toUpdate.forEach(u => {
      reportMd += `- **${u.name}** (${u.score.toFixed(1)}%)\n`;
      reportMd += `  - Capa: \`${u.oldImage || 'Nenhuma'}\` ➔ \`${u.newImage}\`\n`;
      reportMd += `  - Galeria: ${u.newImages.length} imagem(ns)\n`;
    });
    reportMd += `\n`;
  }

  if (conflicts.length > 0) {
    reportMd += `## 🟡 Conflitos / Atenção (Score < 90%)\n`;
    conflicts.forEach(c => {
      reportMd += `- **Produto:** ${c.productName}\n`;
      reportMd += `  - **Arquivo:** ${c.fileName}\n`;
      reportMd += `  - **Score:** ${c.score.toFixed(1)}%\n`;
    });
    reportMd += `\n`;
  }

  if (productsWithoutMatch.size > 0) {
    reportMd += `## 🔴 Produtos ${BRAND_NAME} sem Imagem Local\n`;
    products.filter(p => productsWithoutMatch.has(p.id)).forEach(p => {
      reportMd += `- ${p.name}\n`;
    });
    reportMd += `\n`;
  }

  if (orphanFiles.size > 0) {
    reportMd += `## 👻 Arquivos Órfãos (Nenhum produto bateu)\n`;
    Array.from(orphanFiles).forEach(f => {
      reportMd += `- ${f}\n`;
    });
    reportMd += `\n`;
  }

  fs.writeFileSync(path.join(reportsDir, 'denver-image-sync-report.md'), reportMd, 'utf8');
  console.log(`✅ Relatório gerado em: reports/denver-image-sync-report.md`);

  if (isApply) {
    if (toUpdate.length > 0) {
      console.log(`💾 Aplicando atualizações no Supabase (${toUpdate.length} produtos)...`);
      for (const update of toUpdate) {
        const { error } = await supabase
          .from('products')
          .update({
            image: update.newImage,
            images: update.newImages
          })
          .eq('id', update.id);
        
        if (error) {
          console.error(`❌ Erro ao atualizar ${update.name}:`, error.message);
        } else {
          console.log(`✅ Atualizado: ${update.name}`);
        }
      }
      console.log(`🎉 Sincronização concluída com sucesso.`);
    } else {
      console.log(`Nenhuma atualização segura para aplicar.`);
    }
  } else {
    console.log(`\n⚠️ Modo DRY-RUN concluído. Para aplicar as alterações, execute:`);
    console.log(`node scripts/sync-denver-images.mjs --apply`);
    
    // As per user instruction 8, if dry run is successful and we want to auto-apply
    if (toUpdate.length > 0 && conflicts.length === 0) {
      console.log(`\nNenhum conflito encontrado. Aplicando automaticamente conforme regra 8...`);
      import('child_process').then(cp => {
        cp.execSync('node scripts/sync-denver-images.mjs --apply', { stdio: 'inherit' });
      });
    }
  }
}

run();
