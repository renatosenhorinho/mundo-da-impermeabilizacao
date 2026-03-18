import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Header } from './components/ui/header-2';

const ContactPage = lazy(() => import('./components/ui/contact-page'));

const rootElement = document.getElementById('contact-root');
if (rootElement) {
    createRoot(rootElement).render(
        <React.StrictMode>
            <Suspense fallback={<div className="min-h-screen bg-background-light animate-pulse" />}>
                <ContactPage />
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
