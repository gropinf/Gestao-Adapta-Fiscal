import { Socket } from 'net';
import * as tls from 'tls';

interface TestResult {
  success: boolean;
  message: string;
  details?: {
    host: string;
    port: number;
    ssl: boolean;
    responseTime: number;
    serverGreeting?: string;
  };
}

/**
 * Testa conexão com servidor IMAP
 * @param host - Hostname do servidor IMAP
 * @param port - Porta do servidor IMAP
 * @param ssl - Se deve usar SSL/TLS
 * @param timeout - Timeout em ms (padrão: 10000)
 */
export async function testImapConnection(
  host: string,
  port: number,
  ssl: boolean,
  timeout: number = 10000
): Promise<TestResult> {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    let socket: Socket | tls.TLSSocket;
    let timeoutId: NodeJS.Timeout;
    let connected = false;
    let serverGreeting = '';

    // Cleanup function
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (socket) {
        socket.removeAllListeners();
        socket.destroy();
      }
    };

    // Timeout handler
    timeoutId = setTimeout(() => {
      cleanup();
      resolve({
        success: false,
        message: `Timeout: Não foi possível conectar ao servidor em ${timeout/1000} segundos`,
        details: {
          host,
          port,
          ssl,
          responseTime: Date.now() - startTime,
        },
      });
    }, timeout);

    // Handle data from server
    const handleData = (data: Buffer) => {
      const response = data.toString().trim();
      serverGreeting = response;
      
      // IMAP servers typically respond with "* OK" on successful connection
      if (response.startsWith('* OK')) {
        connected = true;
        cleanup();
        
        resolve({
          success: true,
          message: 'Conexão IMAP estabelecida com sucesso!',
          details: {
            host,
            port,
            ssl,
            responseTime: Date.now() - startTime,
            serverGreeting: response,
          },
        });
      } else if (response.includes('OK')) {
        // Some servers might have different OK format
        connected = true;
        cleanup();
        
        resolve({
          success: true,
          message: 'Conexão estabelecida (formato de resposta alternativo)',
          details: {
            host,
            port,
            ssl,
            responseTime: Date.now() - startTime,
            serverGreeting: response,
          },
        });
      }
    };

    // Handle errors
    const handleError = (error: Error) => {
      cleanup();
      
      let errorMessage = 'Erro ao conectar ao servidor IMAP';
      let hint = '';
      
      if (error.message.includes('ENOTFOUND')) {
        errorMessage = `Servidor não encontrado: ${host}`;
        if (host.includes('smtp')) {
          hint = '⚠️ ATENÇÃO: Você está usando um servidor SMTP! Para IMAP use: imap.gmail.com (porta 993)';
        }
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = `Conexão recusada pelo servidor (porta ${port})`;
        if (port === 587 || port === 25 || port === 465) {
          hint = '⚠️ Esta é uma porta SMTP (envio)! Para IMAP use porta 993 (SSL) ou 143 (sem SSL)';
        }
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Timeout: Servidor não respondeu';
      } else if (error.message.includes('ECONNRESET')) {
        errorMessage = 'Conexão interrompida pelo servidor';
      } else if (error.message.includes('wrong version number') || error.message.includes('SSL routines')) {
        errorMessage = 'Erro SSL: Configuração incorreta de SSL/TLS';
        if (port === 587) {
          hint = '⚠️ A porta 587 é SMTP com STARTTLS! Para IMAP use: porta 993 com SSL OU porta 143 sem SSL';
        } else if (port === 143) {
          hint = '💡 A porta 143 não usa SSL. Tente desativar SSL ou use porta 993 com SSL ativado';
        } else {
          hint = '💡 Tente alternar a opção SSL (ativar ou desativar) ou verificar a porta';
        }
      } else {
        errorMessage = `Erro: ${error.message}`;
      }
      
      // Check common SMTP mistakes
      if (host.toLowerCase().includes('smtp')) {
        hint = '🚫 SERVIDOR SMTP DETECTADO! Troque para IMAP:\n' +
               '   Gmail: imap.gmail.com (porta 993 com SSL)\n' +
               '   Outlook: outlook.office365.com (porta 993 com SSL)';
      }

      resolve({
        success: false,
        message: errorMessage + (hint ? '\n\n' + hint : ''),
        details: {
          host,
          port,
          ssl,
          responseTime: Date.now() - startTime,
        },
      });
    };

    // Create connection
    try {
      if (ssl) {
        // SSL/TLS connection
        socket = tls.connect({
          host,
          port,
          rejectUnauthorized: false, // Accept self-signed certificates
        });

        socket.on('secureConnect', () => {
          console.log(`[IMAP Test] Conexão SSL estabelecida com ${host}:${port}`);
        });
      } else {
        // Plain connection
        socket = new Socket();
        socket.connect(port, host);

        socket.on('connect', () => {
          console.log(`[IMAP Test] Conexão TCP estabelecida com ${host}:${port}`);
        });
      }

      // Common event handlers
      socket.on('data', handleData);
      socket.on('error', handleError);
      
      socket.on('close', () => {
        if (!connected) {
          cleanup();
          resolve({
            success: false,
            message: 'Conexão fechada antes de receber resposta do servidor',
            details: {
              host,
              port,
              ssl,
              responseTime: Date.now() - startTime,
            },
          });
        }
      });

      // Set socket timeout
      socket.setTimeout(timeout);
      socket.on('timeout', () => {
        cleanup();
        resolve({
          success: false,
          message: 'Socket timeout: Servidor não respondeu',
          details: {
            host,
            port,
            ssl,
            responseTime: Date.now() - startTime,
          },
        });
      });

    } catch (error) {
      cleanup();
      resolve({
        success: false,
        message: `Erro ao criar conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        details: {
          host,
          port,
          ssl,
          responseTime: Date.now() - startTime,
        },
      });
    }
  });
}

/**
 * Valida credenciais IMAP completas (requer biblioteca imap)
 * Por enquanto, apenas testa a conexão
 */
export async function testImapCredentials(
  host: string,
  port: number,
  ssl: boolean,
  email: string,
  password: string
): Promise<TestResult> {
  // Por enquanto, apenas testa a conexão
  // TODO: Implementar autenticação completa quando integrar biblioteca IMAP
  const result = await testImapConnection(host, port, ssl);
  
  if (result.success) {
    return {
      ...result,
      message: result.message + ' (Teste de autenticação será implementado na integração completa)',
    };
  }
  
  return result;
}

