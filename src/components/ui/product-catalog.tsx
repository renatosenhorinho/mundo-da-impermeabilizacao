import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const CatalogGrid = React.lazy(() => import('./catalog-grid'));
const ProductDetail = React.lazy(() => import('./product-detail'));

const ProductCatalog = () => {
  return (
    <BrowserRouter>
      <React.Suspense
        fallback={
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse mb-8" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-slate-200 rounded-2xl h-80 animate-pulse" />
              ))}
            </div>
          </div>
        }
      >
        <Routes>
          <Route path="/produtos" element={<CatalogGrid />} />
          <Route path="/produtos/categoria/:categorySlug" element={<CatalogGrid />} />
          <Route path="/produto/:slug" element={<ProductDetail />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
};

export default ProductCatalog;
