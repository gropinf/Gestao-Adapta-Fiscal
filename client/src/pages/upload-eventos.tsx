import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, X, FileCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function UploadEventosPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<{
    success: any[];
    errors: any[];
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      const xmlFiles = files.filter(file => 
        file.name.toLowerCase().endsWith('.xml')
      );
      
      if (xmlFiles.length < files.length) {
        toast({
          title: "Aviso",
          description: `${files.length - xmlFiles.length} arquivo(s) não XML foram ignorados`,
          variant: "destructive",
        });
      }
      
      setSelectedFiles(xmlFiles);
      setUploadResults(null);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um arquivo XML",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResults(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/xml-events/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao fazer upload");
      }

      const results = await response.json();
      setUploadResults(results);

      if (results.success.length > 0) {
        toast({
          title: "Upload concluído",
          description: `${results.success.length} evento(s) processado(s) com sucesso`,
        });
      }

      if (results.errors.length > 0) {
        toast({
          title: "Alguns erros ocorreram",
          description: `${results.errors.length} arquivo(s) com erro`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(100);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setUploadResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getTipoEventoLabel = (tipo: string): string => {
    switch (tipo) {
      case "evento":
        return "Evento";
      case "inutilizacao":
        return "Inutilização";
      default:
        return tipo;
    }
  };

  const getTipoEventoDetalhes = (tipo: string, tipoEvento?: string): string => {
    if (tipo === "inutilizacao") return "Inutilização de Numeração";
    
    switch (tipoEvento) {
      case "cancelamento":
        return "Cancelamento de NFe";
      case "carta_correcao":
        return "Carta de Correção";
      case "confirmacao":
        return "Confirmação da Operação";
      case "desconhecimento":
        return "Desconhecimento da Operação";
      case "operacao_nao_realizada":
        return "Operação Não Realizada";
      default:
        return tipoEvento || tipo;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Upload de Eventos NFe</h1>
        <p className="text-muted-foreground">
          Envie XMLs de eventos (cancelamento, carta de correção) e inutilizações
        </p>
      </div>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Arquivos
          </CardTitle>
          <CardDescription>
            Selecione um ou mais arquivos XML de eventos ou inutilizações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xml"
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button
                  variant="outline"
                  className="w-full cursor-pointer"
                  disabled={uploading}
                  asChild
                >
                  <span>
                    <FileText className="mr-2 h-4 w-4" />
                    Selecionar Arquivos XML
                  </span>
                </Button>
              </label>
            </div>
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploading}
              className="min-w-[140px]"
            >
              {uploading ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-pulse" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Enviar
                </>
              )}
            </Button>
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-sm text-muted-foreground text-center">
                Processando arquivos...
              </p>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {selectedFiles.length} arquivo(s) selecionado(s)
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  disabled={uploading}
                >
                  Limpar tudo
                </Button>
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-lg p-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {uploadResults && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Resultado do Upload</CardTitle>
              <CardDescription>
                {uploadResults.total} arquivo(s) processado(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-4 border rounded-lg">
                  <FileCheck className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{uploadResults.total}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-4 border rounded-lg bg-green-50">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {uploadResults.success.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Sucesso</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-4 border rounded-lg bg-red-50">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold text-red-600">
                      {uploadResults.errors.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Erros</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Success List */}
          {uploadResults.success.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  Processados com Sucesso ({uploadResults.success.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {uploadResults.success.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between p-3 border rounded-lg bg-green-50"
                    >
                      <div className="space-y-1 flex-1">
                        <p className="font-medium text-sm">{item.filename}</p>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline">
                            {getTipoEventoLabel(item.tipo)}
                          </Badge>
                          {item.tipoEvento && (
                            <Badge variant="secondary">
                              {getTipoEventoDetalhes(item.tipo, item.tipoEvento)}
                            </Badge>
                          )}
                          {item.tipo === "inutilizacao" && (
                            <span className="text-xs text-muted-foreground">
                              Série {item.serie}: {item.numeroInicial} a {item.numeroFinal}
                            </span>
                          )}
                        </div>
                        {item.chaveNFe && (
                          <p className="text-xs text-muted-foreground font-mono">
                            Chave: {item.chaveNFe}
                          </p>
                        )}
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-600 shrink-0 ml-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error List */}
          {uploadResults.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  Erros no Processamento ({uploadResults.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {uploadResults.errors.map((item, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{item.filename}</AlertTitle>
                      <AlertDescription>
                        <p className="font-medium">{item.error}</p>
                        {item.step && (
                          <p className="text-xs mt-1">Etapa: {item.step}</p>
                        )}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Help */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Tipos de Eventos Suportados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Badge variant="destructive">Cancelamento</Badge>
              <span className="text-muted-foreground">
                XML de cancelamento de NFe (procEventoNFe - código 110111)
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="secondary">Carta de Correção</Badge>
              <span className="text-muted-foreground">
                XML de carta de correção eletrônica (procEventoNFe - código 110110)
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="outline">Inutilização</Badge>
              <span className="text-muted-foreground">
                XML de inutilização de numeração (procInutNFe)
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Badge>Outros Eventos</Badge>
              <span className="text-muted-foreground">
                Confirmação, desconhecimento e operação não realizada (destinatário)
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}





