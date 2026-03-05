import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import ContactPage from './components/ui/contact-page';
import { Header } from './components/ui/header-2';

const rootElement = document.getElementById('contact-root');
if (rootElement) {
    createRoot(rootElement).render(
        <React.StrictMode>
            <ContactPage />
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
