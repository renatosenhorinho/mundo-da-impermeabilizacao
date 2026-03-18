import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Header } from './components/ui/header-2';

const AboutSection1 = lazy(() => import('./components/ui/about-section-1'));
const QuemSomosSections = lazy(() => import('./components/ui/quem-somos-sections'));

const rootElement = document.getElementById('quem-somos-root');
if (rootElement) {
    createRoot(rootElement).render(
        <React.StrictMode>
            <Suspense fallback={<div className="min-h-screen bg-background-light animate-pulse" />}>
                <AboutSection1 />
                <QuemSomosSections />
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
