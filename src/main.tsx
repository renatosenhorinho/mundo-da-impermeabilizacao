import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import { Header } from './components/ui/header-2';
import { initAnalytics } from './lib/analytics';

initAnalytics();

// Lazy load page-specific components for better performance
const ImageReveal = lazy(() => import('./components/ui/image-tiles'));
const SpecializedSolutions = lazy(() => import('./components/ui/specialized-solutions'));
const ContactPage = lazy(() => import('./components/ui/contact-page'));
const QuemSomosSections = lazy(() => import('./components/ui/quem-somos-sections'));
const FeaturedProducts = lazy(() => import('./components/ui/featured-products'));
const HeatmapOverlay = lazy(() => import('./components/ui/heatmap-overlay').then(m => ({ default: m.HeatmapOverlay })));

// Helper for mounting components with Suspense - Deferred to idle time
const mountWithSuspense = (containerId: string, Component: React.ComponentType) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const mount = () => {
        createRoot(container).render(
            <React.StrictMode>
                <Suspense fallback={<div className="min-h-screen bg-background-dark/5 animate-pulse" />}>
                    <Component />
                </Suspense>
            </React.StrictMode>
        );
    };

    // Use requestIdleCallback with a timeout to ensure it eventually runs
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => mount(), { timeout: 2000 });
    } else {
        setTimeout(mount, 1);
    }
};

// Mount Header (All Pages) - Not lazy as it is critical above-the-fold
const headerContainer = document.getElementById('header-root');
if (headerContainer) {
    createRoot(headerContainer).render(
        <React.StrictMode>
            <Header />
        </React.StrictMode>
    );
}

// Conditional mounts
if (document.getElementById('image-reveal-root')) {
    const ImageRevealWrapper = () => (
        <React.Suspense fallback={<div className="h-[500px] animate-pulse bg-slate-50 rounded-2xl" />}>
            <ImageReveal
                leftImage="/Logos/leftimg.webp"
                middleImage="/Logos/rightimg.webp"
                rightImage="/Logos/midimg.webp"
            />
        </React.Suspense>
    );
    
    // Mount ImageReveal eagerly as it may be near the fold on desktop
    const container = document.getElementById('image-reveal-root');
    if (container) {
        createRoot(container).render(
            <React.StrictMode>
                <ImageRevealWrapper />
            </React.StrictMode>
        );
    }
}

if (document.getElementById('featured-products-root')) {
    const container = document.getElementById('featured-products-root');
    if (container) {
        createRoot(container).render(
            <React.StrictMode>
                <Suspense fallback={<div className="h-64 animate-pulse bg-slate-50" />}>
                    <BrowserRouter>
                        <FeaturedProducts />
                    </BrowserRouter>
                </Suspense>
            </React.StrictMode>
        );
    }
}

if (document.getElementById('specialized-solutions-root')) {
    mountWithSuspense('specialized-solutions-root', SpecializedSolutions);
}

if (document.getElementById('contact-root')) {
    mountWithSuspense('contact-root', ContactPage);
}

if (document.getElementById('quem-somos-root')) {
    mountWithSuspense('quem-somos-root', QuemSomosSections);
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
