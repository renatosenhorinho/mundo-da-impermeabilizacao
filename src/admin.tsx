import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import AdminDashboard from './components/ui/admin-dashboard';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#0E1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ background: '#161B22', border: '1px solid #7f1d1d', padding: '2rem', borderRadius: '1rem', maxWidth: 480, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ color: '#f87171', fontSize: '1.25rem', fontWeight: 900, marginBottom: 8 }}>Erro no Painel Administrativo</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 16 }}>{this.state.error || 'Ocorreu um erro inesperado.'}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: '' }); }}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById('admin-root');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary>
        <AdminDashboard />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
