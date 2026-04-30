import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Header } from './components/ui/header-2';
import { initAnalytics } from './lib/analytics';

initAnalytics();

const ProductCatalog = lazy(() => import('./components/ui/product-catalog'));
const HeatmapOverlay = lazy(() => import('./components/ui/heatmap-overlay').then(m => ({ default: m.HeatmapOverlay })));

// Mount Product Catalog
const rootElement = document.getElementById('produtos-root');
if (rootElement) {
    createRoot(rootElement).render(
        <React.StrictMode>
            <Suspense fallback={
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse mb-8" />
                    <div className="h-12 w-full max-w-md bg-slate-200 rounded-xl animate-pulse mb-8" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-slate-200 rounded-2xl h-80 animate-pulse" />
                        ))}
                    </div>
                </div>
            }>
                <ProductCatalog />
            </Suspense>
        </React.StrictMode>
    );
}

// Mount Header
const headerContainer = document.getElementById('header-root');
if (headerContainer) {
    createRoot(headerContainer).render(
        <React.StrictMode>
            <Header />
        </React.StrictMode>
    );
}

// Inject Heatmap if requested by Admin
if (typeof window !== 'undefined' && sessionStorage.getItem('mdi_show_heatmap') === 'true') {
    const heatmapRoot = document.createElement('div');
    heatmapRoot.id = 'heatmap-root';
    document.body.appendChild(heatmapRoot);
    
    createRoot(heatmapRoot).render(
        <React.StrictMode>
            <Suspense fallback={null}>
                <HeatmapOverlay active={true} />
            </Suspense>
        </React.StrictMode>
    );
}
