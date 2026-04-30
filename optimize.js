import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.resolve('public');

const jobs = [
    {
        pattern: /WhatsApp\.webp$/,
        sizes: [48, 64, 96],
        dir: 'Logos'
    },
    {
        pattern: /logo-main\.webp$/,
        sizes: [180, 360],
        dir: 'Logos'
    },
    {
        pattern: /(left|mid|right)img\.webp$/,
        sizes: [250, 500],
        dir: 'Logos'
    },
    {
        pattern: /(viapol|soprema|quartzolit|dryko|qborg|vedacit)\.webp$/,
        sizes: [150, 300],
        dir: 'Logos'
    },
    {
        pattern: /\.webp$/,
        sizes: [320, 404, 808],
        dir: 'images/specialized'
    }
];

async function optimizeImages() {
    console.log('Starting image optimization...');
    
    for (const job of jobs) {
        const fullDir = path.join(PUBLIC_DIR, job.dir);
        if (!fs.existsSync(fullDir)) continue;
        
        const files = fs.readdirSync(fullDir).filter(f => job.pattern.test(f) && !f.match(/-\d+w\.webp$/));
        
        for (const file of files) {
            const inputPath = path.join(fullDir, file);
            const fileNameWithoutExt = path.basename(file, '.webp');
            
            console.log(`Processing ${file}...`);
            const inputBuffer = fs.readFileSync(inputPath);
            
            // Generate sized versions
            for (const size of job.sizes) {
                const outputPath = path.join(fullDir, `${fileNameWithoutExt}-${size}w.webp`);
                const buffer = await sharp(inputBuffer)
                    .resize({ width: size, withoutEnlargement: true })
                    .webp({ quality: 75, effort: 6 })
                    .toBuffer();
                fs.writeFileSync(outputPath, buffer);
                console.log(`  -> Created ${outputPath}`);
            }
            
            // Overwrite original with optimally sized version
            const maxSize = job.sizes[job.sizes.length - 1];
            const fallbackBuffer = await sharp(inputBuffer)
                .resize({ width: maxSize, withoutEnlargement: true })
                .webp({ quality: 75, effort: 6 })
                .toBuffer();
            
            fs.writeFileSync(inputPath, fallbackBuffer);
            console.log(`  -> Overwrote original ${file} with optimal fallback`);
        }
    }
    
    // Also optimize hero-bg.webp
    const heroBg = path.join(PUBLIC_DIR, 'hero-bg.webp');
    if (fs.existsSync(heroBg)) {
        console.log('Optimizing hero-bg...');
        const heroBuffer = fs.readFileSync(heroBg);
        
        const fallbackBuffer = await sharp(heroBuffer)
            .resize({ width: 1920, withoutEnlargement: true })
            .webp({ quality: 75, effort: 6 })
            .toBuffer();
        fs.writeFileSync(heroBg, fallbackBuffer);
        
        // Mobile version
        const mobileBuffer = await sharp(heroBuffer)
            .resize({ width: 800, withoutEnlargement: true })
            .webp({ quality: 75, effort: 6 })
            .toBuffer();
        fs.writeFileSync(path.join(PUBLIC_DIR, 'hero-bg-800w.webp'), mobileBuffer);
    }
    
    console.log('Done.');
}

optimizeImages().catch(console.error);
