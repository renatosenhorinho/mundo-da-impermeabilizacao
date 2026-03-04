import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import AboutSection1 from './components/ui/about-section-1';
import { QuemSomosSections } from './components/ui/quem-somos-sections';

const rootElement = document.getElementById('quem-somos-root');
if (rootElement) {
    createRoot(rootElement).render(
        <React.StrictMode>
            <AboutSection1 />
            <QuemSomosSections />
        </React.StrictMode>
    );
}
