import { useState, useCallback } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { ErrorBoundaryPage } from "@/components/ErrorBoundaryPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from "react-dropzone";
import {
  Upload as UploadIcon,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  File,
  X,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore, getAuthHeader } from "@/lib/auth";

interface UploadedFile {
  file: File;
  status: "pending" | "processing" | "success" | "error";
  progress: number;
  error?: string;
  step?: string;
  chave?: string;
  categoria?: string;
  totalNota?: string;
}

export default function Upload() {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
      file,
      status: "pending",
      progress: 0,
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/xml": [".xml"],
      "application/xml": [".xml"],
    },
    multiple: true,
  });

  const processFiles = async () => {
    const currentCompanyId = useAuthStore.getState().currentCompanyId;
    
    if (!currentCompanyId) {
      toast({
        title: "Empresa não selecionada",
        description: "Por favor, selecione uma empresa no menu superior",
        variant: "destructive",
      });
      return;
    }

    // Pega os arquivos pendentes ANTES de atualizar o estado
    const filesToProcess = uploadedFiles.filter((f) => f.status === "pending");
    
    if (filesToProcess.length === 0) {
      toast({
        title: "Nenhum arquivo para processar",
        description: "Adicione arquivos XML para processar",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Marca todos como processando
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.status === "pending"
            ? { ...f, status: "processing", progress: 0 }
            : f
        )
      );

      // Prepara FormData
      const formData = new FormData();
      
      // Usa os arquivos que pegamos ANTES da atualização do estado
      filesToProcess.forEach((uploadedFile) => {
        formData.append("files", uploadedFile.file);
      });

      // Envia para API
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.message || errorData.error || "Erro ao processar arquivos");
      }

      const result = await res.json();

      // Atualiza status de cada arquivo baseado na resposta
      const successMap = new Map(
        result.success?.map((s: any) => [s.filename, s]) || []
      );
      const errorMap = new Map(
        result.errors?.map((e: any) => [e.filename, e]) || []
      );

      setUploadedFiles((prev) =>
        prev.map((uploadedFile) => {
          const filename = uploadedFile.file.name;
          
          if (successMap.has(filename)) {
            const successData = successMap.get(filename);
            return {
              ...uploadedFile,
              status: "success" as const,
              progress: 100,
              chave: successData.chave,
              categoria: successData.categoria,
              totalNota: successData.totalNota,
            };
          }
          
          if (errorMap.has(filename)) {
            const errorData = errorMap.get(filename);
            return {
              ...uploadedFile,
              status: "error" as const,
              progress: 0,
              error: errorData.error,
              step: errorData.step,
            };
          }
          
          return uploadedFile;
        })
      );

      // Mostra resultado
      toast({
        title: "Processamento concluído!",
        description: result.message || `${result.success?.length || 0} arquivo(s) processado(s) com sucesso`,
      });

    } catch (error) {
      console.error("Erro no upload:", error);
      
      // Marca todos como erro
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.status === "processing"
            ? {
                ...f,
                status: "error" as const,
                error: error instanceof Error ? error.message : "Erro ao processar arquivo",
              }
            : f
        )
      );

      toast({
        title: "Erro no processamento",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearAll = () => {
    setUploadedFiles([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const successCount = uploadedFiles.filter((f) => f.status === "success").length;
  const errorCount = uploadedFiles.filter((f) => f.status === "error").length;

  return (
    <ErrorBoundaryPage>
      <DashboardLayout>
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold">Upload de XMLs</h1>
          <p className="text-muted-foreground mt-1">
            Faça upload de múltiplos arquivos XML para processamento em lote
          </p>
        </div>

        {/* Upload Zone */}
        <Card>
          <CardContent className="p-8">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl min-h-64 flex flex-col items-center justify-center
                cursor-pointer transition-all
                ${
                  isDragActive
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                }
              `}
              data-testid="dropzone-upload"
            >
              <input {...getInputProps()} data-testid="input-file-upload" />
              <UploadIcon
                className={`w-16 h-16 mb-4 ${
                  isDragActive ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <h3 className="text-xl font-semibold mb-2">
                {isDragActive
                  ? "Solte os arquivos aqui"
                  : "Arraste XMLs aqui"}
              </h3>
              <p className="text-muted-foreground text-center max-w-md">
                ou clique para selecionar arquivos do seu computador
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Formatos aceitos: .xml | Tamanho máximo: 10MB por arquivo
              </p>
            </div>
          </CardContent>
        </Card>

        {/* File List */}
        {uploadedFiles.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">
                    Arquivos Selecionados ({uploadedFiles.length})
                  </CardTitle>
                  {(successCount > 0 || errorCount > 0) && (
                    <div className="flex gap-4 mt-2">
                      {successCount > 0 && (
                        <p className="text-sm text-primary" data-testid="text-success-count">
                          {successCount} processados com sucesso
                        </p>
                      )}
                      {errorCount > 0 && (
                        <p className="text-sm text-destructive" data-testid="text-error-count">
                          {errorCount} com erro
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {!isProcessing && uploadedFiles.some((f) => f.status === "pending") && (
                    <Button
                      onClick={processFiles}
                      data-testid="button-process-files"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Processar Arquivos
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={clearAll}
                    disabled={isProcessing}
                    data-testid="button-clear-all"
                  >
                    Limpar Tudo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {uploadedFiles.map((uploadedFile, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 rounded-lg border hover-elevate"
                  data-testid={`file-item-${index}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <File className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">
                        {uploadedFile.file.name}
                      </p>
                      {uploadedFile.status === "success" && (
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                      {uploadedFile.status === "error" && (
                        <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                      )}
                      {uploadedFile.status === "processing" && (
                        <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(uploadedFile.file.size)}
                      </p>
                      {uploadedFile.status === "success" && uploadedFile.chave && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <p className="text-xs font-mono text-primary">
                            Chave: {uploadedFile.chave.substring(0, 8)}...
                          </p>
                          {uploadedFile.categoria && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              <Badge variant="outline" className="text-xs h-5">
                                {uploadedFile.categoria}
                              </Badge>
                            </>
                          )}
                          {uploadedFile.totalNota && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              <p className="text-xs text-muted-foreground">
                                R$ {parseFloat(uploadedFile.totalNota).toFixed(2)}
                              </p>
                            </>
                          )}
                        </>
                      )}
                      {uploadedFile.status === "error" && uploadedFile.error && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {uploadedFile.error}
                            {uploadedFile.step && (
                              <span className="text-xs">({uploadedFile.step})</span>
                            )}
                          </p>
                        </>
                      )}
                    </div>
                    {uploadedFile.status === "processing" && (
                      <Progress
                        value={uploadedFile.progress}
                        className="h-2 mt-2"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadedFile.status === "pending" && (
                      <Badge variant="outline">Aguardando</Badge>
                    )}
                    {uploadedFile.status === "processing" && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Processando
                      </Badge>
                    )}
                    {uploadedFile.status === "success" && (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        Concluído
                      </Badge>
                    )}
                    {uploadedFile.status === "error" && (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        Erro
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      disabled={isProcessing}
                      data-testid={`button-remove-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-muted/50">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-3">Instruções</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  Os arquivos XML serão validados automaticamente contra o schema SEFAZ
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  XMLs duplicados (mesma chave de acesso) serão ignorados automaticamente
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  As notas serão categorizadas como "emitidas" ou "recebidas" baseado no CNPJ
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  Você pode fazer upload de até 100 arquivos por vez
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
      </DashboardLayout>
    </ErrorBoundaryPage>
  );
}
