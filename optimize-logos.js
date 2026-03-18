import sharp from 'sharp';
import fs from 'fs';
import https from 'https';

const downloads = [
    { url: 'https://www.liblogo.com/img-logo/max/so4677sc9a-soprema-logo-soprema-logo-01-gridworx-wall-systems.png', dest: 'soprema_new.png' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Quartzolit_logo.png', dest: 'quartzolit_new.png' }
];

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': url.includes('liblogo') ? 'https://www.liblogo.com/' : 'https://commons.wikimedia.org/'
            }
        };
        https.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
                return;
            }
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function optimizeLogo(src, base) {
    console.log(`Optimizing ${src}...`);
    
    // Original WebP (max-res equivalent used in brands strip)
    await sharp(src)
        .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85, effort: 6 })
        .toFile(`public/Logos/${base}.webp`);
        
    // 300w version
    await sharp(src)
        .resize({ width: 300, height: 300, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85, effort: 6 })
        .toFile(`public/Logos/${base}-300w.webp`);
        
    // 150w version
    await sharp(src)
        .resize({ width: 150, height: 150, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85, effort: 6 })
        .toFile(`public/Logos/${base}-150w.webp`);
        
    console.log(`Finished ${base} optimization.`);
}

async function run() {
    for (const item of downloads) {
        console.log(`Downloading ${item.url}...`);
        try {
            await downloadFile(item.url, item.dest);
            await optimizeLogo(item.dest, item.dest.replace('_new.png', ''));
        } catch (error) {
            console.error(`Error processing ${item.url}:`, error.message);
        }
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
