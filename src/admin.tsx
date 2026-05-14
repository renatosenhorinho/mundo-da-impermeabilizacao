import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import AdminDashboard from './components/ui/admin-dashboard';

import { ErrorBoundary } from './components/ui/error-boundary';

import { AuthProvider } from './lib/auth';
import { ProtectedRoute } from './components/ui/protected-route';

const container = document.getElementById('admin-root');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary name="AdminRoot">
        <AuthProvider>
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        </AuthProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
