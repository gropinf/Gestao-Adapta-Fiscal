/**
 * Sistema de Logging Estruturado
 * 
 * Níveis de log:
 * - debug: Informações detalhadas para desenvolvimento
 * - info: Informações gerais sobre o funcionamento do sistema
 * - warn: Avisos sobre situações anormais mas não críticas
 * - error: Erros que precisam de atenção
 * 
 * Em produção (NODE_ENV=production):
 * - Apenas logs info, warn e error são exibidos
 * - Logs são formatados como JSON para facilitar parsing
 * 
 * Integração com Sentry:
 * - Para habilitar, instale @sentry/node e configure SENTRY_DSN
 * - Logs de erro são automaticamente enviados para Sentry
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';
  private sentry: any = null;
  private sentryInitialized = false;

  constructor() {
    // Inicializa Sentry se disponível (async, não bloqueia)
    this.initializeSentry().catch(() => {
      // Falha silenciosa na inicialização
    });
  }

  private async initializeSentry() {
    // Verifica se Sentry está disponível e configurado
    if (process.env.SENTRY_DSN && !this.sentryInitialized) {
      try {
        // Dynamic import - @sentry/node usa named exports
        const Sentry = await import('@sentry/node');
        
        // Verificar se init existe
        if (Sentry && typeof Sentry.init === 'function') {
          Sentry.init({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
            tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || (process.env.NODE_ENV === 'production' ? '0.1' : '1.0')),
            beforeSend(event) {
              // Não enviar em desenvolvimento a menos que explicitamente configurado
              if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_ENABLE_DEV) {
                return null;
              }
              return event;
            },
          });
          
          this.sentry = Sentry;
          this.sentryInitialized = true;
          
          // Usar console.log aqui porque logger ainda pode não estar pronto
          if (this.isDevelopment) {
            console.log('✅ Sentry inicializado com sucesso');
          }
        } else {
          throw new Error('Sentry.init não encontrado');
        }
      } catch (error) {
        // @sentry/node não está instalado ou erro na inicialização
        if (this.isDevelopment) {
          console.warn('⚠️ Erro ao inicializar Sentry:', error instanceof Error ? error.message : String(error));
          if (error instanceof Error && error.message.includes('Cannot find module')) {
            console.warn('   Execute: npm install @sentry/node');
          }
        }
      }
    }
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      };
    }

    return entry;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    // Em produção, não exibir logs de debug
    if (this.isProduction && level === 'debug') {
      return;
    }

    const entry = this.formatMessage(level, message, context, error);

    if (this.isProduction) {
      // Em produção, usar JSON formatado para facilitar parsing
      console.log(JSON.stringify(entry));
    } else {
      // Em desenvolvimento, usar formato legível
      const prefix = this.getPrefix(level);
      const contextStr = entry.context ? ` ${JSON.stringify(entry.context, null, 2)}` : '';
      const errorStr = entry.error ? `\n${entry.error.stack || entry.error.message}` : '';
      
      console.log(`${prefix} ${message}${contextStr}${errorStr}`);
    }
  }

  private getPrefix(level: LogLevel): string {
    const prefixes = {
      debug: '🔍 [DEBUG]',
      info: 'ℹ️  [INFO]',
      warn: '⚠️  [WARN]',
      error: '❌ [ERROR]',
    };
    return prefixes[level];
  }

  /**
   * Log de debug - informações detalhadas para desenvolvimento
   * Não aparece em produção
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  /**
   * Log de informação - eventos normais do sistema
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * Log de aviso - situações anormais mas não críticas
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /**
   * Log de erro - erros que precisam de atenção
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, context, error);
    
    // Enviar para Sentry se disponível (async para não bloquear)
    if (this.sentryInitialized && this.sentry && error) {
      // Não bloquear o fluxo principal
      setImmediate(() => {
        try {
          const Sentry = this.sentry;
          if (Sentry && typeof Sentry.withScope === 'function' && typeof Sentry.captureException === 'function') {
            Sentry.withScope((scope: any) => {
              // Adicionar contexto
              if (context) {
                scope.setContext('additional_data', context);
              }
              // Adicionar mensagem como tag
              scope.setTag('error_message', message);
              scope.setLevel('error');
              // Capturar exceção
              Sentry.captureException(error);
            });
          }
        } catch (err) {
          // Falha silenciosa se Sentry não estiver disponível
          if (this.isDevelopment) {
            console.warn('⚠️ Erro ao enviar para Sentry:', err);
          }
        }
      });
    }
  }

  /**
   * Helper para logar requisições HTTP
   */
  http(method: string, path: string, statusCode: number, duration?: number, context?: Record<string, any>): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const message = `${method} ${path} ${statusCode}`;
    const httpContext = {
      method,
      path,
      statusCode,
      duration: duration ? `${duration}ms` : undefined,
      ...context,
    };
    this.log(level, message, httpContext);
  }
}

// Exportar instância singleton
export const logger = new Logger();

// Exportar classe para testes
export { Logger };

