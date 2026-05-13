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

const IMAGES_BASE_DIR = path.join(ROOT_DIR, 'public', 'images', 'products');

function removeAccents(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(str: string) {
  if (!str) return '';
  let s = removeAccents(str).toUpperCase();
  s = s.replace(/[^A-Z0-9 ]/g, ' ');
  const stopWords = ['CX', 'CAIXA', 'BD', 'BALDE', 'LT', 'LATA', 'GL', 'GALAO', 'KG', 'LITROS', 'LITRO', 'MM', 'CM', 'MT', 'METROS', 'M', 'L', 'TIPO', 'II', 'III', 'I'];
  const words = s.split(/\s+/).filter(w => w.length > 0 && !stopWords.includes(w));
  return words.join(' ');
}

function calculateSimilarity(str1: string, str2: string) {
  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);
  const set1 = new Set(norm1.split(' '));
  const set2 = new Set(norm2.split(' '));
  
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return (intersection.size / union.size) * 100;
}

function bigramSimilarity(str1: string, str2: string) {
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
      bigrams1.delete(bg);
    }
  }
  const total = Math.max(s1.length - 1, s2.length - 1);
  return (matches / total) * 100;
}

async function run() {
  console.log(`🚀 Iniciando Sincronização Global de Imagens`);

  const { data: dbProducts, error } = await supabase.from('products').select('*');
  if (error) {
    console.error('❌ Erro ao buscar produtos do Supabase:', error);
    process.exit(1);
  }

  const reportsDir = path.join(ROOT_DIR, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const folders = fs.readdirSync(IMAGES_BASE_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  let globalUpdates = 0;
  let reportMd = `# Global Image Sync Report\n**Data:** ${new Date().toLocaleString('pt-BR')}\n\n`;

  for (const folder of folders) {
    const folderPath = path.join(IMAGES_BASE_DIR, folder);
    const files = fs.readdirSync(folderPath).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));
    
    if (files.length === 0) continue;

    const brandName = folder.replace('PRODUTOS_', '').replace(/-/g, ' ');
    const baseWebPath = `/images/products/${folder}/`;
    
    console.log(`\n📁 Processando pasta: ${folder} (Marca Inferida: ${brandName}, Imagens: ${files.length})`);

    // Match files to products
    const groupedFiles: Record<string, string[]> = {};
    files.forEach(f => {
      let base = f.replace(/\.[^/.]+$/, "");
      base = base.replace(/_(capa|foto[0-9]+|[0-9]+)$/i, "");
      base = base.replace(/ capa$/i, "");
      if (!groupedFiles[base]) groupedFiles[base] = [];
      groupedFiles[base].push(f);
    });

    const toUpdate = [];

    for (const baseFileName of Object.keys(groupedFiles)) {
      let bestMatch = null;
      let bestScore = 0;

      for (const p of dbProducts) {
        // Boost if brand matches folder brand
        const isBrandMatch = p.brand && p.brand.toLowerCase().includes(brandName.toLowerCase());
        const score1 = calculateSimilarity(baseFileName, p.name);
        const score2 = bigramSimilarity(baseFileName, p.name);
        let finalScore = Math.max(score1, score2);
        
        if (isBrandMatch && finalScore > 50) finalScore += 10; // Boost for same brand

        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestMatch = p;
        }
      }

      if (bestMatch && bestScore >= 75) {
        toUpdate.push({
          product: bestMatch,
          baseFileName,
          files: groupedFiles[baseFileName],
          score: bestScore,
          baseWebPath
        });
      }
    }

    reportMd += `## Pasta: ${folder}\n`;

    if (toUpdate.length > 0) {
      console.log(`💾 Aplicando ${toUpdate.length} atualizações para ${folder}...`);
      
      for (const match of toUpdate) {
        const p = match.product;
        const sortedFiles = match.files.sort((a, b) => {
          const sa = a.toLowerCase();
          const sb = b.toLowerCase();
          if (sa.includes('capa')) return -1;
          if (sb.includes('capa')) return 1;
          return sa.localeCompare(sb);
        });

        const newMainImage = match.baseWebPath + sortedFiles[0];
        const newImagesArray = sortedFiles.map(f => match.baseWebPath + f);

        let finalImage = newMainImage;
        let finalImages = Array.isArray(p.images) ? [...p.images] : [];
        const imagesSet = new Set(finalImages);
        newImagesArray.forEach(img => imagesSet.add(img));
        finalImages = Array.from(imagesSet).filter(img => img && !img.startsWith('blob:') && img !== 'null');

        const { error } = await supabase.from('products').update({ image: finalImage, images: finalImages }).eq('id', p.id);
        
        if (error) {
          console.error(`❌ Erro ao atualizar ${p.name}:`, error.message);
        } else {
          globalUpdates++;
          reportMd += `- ✅ **${p.name}** (${match.score.toFixed(1)}% match)\n`;
          reportMd += `  - Imagem principal: \`${finalImage}\`\n`;
        }
      }
    } else {
      console.log(`Nenhuma atualização encontrada para ${folder}.`);
      reportMd += `- Nenhuma atualização.\n`;
    }
  }

  reportMd = `**Total de Imagens Atualizadas:** ${globalUpdates}\n\n` + reportMd;
  fs.writeFileSync(path.join(reportsDir, 'global-image-sync-report.md'), reportMd, 'utf8');
  console.log(`\n🎉 Sincronização concluída com sucesso! Total de produtos atualizados: ${globalUpdates}`);
  console.log(`✅ Relatório gerado em: reports/global-image-sync-report.md`);
}

run();
