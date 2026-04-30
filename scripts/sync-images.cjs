/**
 * sync-images.cjs
 * 
 * 1. Lê todos os arquivos reais presentes em public/images/products/
 * 2. Lê products.ts
 * 3. Faz match inteligente (nome -> categoria -> fallback) 
 * 4. Atualiza products.ts garantindo que a propriedade 'imagem' aponte para um arquivo real.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRODUCTS_PATH = path.join(ROOT, 'src/data/products.ts');
const IMG_ROOT = path.join(ROOT, 'public/images/products');

// 1. Mapear todas as imagens locais existentes
function getLocalImages(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      getLocalImages(path.join(dir, file), fileList);
    } else if (file.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      const fullPath = path.join(dir, file);
      // Salva o caminho relativo e informações para match
      fileList.push({
        fullPath,
        relPath: fullPath.replace(path.join(ROOT, 'public'), '').replace(/\\/g, '/'),
        filename: file.toLowerCase(),
        nameTokens: file.toLowerCase().replace(/\.(jpg|jpeg|png|webp)$/i, '').split(/[^a-z0-9]/).filter(Boolean),
        dirTokens: path.basename(path.dirname(fullPath)).toLowerCase().split(/[^a-z0-9]/).filter(Boolean)
      });
    }
  }
  return fileList;
}

const localImages = getLocalImages(IMG_ROOT);
console.log(`📦 Encontradas ${localImages.length} imagens locais.`);

// Helpers de normalização e match
function normalize(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim();
}

function calculateScore(tokensA, tokensB) {
  let score = 0;
  for (const t of tokensA) {
    if (tokensB.includes(t)) score++;
  }
  return score;
}

function findBestMatch(product) {
  const pTokens = normalize(product.nome).split(/\s+/).filter(Boolean);
  const pCatTokens = normalize(product.categoria).split(/\s+/).filter(Boolean);

  let bestMatch = null;
  let bestScore = -1;

  // 1. Tentar achar por similaridade de nome
  for (const img of localImages) {
    const score = calculateScore(pTokens, img.nameTokens);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = img;
    }
  }

  // Se o score for muito baixo (ex: < 2), tenta priorizar por categoria
  if (bestScore < 2) {
    let bestCatMatch = null;
    let bestCatScore = -1;
    for (const img of localImages) {
      // Score = matches com tokens de categoria + matches com token do nome
      const catScore = calculateScore(pCatTokens, img.dirTokens) * 2; // peso maior pra diretório
      const nameScore = calculateScore(pTokens, img.nameTokens);
      const totalScore = catScore + nameScore;
      if (catScore > 0 && totalScore > bestCatScore) {
        bestCatScore = totalScore;
        bestCatMatch = img;
      }
    }
    if (bestCatMatch) {
      return { img: bestCatMatch, type: 'fallback-category' };
    }
  }

  if (bestMatch && bestScore >= 1) {
    return { img: bestMatch, type: 'match-name' };
  }

  // Último fallback: pega a primeira imagem que achar se tudo falhar (evitar img quebrada)
  return { img: localImages[0], type: 'fallback-random' };
}

// 2. Processar products.ts
const content = fs.readFileSync(PRODUCTS_PATH, 'utf8');
const lines = content.split('\n');

let currentProduct = {};
const stats = { exact: 0, fallback: 0, failed: 0 };
let patchedLines = 0;

const resultLines = lines.map(line => {
  // Captura os dados do produto enquanto desce
  const nomeMatch = line.match(/^\s+nome:\s*'([^']+)'/);
  if (nomeMatch) currentProduct.nome = nomeMatch[1];
  
  const catMatch = line.match(/^\s+categoria:\s*'([^']+)'/);
  if (catMatch) currentProduct.categoria = catMatch[1];

  if (line.includes('imagem:')) {
    // Fazer o match pra achar a imagem ideal pra esse produto
    const matchResult = findBestMatch(currentProduct);

    if (matchResult && matchResult.img) {
      const newPath = matchResult.img.relPath;
      
      if (matchResult.type === 'match-name') stats.exact++;
      else stats.fallback++;

      // Checa a atual
      const currentImgMatch = line.match(/imagem:\s*'([^']+)'/);
      if (currentImgMatch && currentImgMatch[1] !== newPath) {
        patchedLines++;
        return line.replace(/imagem:\s*'[^']*'/, "imagem: '" + newPath + "'");
      }
      return line; // não mudou
    } else {
      stats.failed++;
      return line;
    }
  }
  return line;
});

// 3. Salvar
fs.writeFileSync(PRODUCTS_PATH, resultLines.join('\n'), 'utf8');

// Relatório
console.log('\n✅ SINCRONIZAÇÃO CONCLUÍDA');
console.log('─────────────────────────────────');
console.log(`✔️  Produtos atualizados (match via nome) : ${stats.exact}`);
console.log(`⚠️  Produtos com fallback (categoria/geral) : ${stats.fallback}`);
console.log(`❌  Produtos sem correspondência          : ${stats.failed}`);
console.log(`\n📝 Linhas efetivamente alteradas em products.ts: ${patchedLines}`);
