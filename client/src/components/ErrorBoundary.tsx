import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { useLocation } from 'wouter';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary Component
 * 
 * Captura erros JavaScript em qualquer lugar na árvore de componentes filhos,
 * registra esses erros e exibe uma UI de fallback em vez da árvore de componentes
 * que quebrou.
 * 
 * Uso:
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Atualiza o state para que a próxima renderização mostre a UI de fallback
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Você também pode registrar o erro em um serviço de relatório de erros
    console.error('ErrorBoundary capturou um erro:', error, errorInfo);
    
    // Aqui você pode enviar o erro para um serviço de monitoramento
    // Exemplo: Sentry.captureException(error, { contexts: { react: errorInfo } });
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Se houver um fallback customizado, use-o
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI de fallback padrão
      return <ErrorFallback 
        error={this.state.error} 
        errorInfo={this.state.errorInfo}
        onReset={this.handleReset}
      />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  onReset: () => void;
}

function ErrorFallback({ error, errorInfo, onReset }: ErrorFallbackProps) {
  const [, setLocation] = useLocation();
  const isDevelopment = import.meta.env.DEV;

  const handleGoHome = () => {
    setLocation('/dashboard');
    onReset();
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <CardTitle className="text-2xl">Ops! Algo deu errado</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-muted-foreground mb-4">
              Ocorreu um erro inesperado. Por favor, tente recarregar a página ou voltar ao dashboard.
            </p>

            {isDevelopment && error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-destructive">Erro:</p>
                <p className="text-sm font-mono text-destructive">{error.message}</p>
                
                {error.stack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      Ver stack trace
                    </summary>
                    <pre className="mt-2 text-xs overflow-auto bg-background p-2 rounded border">
                      {error.stack}
                    </pre>
                  </details>
                )}

                {errorInfo && errorInfo.componentStack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      Ver componente stack
                    </summary>
                    <pre className="mt-2 text-xs overflow-auto bg-background p-2 rounded border">
                      {errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleReload} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              Recarregar Página
            </Button>
            <Button onClick={handleGoHome} variant="outline">
              <Home className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
            <Button onClick={onReset} variant="ghost">
              Tentar Novamente
            </Button>
          </div>

          {!isDevelopment && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Se o problema persistir, entre em contato com o suporte técnico.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Hook para usar error boundary programaticamente
 * 
 * Exemplo:
 * const { throwError } = useErrorHandler();
 * if (someCondition) {
 *   throwError(new Error('Something went wrong'));
 * }
 */
export function useErrorHandler() {
  return {
    throwError: (error: Error) => {
      throw error;
    },
  };
}

