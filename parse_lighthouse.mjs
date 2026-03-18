import fs from 'fs';
import path from 'path';

const files = [
    'final_home_desktop.json', 'final_home_mobile.json',
    'final_qs_desktop.json', 'final_qs_mobile.json',
    'final_ct_desktop.json', 'final_ct_mobile.json'
];

const results = {};

files.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const name = file.replace('.json', '');
        
        const a11yFailures = Object.values(data.audits)
            .filter(a => a.score !== null && a.score === 0 && 
                data.categories.accessibility.auditRefs.some(ref => ref.id === a.id))
            .map(a => ({id: a.id, title: a.title}));

        results[name] = {
            performance: Math.round(data.categories.performance.score * 100),
            accessibility: Math.round(data.categories.accessibility.score * 100),
            bestPractices: Math.round(data.categories['best-practices'].score * 100),
            seo: Math.round(data.categories.seo.score * 100),
            lcp: data.audits['largest-contentful-paint'].displayValue,
            cls: data.audits['cumulative-layout-shift'].displayValue,
            tbt: data.audits['total-blocking-time'].displayValue,
            a11yFailures: a11yFailures.length > 0 ? a11yFailures : 'NONE'
        };
    } else {
        results[file] = "File not found";
    }
});

console.log(JSON.stringify(results, null, 2));
