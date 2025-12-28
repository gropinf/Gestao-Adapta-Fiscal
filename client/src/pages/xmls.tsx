import { useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  Download,
  Eye,
  Send,
  FileText,
  CheckCircle2,
  FileX,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  File,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface Xml {
  id: string;
  chave: string;
  numeroNota: string | null;
  tipoDoc: string;
  categoria: string;
  dataEmissao: string;
  hora: string;
  razaoSocialDestinatario: string | null;
  totalNota: string;
  totalImpostos: string | null;
  statusValidacao: string;
  tipo?: 'EMIT' | 'DEST';  // Emitida ou Recebida
  cnpjEmitente?: string;
  cnpjDestinatario?: string;
}

export default function Xmls() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoDoc, setTipoDoc] = useState("all");
  const [categoria, setCategoria] = useState("all");
  const [statusValidacao, setStatusValidacao] = useState("all");
  const [tipoEmitDest, setTipoEmitDest] = useState("all"); // Filtro EMIT/DEST
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Busca XMLs da API
  const { data: xmls = [], isLoading, isError, refetch } = useQuery<Xml[]>({
    queryKey: [
      "/api/xmls",
      { 
        companyId: currentCompanyId,
        tipoDoc: tipoDoc !== "all" ? tipoDoc : undefined,
        categoria: categoria !== "all" ? categoria : undefined,
        statusValidacao: statusValidacao !== "all" ? statusValidacao : undefined,
        tipo: tipoEmitDest !== "all" ? tipoEmitDest : undefined,
        search: searchTerm || undefined,
      },
    ],
    enabled: !!currentCompanyId,
    staleTime: 1000 * 30, // 30 segundos - dados considerados frescos
    refetchInterval: 30000, // Atualiza a cada 30 segundos
    refetchOnWindowFocus: true, // Atualiza quando a janela recebe foco
    queryFn: async () => {
      if (!currentCompanyId) {
        throw new Error("Company ID não definido");
      }

      const params = new URLSearchParams();
      params.append("companyId", currentCompanyId);
      if (tipoDoc !== "all") params.append("tipoDoc", tipoDoc);
      if (categoria !== "all") params.append("categoria", categoria);
      if (statusValidacao !== "all") params.append("statusValidacao", statusValidacao);
      if (tipoEmitDest !== "all") params.append("tipo", tipoEmitDest);
      if (searchTerm) params.append("search", searchTerm);

      const res = await fetch(`/api/xmls?${params.toString()}`, {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Erro ao carregar XMLs");
      }

      return res.json();
    },
  });

  // Filtra localmente por busca (caso a API não faça)
  const filteredXmls = xmls.filter((xml) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      xml.chave.toLowerCase().includes(searchLower) ||
      xml.razaoSocialDestinatario?.toLowerCase().includes(searchLower) ||
      ""
    );
  });

  // Paginação local
  const totalPages = Math.ceil(filteredXmls.length / itemsPerPage);
  const paginatedXmls = filteredXmls.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numValue);
  };

  const formatChave = (chave: string) => {
    return chave.substring(0, 4) + "..." + chave.substring(chave.length - 4);
  };

  const handleDownloadXml = async (chave: string) => {
    try {
      const res = await fetch(`/api/xmls/${chave}/download`, {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Erro ao baixar XML");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NFe${chave}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download iniciado",
        description: "O arquivo XML está sendo baixado",
      });
    } catch (error) {
      toast({
        title: "Erro no download",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleDownloadDanfe = async (chave: string) => {
    try {
      toast({
        title: "Gerando DANFE...",
        description: "Aguarde enquanto o PDF é gerado",
      });

      const res = await fetch(`/api/danfe/${chave}`, {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao gerar DANFE");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NFe${chave}-DANFE.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "DANFE gerado!",
        description: "Download do PDF concluído com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar DANFE",
        description: error.message || "Não foi possível gerar o PDF",
        variant: "destructive",
      });
    }
  };

  if (!currentCompanyId) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-8">
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Empresa não selecionada</h3>
                <p className="text-muted-foreground mt-1">
                  Por favor, selecione uma empresa no menu superior para visualizar os XMLs
                </p>
              </div>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Documentos Fiscais</h1>
            <p className="text-muted-foreground mt-1">
              Visualize e gerencie todos os XMLs processados
            </p>
          </div>
          <Button 
            data-testid="button-send-selected"
            variant="outline"
            onClick={() => {
              toast({
                title: "Funcionalidade em desenvolvimento",
                description: "A seleção múltipla de XMLs para envio em lote estará disponível em breve.",
                variant: "default",
              });
            }}
          >
            <Send className="w-4 h-4 mr-2" />
            Enviar Selecionados
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[240px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por chave ou destinatário..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11"
                    data-testid="input-search"
                  />
                </div>
              </div>
              <Select value={tipoDoc} onValueChange={setTipoDoc}>
                <SelectTrigger className="w-[180px] h-11" data-testid="select-tipo-doc">
                  <SelectValue placeholder="Tipo de Documento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="NFe">NFe</SelectItem>
                  <SelectItem value="NFCe">NFCe</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="w-[180px] h-11" data-testid="select-categoria">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="emitida">Emitidas</SelectItem>
                  <SelectItem value="recebida">Recebidas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusValidacao} onValueChange={setStatusValidacao}>
                <SelectTrigger className="w-[180px] h-11">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="valido">Válidos</SelectItem>
                  <SelectItem value="invalido">Inválidos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tipoEmitDest} onValueChange={setTipoEmitDest}>
                <SelectTrigger className="w-[180px] h-11">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="emit">Emitidas</SelectItem>
                  <SelectItem value="dest">Recebidas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* XMLs Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Carregando XMLs...</p>
              </div>
            ) : isError ? (
              <div className="flex items-center justify-center p-12">
                <AlertCircle className="w-8 h-8 text-destructive" />
                <p className="ml-3 text-destructive">Erro ao carregar XMLs</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4"
                  onClick={() => refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : paginatedXmls.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Nenhum XML encontrado</h3>
                <p className="text-muted-foreground mt-1">
                  {searchTerm || tipoDoc !== "all" || categoria !== "all"
                    ? "Tente ajustar os filtros ou fazer uma nova busca"
                    : "Faça upload de arquivos XML para começar"}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Tipo Doc
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Emit/Dest
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Nº Nota
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Chave
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Data
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Destinatário
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-semibold">
                          Total Nota
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-semibold">
                          Impostos
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">
                          Status
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-semibold">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedXmls.map((xml) => (
                        <tr
                          key={xml.id}
                          className="border-b hover-elevate"
                          data-testid={`row-xml-${xml.id}`}
                        >
                          <td className="px-6 py-4">
                            <Badge variant="outline" className="font-mono w-fit">
                              {xml.tipoDoc}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={xml.tipo === "EMIT" ? "default" : "secondary"}
                              className={xml.tipo === "EMIT" ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}
                            >
                              {xml.tipo === "EMIT" ? "Emitida" : "Recebida"}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold">
                              {xml.numeroNota || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-mono text-muted-foreground">
                              {formatChave(xml.chave)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="font-medium">{xml.dataEmissao}</div>
                              <div className="text-muted-foreground">{xml.hora}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {xml.razaoSocialDestinatario || "—"}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-medium tabular-nums">
                            {formatCurrency(xml.totalNota)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-medium tabular-nums text-muted-foreground">
                            {xml.totalImpostos ? formatCurrency(xml.totalImpostos) : "—"}
                          </td>
                          <td className="px-6 py-4">
                            {xml.statusValidacao === "valido" ? (
                              <Badge
                                variant="outline"
                                className="bg-primary/10 text-primary border-primary/20"
                                data-testid={`status-valid-${xml.id}`}
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Válido
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-destructive/10 text-destructive border-destructive/20"
                                data-testid={`status-invalid-${xml.id}`}
                              >
                                <FileX className="w-3 h-3 mr-1" />
                                Inválido
                              </Badge>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLocation(`/xmls/${xml.id}`)}
                                data-testid={`button-view-${xml.id}`}
                                title="Ver detalhes"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadDanfe(xml.chave)}
                                data-testid={`button-danfe-${xml.id}`}
                                title="Baixar DANFE (PDF)"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <File className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadXml(xml.chave)}
                                data-testid={`button-download-${xml.id}`}
                                title="Baixar XML"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
                    {Math.min(currentPage * itemsPerPage, filteredXmls.length)} de{" "}
                    {filteredXmls.length} resultados
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-w-10"
                      data-testid="text-current-page"
                    >
                      {currentPage}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
