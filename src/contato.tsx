import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import ContactPage from './components/ui/contact-page';

const rootElement = document.getElementById('contact-root');
if (rootElement) {
    createRoot(rootElement).render(
        <React.StrictMode>
            <ContactPage />
        </React.StrictMode>
    );
}
