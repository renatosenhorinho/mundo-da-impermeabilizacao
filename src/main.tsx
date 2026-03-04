import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import ImageReveal from './components/ui/image-tiles';
import AuthorityStrip from './components/ui/authority-strip';

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

// Mount Authority Strip
const authorityContainer = document.getElementById('authority-strip-root');
if (authorityContainer) {
    createRoot(authorityContainer).render(
        <React.StrictMode>
            <AuthorityStrip />
        </React.StrictMode>
    );
}
