import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Header } from './components/ui/header-2';

// Lazy load page-specific components for better performance
const ImageReveal = lazy(() => import('./components/ui/image-tiles'));
const SpecializedSolutions = lazy(() => import('./components/ui/specialized-solutions'));
const ContactPage = lazy(() => import('./components/ui/contact-page'));
const QuemSomosSections = lazy(() => import('./components/ui/quem-somos-sections'));

// Helper for mounting components with Suspense
const mountWithSuspense = (containerId: string, Component: React.ComponentType) => {
    const container = document.getElementById(containerId);
    if (container) {
        createRoot(container).render(
            <React.StrictMode>
                <Suspense fallback={<div className="min-h-screen bg-background-dark/5 animate-pulse" />}>
                    <Component />
                </Suspense>
            </React.StrictMode>
        );
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
        <ImageReveal
            leftImage="/Logos/leftimg.webp"
            middleImage="/Logos/rightimg.webp"
            rightImage="/Logos/midimg.webp"
        />
    );
    mountWithSuspense('image-reveal-root', ImageRevealWrapper);
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
