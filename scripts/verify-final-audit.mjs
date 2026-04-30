import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CONFIGURATION ──────────────────────────────────────────────────────────

const BASE_DIR = path.resolve(__dirname, '..');
const PRODUCTS_TS = path.join(BASE_DIR, 'src', 'data', 'products.ts');
const IMAGES_JSON = path.join(BASE_DIR, 'src', 'data', 'product-images.json');
const PUBLIC_DIR = path.join(BASE_DIR, 'public');

// ─── HELPERS ────────────────────────────────────────────────────────────────

function extractProductsFromTS(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Expressão regular para capturar blocos de produtos individuais
    // Vamos focar no conteúdo entre [ e ]; da variável rawProducts
    const rawProductsMatch = content.match(/const rawProducts: Product\[\] = \[([\s\S]+?)\];/);
    if (!rawProductsMatch) return [];

    const productsBlock = rawProductsMatch[1];
    
    // Dividir os produtos pelo fechamento de objeto },
    const productEntries = productsBlock.split(/\},?\s*\{/);
    
    const activeProducts = [];
    
    productEntries.forEach(entry => {
        // Extrair slug e status ativo
        const slugMatch = entry.match(/slug:\s*(?:generateSlug\(['"](.+?)['"]\)|['"](.+?)['"])/);
        const ativoMatch = entry.match(/ativo:\s*(true|false)/);
        const catMatch = entry.match(/categoria:\s*['"](.+?)['"]/);
        const nameMatch = entry.match(/nome:\s*['"](.+?)['"]/);

        if (slugMatch) {
            const rawSlug = slugMatch[1] || slugMatch[2];
            // Se usou generateSlug(), normalizamos
            const slug = slugMatch[0].includes('generateSlug') ? generateSlug(rawSlug) : rawSlug;
            const isAtivo = ativoMatch ? ativoMatch[1] === 'true' : true; // default true se não achar
            const category = catMatch ? catMatch[1] : 'unknown';
            const nome = nameMatch ? nameMatch[1] : slug;

            if (isAtivo) {
                activeProducts.push({ slug, category, nome });
            }
        }
    });

    return activeProducts;
}

function generateSlug(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('🔍 Iniciando Auditoria Real de Integridade do Catálogo\n');

    // 1. Carregar Dados
    if (!fs.existsSync(PRODUCTS_TS)) {
        console.error('❌ ERRO: products.ts não encontrado.');
        process.exit(1);
    }
    if (!fs.existsSync(IMAGES_JSON)) {
        console.error('❌ ERRO: product-images.json não encontrado.');
        process.exit(1);
    }

    const activeProducts = extractProductsFromTS(PRODUCTS_TS);
    const jsonMetadata = JSON.parse(fs.readFileSync(IMAGES_JSON, 'utf-8'));
    
    // 2. Processar Slugs
    const activeSlugs = new Set(activeProducts.map(p => p.slug));
    const jsonSlugs = new Set(Object.keys(jsonMetadata).filter(s => !s.includes('-400w') && !s.includes('-800w')));

    // 3. Cruzamento de Dados
    const report = {
        totalActive: activeProducts.length,
        withRealImages: 0,
        withPlaceholder: 0,
        orphansInJson: [], // Slugs no JSON que não estão ativos no TS
        missingInJson: [], // Slugs ativos no TS que não estão no JSON
        brokenPaths: [],  // Slugs com links no JSON mas arquivos inexistentes
        categoryCoverage: {},
        errors: []
    };

    // Inicializar categorias do TS
    activeProducts.forEach(p => {
        if (!report.categoryCoverage[p.category]) {
            report.categoryCoverage[p.category] = { total: 0, withImage: 0 };
        }
        report.categoryCoverage[p.category].total++;
    });

    // Validar cada produto ativo
    activeProducts.forEach(product => {
        const slug = product.slug;
        const images = jsonMetadata[slug];

        if (!images || images.length === 0) {
            report.withPlaceholder++;
            report.missingInJson.push({ slug, nome: product.nome });
        } else {
            // Verificar arquivos físicos
            let missingFiles = [];
            images.forEach(imgPath => {
                const fullPath = path.join(PUBLIC_DIR, imgPath);
                if (!fs.existsSync(fullPath)) {
                    missingFiles.push(imgPath);
                }
            });

            if (missingFiles.length > 0) {
                report.brokenPaths.push({ slug, missing: missingFiles });
                report.withPlaceholder++; // Considerado placeholder se falhar físico
                report.errors.push(`[404] Slug "${slug}" aponta para arquivos inexistentes: ${missingFiles.join(', ')}`);
            } else {
                report.withRealImages++;
                report.categoryCoverage[product.category].withImage++;
                
                // Checar consistência de categoria no path
                const firstImg = images[0];
                if (!firstImg.includes(product.category)) {
                   report.errors.push(`[CAT_MISMATCH] Slug "${slug}" (categoria ${product.category}) usa imagem no caminho: ${firstImg}`);
                }
            }
        }
    });

    // Identificar órfãos no JSON
    jsonSlugs.forEach(slug => {
        if (!activeSlugs.has(slug)) {
            report.orphansInJson.push(slug);
        }
    });

    // 4. Exibição do Relatório
    console.log('----------------------------------------');
    console.log('📊 RESUMO DA AUDITORIA');
    console.log(`- Total de produtos ativos (TS):    ${report.totalActive}`);
    console.log(`- Total com imagem real:            ${report.withRealImages}`);
    console.log(`- Total com placeholder:            ${report.withPlaceholder}`);
    console.log('----------------------------------------');

    console.log('\n📁 COBERTURA POR CATEGORIA:');
    Object.entries(report.categoryCoverage).sort((a, b) => b[1].withImage - a[1].withImage).forEach(([cat, stats]) => {
        const pct = ((stats.withImage / stats.total) * 100).toFixed(1);
        console.log(`  - ${cat.padEnd(30)}: ${stats.withImage}/${stats.total} (${pct}%)`);
    });

    if (report.missingInJson.length > 0) {
        console.log(`\n⚠️ FALTANTES NO JSON (${report.missingInJson.length}):`);
        report.missingInJson.slice(0, 10).forEach(m => console.log(`  - ${m.slug} (${m.nome})`));
        if (report.missingInJson.length > 10) console.log(`    ... e mais ${report.missingInJson.length - 10}`);
    }

    if (report.orphansInJson.length > 0) {
        console.log(`\n🧹 ÓRFÃOS NO JSON (No JSON mas não ativos no TS - ${report.orphansInJson.length}):`);
        report.orphansInJson.slice(0, 10).forEach(o => console.log(`  - ${o}`));
        if (report.orphansInJson.length > 10) console.log(`    ... e mais ${report.orphansInJson.length - 10}`);
    }

    if (report.errors.length > 0) {
        console.log(`\n💥 ERROS DETECTADOS (${report.errors.length}):`);
        report.errors.slice(0, 15).forEach(e => console.log(`  - ${e}`));
        if (report.errors.length > 15) console.log(`    ... e mais ${report.errors.length - 15}`);
    }

    console.log('\n----------------------------------------');
    console.log('🏁 Auditoria finalizada.');
}

main().catch(err => {
    console.error('\n💥 Erro inesperado na auditoria:', err);
    process.exit(1);
});
