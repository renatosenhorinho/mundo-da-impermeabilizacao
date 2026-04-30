import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CONFIGURATION ──────────────────────────────────────────────────────────

const BASE_DIR = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(__dirname, 'final-package', 'images', 'products');
const TARGET_DIR = path.join(BASE_DIR, 'public', 'images', 'products');
const SOURCE_JSON = path.join(__dirname, 'final-package', 'product-images.json');
const TARGET_JSON = path.join(BASE_DIR, 'src', 'data', 'product-images.json');
const PRODUCTS_TS = path.join(BASE_DIR, 'src', 'data', 'products.ts');

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_DIR = path.join(BASE_DIR, 'public', 'images', `products_backup_${TIMESTAMP}`);
const BACKUP_JSON = path.join(BASE_DIR, 'src', 'data', `product-images_backup_${TIMESTAMP}.json`);

const PROTECTED_FILES = ['placeholder.webp', 'placeholder.svg'];

// ─── HELPERS ────────────────────────────────────────────────────────────────

function copyRecursiveSync(src, dest, stats) {
    if (!fs.existsSync(src)) return;
    const exists = fs.existsSync(dest);
    const stats_src = fs.statSync(src);
    const isDirectory = stats_src.isDirectory();

    if (isDirectory) {
        if (!exists) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(child => {
            copyRecursiveSync(path.join(src, child), path.join(dest, child), stats);
        });
    } else {
        const filename = path.basename(src);
        if (PROTECTED_FILES.includes(filename)) {
            console.log(`  🛡️ Protegido: ${filename} (não sobrescrito)`);
            stats.protected++;
            return;
        }

        if (exists) {
            stats.overwritten++;
        } else {
            stats.copied++;
        }
        fs.copyFileSync(src, dest);
    }
}

function scanProductsTS() {
    // This is a naive regex-based scan since the file is huge and we want to identify active product slugs
    const content = fs.readFileSync(PRODUCTS_TS, 'utf-8');
    const products = [];
    
    // Pattern to catch slugs in rawProducts array
    const slugRegex = /slug:\s*generateSlug\(['"](.+?)['"]\)/g;
    let match;
    while ((match = slugRegex.exec(content)) !== null) {
        products.push(generateSlug(match[1]));
    }
    
    // Also try to catch simple string slugs
    const simpleSlugRegex = /slug:\s*['"](.+?)['"]/g;
    while ((match = simpleSlugRegex.exec(content)) !== null) {
        if (!products.includes(match[1])) products.push(match[1]);
    }

    return products;
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

function backupRecursiveSync(src, dest) {
    if (!fs.existsSync(src)) return;
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(child => {
            backupRecursiveSync(path.join(src, child), path.join(dest, child));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

async function main() {
    console.log('🚀 Iniciando Integração Final Segura\n');

    const stats = {
        copied: 0,
        overwritten: 0,
        protected: 0,
    };

    try {
        // 1. Backups
        console.log('📦 Criando backups...');
        if (fs.existsSync(TARGET_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
            backupRecursiveSync(TARGET_DIR, BACKUP_DIR);
            console.log(`  ✅ Backup de imagens: ${BACKUP_DIR}`);
        }
        if (fs.existsSync(TARGET_JSON)) {
            fs.copyFileSync(TARGET_JSON, BACKUP_JSON);
            console.log(`  ✅ Backup de JSON: ${BACKUP_JSON}`);
        }

        // 2. Integração Seletiva
        console.log('\n🔄 Integrando arquivos...');
        if (!fs.existsSync(SOURCE_DIR)) {
            console.error('❌ Erro: Pasta fonte não encontrada.');
            process.exit(1);
        }
        copyRecursiveSync(SOURCE_DIR, TARGET_DIR, stats);

        // 3. Update JSON
        console.log('\n📝 Atualizando product-images.json...');
        if (fs.existsSync(SOURCE_JSON)) {
            fs.copyFileSync(SOURCE_JSON, TARGET_JSON);
            console.log('  ✅ Metadata atualizado.');
        }

        // 4. Relatório Final
        console.log('\n📊 Gerando relatório de cobertura...');
        
        const finalMetadata = JSON.parse(fs.readFileSync(TARGET_JSON, 'utf-8'));
        const allSlugs = Object.keys(finalMetadata);
        
        const productsWithRealImages = allSlugs.filter(slug => !slug.includes('-400w') && !slug.includes('-800w')).length;
        
        const categories = {};
        allSlugs.forEach(slug => {
            const paths = finalMetadata[slug];
            if (paths && paths.length > 0) {
                const catMatch = paths[0].match(/\/images\/products\/(.+?)\//);
                if (catMatch) {
                    const cat = catMatch[1];
                    if (!categories[cat]) categories[cat] = 0;
                    categories[cat]++;
                }
            }
        });

        console.log('\n🏁 Integração Concluída!');
        console.log('----------------------------------------');
        console.log(`📂 Backups realizados em:`);
        console.log(`   - ${BACKUP_DIR}`);
        console.log(`   - ${BACKUP_JSON}`);
        console.log(`\n📄 Estatísticas de Arquivos:`);
        console.log(`   - Arquivos novos copiados: ${stats.copied}`);
        console.log(`   - Arquivos sobrescritos:   ${stats.overwritten}`);
        console.log(`   - Arquivos protegidos:     ${stats.protected}`);
        console.log(`\n📦 Cobertura de Produtos:`);
        console.log(`   - Total de produtos com imagem real: ${productsWithRealImages}`);
        
        console.log(`\n📁 Cobertura por Categoria (Skus com imagem):`);
        Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
            console.log(`   - ${cat.padEnd(30)}: ${count} produtos`);
        });
        console.log('----------------------------------------');

    } catch (error) {
        console.error('\n💥 Erro inesperado:', error);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('\n💥 Erro fatal:', err);
    process.exit(1);
});
