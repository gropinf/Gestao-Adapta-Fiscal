import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, Scan, Loader2, CheckCircle2, XCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeader } from '@/lib/auth';

export default function ContaboStoragePage() {
  const { toast } = useToast();
  const [migrating, setMigrating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [scanResult, setScanResult] = useState<any>(null);

  const handleMigrateProduction = async () => {
    if (!confirm('Deseja migrar todos os XMLs de produção para o Contabo Storage?\n\nEsta operação irá:\n- Baixar XMLs de URLs (produção)\n- Fazer upload para o Contabo\n- Atualizar o banco de dados')) {
      return;
    }

    setMigrating(true);
    setMigrationResult(null);

    try {
      const response = await fetch('/api/storage/migrate-production', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao migrar XMLs de produção');
      }

      setMigrationResult(data);
      toast({
        title: 'Sucesso',
        description: `Migração concluída: ${data.successCount} XMLs migrados`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Erro ao migrar XMLs de produção:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao migrar XMLs de produção',
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
    }
  };

  const handleScanAndImport = async () => {
    if (!confirm('Deseja escanear o Contabo Storage e reimportar XMLs faltantes?\n\nEsta operação irá:\n- Escanear todas as pastas no Contabo\n- Identificar XMLs que não estão no banco\n- Reimportar e processar os XMLs faltantes')) {
      return;
    }

    setScanning(true);
    setScanResult(null);

    try {
      const response = await fetch('/api/storage/scan-and-import', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao escanear Contabo Storage');
      }

      setScanResult(data);
      toast({
        title: 'Sucesso',
        description: `Escaneamento concluído: ${data.success} XMLs importados`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Erro ao escanear Contabo:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao escanear Contabo Storage',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gerenciamento Contabo Storage</h1>
        <p className="text-gray-600 mt-2">
          Migre XMLs de produção e sincronize o Contabo Storage com o banco de dados
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Migração de Produção */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Migrar XMLs de Produção
            </CardTitle>
            <CardDescription>
              Copia XMLs que estão em URLs (produção) para o Contabo Storage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Informação</AlertTitle>
              <AlertDescription>
                Esta operação irá baixar XMLs de URLs de produção, fazer upload para o Contabo Storage
                e atualizar o banco de dados. As URLs originais não serão deletadas.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleMigrateProduction}
              disabled={migrating}
              className="w-full"
              size="lg"
            >
              {migrating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Migrando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Migrar XMLs de Produção
                </>
              )}
            </Button>

            {migrationResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  {migrationResult.successCount > 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-semibold">Resultado da Migração</span>
                </div>
                <div className="text-sm space-y-1">
                  <p>Total processado: <strong>{migrationResult.total}</strong></p>
                  <p className="text-green-600">✅ Sucesso: <strong>{migrationResult.successCount}</strong></p>
                  {migrationResult.errorCount > 0 && (
                    <p className="text-red-600">❌ Erros: <strong>{migrationResult.errorCount}</strong></p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Escanear e Reimportar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="w-5 h-5" />
              Escanear e Reimportar
            </CardTitle>
            <CardDescription>
              Analisa o Contabo Storage e reimporta XMLs que estão lá mas não no banco
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Informação</AlertTitle>
              <AlertDescription>
                Esta operação escaneia todas as pastas no Contabo Storage, identifica XMLs que não estão
                no banco de dados e os reimporta automaticamente.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleScanAndImport}
              disabled={scanning}
              className="w-full"
              size="lg"
              variant="outline"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Escaneando...
                </>
              ) : (
                <>
                  <Scan className="w-4 h-4 mr-2" />
                  Escanear e Reimportar
                </>
              )}
            </Button>

            {scanResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  {scanResult.success > 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-600" />
                  )}
                  <span className="font-semibold">Resultado do Escaneamento</span>
                </div>
                <div className="text-sm space-y-1">
                  <p>Arquivos no Contabo: <strong>{scanResult.filesInStorage}</strong></p>
                  <p>Arquivos no banco: <strong>{scanResult.filesInDatabase}</strong></p>
                  <p>Faltantes no banco: <strong>{scanResult.missingInDatabase}</strong></p>
                  <p className="text-green-600">✅ Importados: <strong>{scanResult.success}</strong></p>
                  {scanResult.errors > 0 && (
                    <p className="text-red-600">❌ Erros: <strong>{scanResult.errors}</strong></p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Informações Adicionais */}
      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <strong>Migração de Produção:</strong> Use quando você tem XMLs armazenados em URLs (servidor de produção)
              e quer migrá-los para o Contabo Storage. Os XMLs serão baixados das URLs e enviados para o Contabo.
            </p>
            <p>
              <strong>Escanear e Reimportar:</strong> Use quando você suspeita que há XMLs no Contabo Storage que não
              estão registrados no banco de dados. Isso pode acontecer após migrações de diferentes ambientes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
