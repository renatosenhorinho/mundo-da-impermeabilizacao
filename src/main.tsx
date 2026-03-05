import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Header } from './components/ui/header-2';

import ImageReveal from './components/ui/image-tiles';
import SpecializedSolutions from './components/ui/specialized-solutions';
import ContactPage from './components/ui/contact-page';
import QuemSomosSections from './components/ui/quem-somos-sections';

// Mount Image Reveal (Index Only)
const imageContainer = document.getElementById('image-reveal-root');
if (imageContainer) {
    createRoot(imageContainer).render(
        <React.StrictMode>
            <ImageReveal
                leftImage="/Logos/leftimg.webp"
                middleImage="/Logos/rightimg.webp"
                rightImage="/Logos/midimg.webp"
            />
        </React.StrictMode>
    );
}

// Mount Specialized Solutions (Index Only)
const specializedSolutionsContainer = document.getElementById('specialized-solutions-root');
if (specializedSolutionsContainer) {
    createRoot(specializedSolutionsContainer).render(
        <React.StrictMode>
            <SpecializedSolutions />
        </React.StrictMode>
    );
}

// Mount Contact Page (Contato Only)
const contactContainer = document.getElementById('contact-root');
if (contactContainer) {
    createRoot(contactContainer).render(
        <React.StrictMode>
            <ContactPage />
        </React.StrictMode>
    );
}

// Mount Quem Somos Sections (Quem Somos Only)
const quemSomosContainer = document.getElementById('quem-somos-root');
if (quemSomosContainer) {
    createRoot(quemSomosContainer).render(
        <React.StrictMode>
            <QuemSomosSections />
        </React.StrictMode>
    );
}

// Mount Header (All Pages)
const headerContainer = document.getElementById('header-root');
if (headerContainer) {
    createRoot(headerContainer).render(
        <React.StrictMode>
            <Header />
        </React.StrictMode>
    );
}
