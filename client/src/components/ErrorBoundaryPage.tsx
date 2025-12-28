import React, { Component, ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import DashboardLayout from './dashboard-layout';

interface Props {
  children: ReactNode;
}

/**
 * Error Boundary específico para páginas que usam DashboardLayout
 * 
 * Captura erros em páginas específicas e mantém o layout do dashboard
 * 
 * Uso:
 * <ErrorBoundaryPage>
 *   <YourPage />
 * </ErrorBoundaryPage>
 */
export class ErrorBoundaryPage extends Component<Props> {
  render() {
    return (
      <ErrorBoundary
        fallback={
          <DashboardLayout>
            <div className="max-w-7xl mx-auto p-8">
              <ErrorFallbackContent />
            </div>
          </DashboardLayout>
        }
      >
        {this.props.children}
      </ErrorBoundary>
    );
  }
}

function ErrorFallbackContent() {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-6">
        <svg
          className="w-16 h-16 text-destructive mx-auto"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-bold mb-2">Ops! Algo deu errado</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        Ocorreu um erro ao carregar esta página. Por favor, tente recarregar ou voltar ao dashboard.
      </p>
      <button
        onClick={handleReload}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Recarregar Página
      </button>
    </div>
  );
}

