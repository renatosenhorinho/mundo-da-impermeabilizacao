import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

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

const BASE_IMAGES_DIR = path.join(ROOT_DIR, 'public', 'images', 'products', 'Produtos_por_marca');

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
  console.log(`🚀 Iniciando Sincronização de Marcas & Conversão WebP`);

  if (!fs.existsSync(BASE_IMAGES_DIR)) {
    console.error(`Pasta não encontrada: ${BASE_IMAGES_DIR}`);
    process.exit(1);
  }

  // 1. Fetch Supabase products
  const { data: dbProducts, error } = await supabase.from('products').select('*');
  if (error) {
    console.error('❌ Erro ao buscar produtos do Supabase:', error);
    process.exit(1);
  }
  console.log(`📦 Encontrados ${dbProducts.length} produtos no Supabase.`);

  const folders = fs.readdirSync(BASE_IMAGES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  const reportsDir = path.join(ROOT_DIR, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  let globalUpdates = 0;
  let reportMd = `# Produtos por Marca - Image Sync & WebP Report\n**Data:** ${new Date().toLocaleString('pt-BR')}\n\n`;

  for (const folder of folders) {
    const folderPath = path.join(BASE_IMAGES_DIR, folder);
    let brandName = folder.replace('PRODUTOS_', '').replace(/-/g, ' ');
    
    console.log(`\n📁 Processando pasta: ${folder} (Marca: ${brandName})`);
    reportMd += `## Marca: ${brandName}\n`;

    let allFiles = fs.readdirSync(folderPath).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));
    if (allFiles.length === 0) {
      console.log(`Nenhuma imagem encontrada em ${folder}.`);
      continue;
    }

    // 2. Converter para WebP e preparar lista final
    const processedFiles: string[] = [];
    
    for (const file of allFiles) {
      const ext = path.extname(file).toLowerCase();
      if (ext !== '.webp') {
        const baseName = path.basename(file, ext);
        const webpName = `${baseName}.webp`;
        const oldPath = path.join(folderPath, file);
        const newPath = path.join(folderPath, webpName);
        
        try {
          // Apenas converte se o webp já não existir
          if (!fs.existsSync(newPath)) {
            console.log(`  🔄 Convertendo ${file} -> ${webpName}`);
            await sharp(oldPath)
              .webp({ quality: 80, effort: 6 })
              .toFile(newPath);
          }
          // Remove a imagem original para manter o diretório limpo e evitar duplicidade
          fs.unlinkSync(oldPath);
          processedFiles.push(webpName);
        } catch (err: any) {
          console.error(`  ❌ Erro ao converter ${file}:`, err.message);
          processedFiles.push(file); // Mantém o original na lista se falhar
        }
      } else {
        processedFiles.push(file);
      }
    }

    // 3. Agrupar e fazer Match
    const groupedFiles: Record<string, string[]> = {};
    processedFiles.forEach(f => {
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
        
        if (isBrandMatch && finalScore > 50) finalScore += 15; // Strong boost for same brand

        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestMatch = p;
        }
      }

      if (bestMatch && bestScore >= 75) {
        const baseWebPath = `/images/products/Produtos_por_marca/${folder}/`;
        toUpdate.push({
          product: bestMatch,
          baseFileName,
          files: groupedFiles[baseFileName],
          score: bestScore,
          baseWebPath
        });
      } else {
        console.warn(`  ⚠️ Sem match confiável para: ${baseFileName} (Score: ${bestScore.toFixed(1)}%)`);
      }
    }

    // 4. Update Supabase
    if (toUpdate.length > 0) {
      console.log(`  💾 Aplicando ${toUpdate.length} atualizações...`);
      
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

        let finalImage = p.image;
        let finalImages = Array.isArray(p.images) ? [...p.images] : [];

        // Substituir sempre por essa nova imagem otimizada
        finalImage = newMainImage;
        const imagesSet = new Set(finalImages);
        newImagesArray.forEach(img => imagesSet.add(img));
        
        finalImages = Array.from(imagesSet).filter(img => img && !img.startsWith('blob:') && img !== 'null');

        const { error } = await supabase.from('products').update({ image: finalImage, images: finalImages }).eq('id', p.id);
        
        if (error) {
          console.error(`  ❌ Erro ao atualizar ${p.name}:`, error.message);
        } else {
          globalUpdates++;
          reportMd += `- ✅ **${p.name}** (${match.score.toFixed(1)}% match)\n`;
          reportMd += `  - Principal: \`${finalImage}\`\n`;
        }
      }
    } else {
      reportMd += `- Nenhuma atualização segura encontrada.\n`;
    }
  }

  reportMd = `**Total de Imagens Atualizadas:** ${globalUpdates}\n\n` + reportMd;
  fs.writeFileSync(path.join(reportsDir, 'sync-brand-images-report.md'), reportMd, 'utf8');
  console.log(`\n🎉 Sincronização concluída com sucesso! Total de produtos atualizados: ${globalUpdates}`);
  console.log(`✅ Relatório gerado em: reports/sync-brand-images-report.md`);
}

run();
