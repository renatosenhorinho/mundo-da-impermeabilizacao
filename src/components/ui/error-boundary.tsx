import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(error, { 
      component: this.props.name || 'Unknown',
      reactErrorInfo: errorInfo.componentStack 
    });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-slate-50 rounded-3xl border border-slate-200 text-center m-4">
          <span className="material-symbols-outlined text-red-400 text-6xl mb-4">error</span>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Ops! Algo deu errado.</h2>
          <p className="text-slate-500 font-medium max-w-md mb-6">
            Ocorreu um erro inesperado ao carregar esta seção. Nossa equipe já foi notificada.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/20"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
