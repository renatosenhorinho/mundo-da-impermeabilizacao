import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import ImageReveal from './components/ui/image-tiles';
import AuthorityStrip from './components/ui/authority-strip';
import { Header } from './components/ui/header-2';

// Mount Image Reveal
const imageContainer = document.getElementById('image-reveal-root');
if (imageContainer) {
    createRoot(imageContainer).render(
        <React.StrictMode>
            <ImageReveal
                leftImage="/Logos/leftimg.png"
                middleImage="/Logos/rightimg.png"
                rightImage="/Logos/midimg.png"
            />
        </React.StrictMode>
    );
}

// Mount Specialized Solutions
import SpecializedSolutions from './components/ui/specialized-solutions';
const specializedSolutionsContainer = document.getElementById('specialized-solutions-root');
if (specializedSolutionsContainer) {
    createRoot(specializedSolutionsContainer).render(
        <React.StrictMode>
            <SpecializedSolutions />
        </React.StrictMode>
    );
}

// Mount Authority Strip
const authorityContainer = document.getElementById('authority-strip-root');
if (authorityContainer) {
    createRoot(authorityContainer).render(
        <React.StrictMode>
            <AuthorityStrip />
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
