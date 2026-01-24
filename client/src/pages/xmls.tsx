import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Calendar,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

interface XmlEvent {
  id: string;
  tipoEvento: string;
  codigoEvento: string | null;
  dataEvento: string;
  horaEvento: string | null;
  chaveNFe: string | null;
  protocolo: string | null;
  justificativa: string | null;
  correcao: string | null;
  ano: string | null;
  serie: string | null;
  numeroInicial: string | null;
  numeroFinal: string | null;
  cnpj: string | null;
  modelo: string | null;
}

export default function Xmls() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoDoc, setTipoDoc] = useState("all");
  const [categoria, setCategoria] = useState("all");
  const [statusValidacao, setStatusValidacao] = useState("all");
  const [tipoEmitDest, setTipoEmitDest] = useState("all"); // Filtro EMIT/DEST
  const [sortBy, setSortBy] = useState<"dataEmissao" | "numeroNota" | "chave" | "totalNota">("dataEmissao");
  const [viewType, setViewType] = useState<"xmls" | "events">("xmls");
  const [eventTipo, setEventTipo] = useState("all");
  const [eventModelo, setEventModelo] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  
  const getDefaultDateRange = () => {
    const hoje = new Date();
    const primeiroDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    return {
      dataInicial: formatDate(primeiroDiaMesAnterior),
      dataFinal: formatDate(ultimoDiaMesAnterior),
    };
  };

  const defaultRange = getDefaultDateRange();
  const [dataInicial, setDataInicial] = useState(defaultRange.dataInicial);
  const [dataFinal, setDataFinal] = useState(defaultRange.dataFinal);
  // Estados para seleção múltipla
  const [selectedXmlIds, setSelectedXmlIds] = useState<Set<string>>(new Set());
  const [sendSelectedDialogOpen, setSendSelectedDialogOpen] = useState(false);
  const [sendingSelected, setSendingSelected] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [xmlToDelete, setXmlToDelete] = useState<Xml | null>(null);
  const [deleteChallenge, setDeleteChallenge] = useState<{ a: number; b: number } | null>(null);
  const [deleteAnswer, setDeleteAnswer] = useState("");
  // Estados do formulário de email para envio em lote
  const [emailToSelected, setEmailToSelected] = useState("");
  const [emailSubjectSelected, setEmailSubjectSelected] = useState("");
  const [emailTextSelected, setEmailTextSelected] = useState("");
  // Estados para os filtros que serão aplicados na busca
  const [appliedFilters, setAppliedFilters] = useState<{
    view: "xmls" | "events";
    tipoDoc: string;
    categoria: string;
    statusValidacao: string;
    tipoEmitDest: string;
    eventTipo: string;
    eventModelo: string;
    search: string;
    dataInicio: string;
    dataFim: string;
    sortBy: "dataEmissao" | "numeroNota" | "chave" | "totalNota";
  } | null>(null);

  // Busca XMLs da API
  const { data: xmls = [], isLoading, isError, refetch } = useQuery<Xml[]>({
    queryKey: [
      "/api/xmls",
      { 
        companyId: currentCompanyId,
        ...(appliedFilters || {}),
      },
    ],
    enabled: !!currentCompanyId && !!appliedFilters && appliedFilters.view === "xmls", // Só busca quando appliedFilters está definido
    staleTime: 1000 * 30, // 30 segundos - dados considerados frescos
    queryFn: async () => {
      if (!currentCompanyId || !appliedFilters) {
        throw new Error("Company ID ou filtros não definidos");
      }

      const params = new URLSearchParams();
      params.append("companyId", currentCompanyId);
      if (appliedFilters.tipoDoc !== "all") params.append("tipoDoc", appliedFilters.tipoDoc);
      if (appliedFilters.categoria !== "all") params.append("categoria", appliedFilters.categoria);
      if (appliedFilters.statusValidacao !== "all") params.append("statusValidacao", appliedFilters.statusValidacao);
      if (appliedFilters.tipoEmitDest !== "all") params.append("tipo", appliedFilters.tipoEmitDest);
      if (appliedFilters.search) params.append("search", appliedFilters.search);
      if (appliedFilters.dataInicio) params.append("dataInicio", appliedFilters.dataInicio);
      if (appliedFilters.dataFim) params.append("dataFim", appliedFilters.dataFim);
      if (appliedFilters.sortBy) params.append("sortBy", appliedFilters.sortBy);

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

  // A API já faz todos os filtros, não precisa filtrar localmente
  const filteredXmls = xmls;

  const { data: xmlEvents = [], isLoading: loadingEvents, isError: isErrorEvents, refetch: refetchEvents } = useQuery<XmlEvent[]>({
    queryKey: ["/api/xml-events/company", currentCompanyId],
    enabled: !!currentCompanyId && !!appliedFilters && appliedFilters.view === "events",
    queryFn: async () => {
      if (!currentCompanyId) {
        throw new Error("Company ID não definido");
      }

      const res = await fetch(`/api/xml-events/company/${currentCompanyId}`, {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Erro ao carregar eventos");
      }

      return res.json();
    },
  });

  // Paginação local
  const filteredEvents = xmlEvents.filter((event) => {
    if (!appliedFilters) return false;

    if (appliedFilters.eventTipo !== "all" && event.tipoEvento !== appliedFilters.eventTipo) {
      return false;
    }

    if (appliedFilters.eventModelo !== "all" && event.modelo !== appliedFilters.eventModelo) {
      return false;
    }

    if (appliedFilters.search) {
      const query = appliedFilters.search.toLowerCase();
      const matchesChave = event.chaveNFe?.includes(query);
      const matchesProtocolo = event.protocolo?.toLowerCase().includes(query);
      const matchesIntervalo = `${event.numeroInicial || ""}${event.numeroFinal || ""}`.includes(query);
      if (!matchesChave && !matchesProtocolo && !matchesIntervalo) {
        return false;
      }
    }

    if (appliedFilters.dataInicio && event.dataEvento < appliedFilters.dataInicio) {
      return false;
    }
    if (appliedFilters.dataFim && event.dataEvento > appliedFilters.dataFim) {
      return false;
    }

    return true;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const aNumber = Number.parseInt(a.numeroInicial || a.numeroFinal || "", 10);
    const bNumber = Number.parseInt(b.numeroInicial || b.numeroFinal || "", 10);
    const aHasNumber = Number.isFinite(aNumber);
    const bHasNumber = Number.isFinite(bNumber);

    if (aHasNumber && bHasNumber && aNumber !== bNumber) {
      return aNumber - bNumber;
    }
    if (aHasNumber !== bHasNumber) {
      return aHasNumber ? -1 : 1;
    }

    return a.dataEvento.localeCompare(b.dataEvento);
  });

  const totalPages = Math.ceil(
    (viewType === "xmls" ? filteredXmls.length : sortedEvents.length) / itemsPerPage
  );
  const paginatedXmls = filteredXmls.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const paginatedEvents = sortedEvents.slice(
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

  const formatDateBR = (dateStr: string): string => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const handleFilter = () => {
    const nextFilters = {
      view: viewType,
      tipoDoc,
      categoria,
      statusValidacao,
      tipoEmitDest,
      eventTipo,
      eventModelo,
      search: searchTerm,
      dataInicio: dataInicial,
      dataFim: dataFinal,
      sortBy,
    };
    setAppliedFilters(nextFilters);
    setCurrentPage(1); // Reset para primeira página ao filtrar
    updateListLocation(nextFilters, 1, selectedXmlIds);
  };

  // Buscar empresa para obter dados
  const { data: companies } = useQuery({
    queryKey: ["/api/companies"],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const res = await fetch("/api/companies", {
        headers: getAuthHeader(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar empresas");
      return res.json();
    },
  });

  const currentCompany = companies?.find((c: any) => c.id === currentCompanyId);

  // Toggle seleção de XML
  const toggleXmlSelection = (xmlId: string) => {
    const newSelection = new Set(selectedXmlIds);
    if (newSelection.has(xmlId)) {
      newSelection.delete(xmlId);
    } else {
      newSelection.add(xmlId);
    }
    setSelectedXmlIds(newSelection);
    if (appliedFilters) {
      updateListLocation(appliedFilters, currentPage, newSelection);
    }
  };

  // Selecionar/desselecionar todos (todos os registros do filtro, não apenas da página)
  const toggleSelectAll = () => {
    // Verificar se todos os XMLs do filtro estão selecionados
    const allSelected = xmls.length > 0 && xmls.every((xml) => selectedXmlIds.has(xml.id));
    
    if (allSelected) {
      // Desselecionar todos
      const nextSelection = new Set<string>();
      setSelectedXmlIds(nextSelection);
      if (appliedFilters) {
        updateListLocation(appliedFilters, currentPage, nextSelection);
      }
    } else {
      // Selecionar todos os XMLs do filtro
      const nextSelection = new Set(xmls.map((xml) => xml.id));
      setSelectedXmlIds(nextSelection);
      if (appliedFilters) {
        updateListLocation(appliedFilters, currentPage, nextSelection);
      }
    }
  };

  // Abrir diálogo de envio selecionados
  const handleOpenSendSelectedDialog = () => {
    if (selectedXmlIds.size === 0) {
      toast({
        title: "Nenhum XML selecionado",
        description: "Selecione pelo menos um XML para enviar",
        variant: "destructive",
      });
      return;
    }

    if (!currentCompany?.emailUser) {
      toast({
        title: "Email não configurado",
        description: "A empresa não possui configuração de email SMTP. Configure o email SMTP nas configurações da empresa.",
        variant: "destructive",
      });
      return;
    }

    // Usar as datas do filtro aplicado (ou as datas dos campos se não houver filtro)
    const dataInicio = appliedFilters?.dataInicio || dataInicial;
    const dataFim = appliedFilters?.dataFim || dataFinal;

    // Formatar datas para exibição
    const formatDateForText = (dateStr: string) => {
      const [year, month, day] = dateStr.split("-");
      return `${day}/${month}/${year}`;
    };

    const cnpj = currentCompany.cnpj || "";
    const razaoSocial = currentCompany.razaoSocial || "";

    // Preencher assunto e texto
    setEmailSubjectSelected(`Arquivos NFe ${cnpj}->${razaoSocial}`);
    setEmailTextSelected(`XML emitidos pela ${cnpj}->${razaoSocial}(${formatDateForText(dataInicio)} ate ${formatDateForText(dataFim)})`);
    setEmailToSelected("");

    setSendSelectedDialogOpen(true);
  };

  // Enviar XMLs selecionados
  const handleSendSelected = async () => {
    if (!emailToSelected || !emailSubjectSelected) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o destinatário e o assunto",
        variant: "destructive",
      });
      return;
    }

    if (selectedXmlIds.size === 0) {
      toast({
        title: "Nenhum XML selecionado",
        description: "Selecione pelo menos um XML para enviar",
        variant: "destructive",
      });
      return;
    }

    setSendingSelected(true);
    try {
      const res = await fetch(`/api/xmls/send-selected`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          xmlIds: Array.from(selectedXmlIds),
          to: emailToSelected,
          subject: emailSubjectSelected,
          text: emailTextSelected,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao enviar email");
      }

      const result = await res.json();

      toast({
        title: "Email enviado!",
        description: `${result.xmlCount} XML(s) foram enviados por email com sucesso`,
      });

      setSendSelectedDialogOpen(false);
      setSelectedXmlIds(new Set()); // Limpar seleção
    } catch (error) {
      toast({
        title: "Erro ao enviar email",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSendingSelected(false);
    }
  };

  const generateDeleteChallenge = () => ({
    a: Math.floor(Math.random() * 9) + 1,
    b: Math.floor(Math.random() * 9) + 1,
  });

  const resetDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setXmlToDelete(null);
    setDeleteAnswer("");
    setDeleteChallenge(null);
  };

  const handleOpenDeleteDialog = (xml: Xml) => {
    setXmlToDelete(xml);
    setDeleteAnswer("");
    setDeleteChallenge(generateDeleteChallenge());
    setDeleteDialogOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (xmlId: string) => {
      if (!currentCompanyId) {
        throw new Error("Empresa não selecionada");
      }

      const res = await fetch(`/api/xmls/${xmlId}?companyId=${currentCompanyId}`, {
        method: "DELETE",
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Erro ao excluir documento fiscal");
      }

      return res.json();
    },
    onSuccess: (_data, xmlId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/xmls"] });
      setSelectedXmlIds((prev) => {
        const next = new Set(prev);
        next.delete(xmlId);
        if (appliedFilters) {
          updateListLocation(appliedFilters, currentPage, next);
        }
        return next;
      });
      resetDeleteDialog();
      toast({
        title: "Documento excluído",
        description: "O documento foi removido da listagem com segurança.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir documento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  const handleDownloadEventXml = async (eventId: string) => {
    try {
      const res = await fetch(`/api/xml-events/${eventId}/download`, {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "Erro ao baixar XML do evento");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Evento-${eventId}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download iniciado",
        description: "O XML do evento está sendo baixado",
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

  const isDeleteAnswerValid =
    !!deleteChallenge && Number(deleteAnswer) === deleteChallenge.a + deleteChallenge.b;

  const updateListLocation = (
    filters: {
      view: "xmls" | "events";
      tipoDoc: string;
      categoria: string;
      statusValidacao: string;
      tipoEmitDest: string;
      eventTipo: string;
      eventModelo: string;
      search: string;
      dataInicio: string;
      dataFim: string;
      sortBy: "dataEmissao" | "numeroNota" | "chave" | "totalNota";
    } | null,
    page: number,
    selection: Set<string>,
  ) => {
    if (!filters) return;
    const params = new URLSearchParams();
    params.set("view", filters.view);
    params.set("tipoDoc", filters.tipoDoc);
    params.set("categoria", filters.categoria);
    params.set("statusValidacao", filters.statusValidacao);
    params.set("tipoEmitDest", filters.tipoEmitDest);
    params.set("eventTipo", filters.eventTipo);
    params.set("eventModelo", filters.eventModelo);
    params.set("search", filters.search);
    params.set("dataInicio", filters.dataInicio);
    params.set("dataFim", filters.dataFim);
    params.set("sortBy", filters.sortBy);
    params.set("page", String(page));
    if (selection.size > 0) {
      params.set("selected", Array.from(selection).join(","));
    }
    setLocation(`/xmls?${params.toString()}`);
  };

  const goToPage = (nextPage: number) => {
    setCurrentPage(nextPage);
    if (appliedFilters) {
      updateListLocation(appliedFilters, nextPage, selectedXmlIds);
    }
  };

  useEffect(() => {
    const search = location.includes("?") ? location.split("?")[1] : "";
    if (!search) {
      const defaults = getDefaultDateRange();
      setDataInicial(defaults.dataInicial);
      setDataFinal(defaults.dataFinal);
      setAppliedFilters(null);
      setCurrentPage(1);
      setSelectedXmlIds(new Set());
      return;
    }

    const params = new URLSearchParams(search);
    const defaults = getDefaultDateRange();
    const parsedPage = Number(params.get("page") || "1");
    const parsedSelection = params.get("selected")
      ? new Set(params.get("selected")!.split(",").filter(Boolean))
      : new Set<string>();
    const nextView = params.get("view") === "events" ? "events" : "xmls";
    const nextFilters = {
      view: nextView,
      tipoDoc: params.get("tipoDoc") || "all",
      categoria: params.get("categoria") || "all",
      statusValidacao: params.get("statusValidacao") || "all",
      tipoEmitDest: params.get("tipoEmitDest") || "all",
      eventTipo: params.get("eventTipo") || "all",
      eventModelo: params.get("eventModelo") || "all",
      search: params.get("search") || "",
      dataInicio: params.get("dataInicio") || defaults.dataInicial,
      dataFim: params.get("dataFim") || defaults.dataFinal,
      sortBy: (params.get("sortBy") as "dataEmissao" | "numeroNota" | "chave" | "totalNota") || "dataEmissao",
    };

    setViewType(nextFilters.view);
    setTipoDoc(nextFilters.tipoDoc);
    setCategoria(nextFilters.categoria);
    setStatusValidacao(nextFilters.statusValidacao);
    setTipoEmitDest(nextFilters.tipoEmitDest);
    setEventTipo(nextFilters.eventTipo);
    setEventModelo(nextFilters.eventModelo);
    setSearchTerm(nextFilters.search);
    setDataInicial(nextFilters.dataInicio);
    setDataFinal(nextFilters.dataFim);
    setSortBy(nextFilters.sortBy);
    setAppliedFilters(nextFilters);
    setCurrentPage(Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage);
    setSelectedXmlIds(parsedSelection);
  }, [location]);

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
          {viewType === "xmls" && (
            <Button 
              data-testid="button-send-selected"
              variant="outline"
              onClick={handleOpenSendSelectedDialog}
              disabled={selectedXmlIds.size === 0}
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar Selecionados {selectedXmlIds.size > 0 && `(${selectedXmlIds.size})`}
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[240px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={viewType === "xmls" ? "Buscar por chave, destinatário ou número..." : "Buscar por chave, protocolo ou intervalo..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11"
                    data-testid="input-search"
                  />
                </div>
              </div>
              {viewType === "xmls" && (
                <div className="space-y-2">
                  <Label className="text-sm">Ordenação</Label>
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                    <SelectTrigger className="w-[200px] h-11">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dataEmissao">Data de emissão</SelectItem>
                      <SelectItem value="numeroNota">Número da nota</SelectItem>
                      <SelectItem value="chave">Chave</SelectItem>
                      <SelectItem value="totalNota">Total da nota</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm">Tipo</Label>
                <Select value={viewType} onValueChange={(value) => {
                  const nextView = value === "events" ? "events" : "xmls";
                  setViewType(nextView);
                  setSelectedXmlIds(new Set());
                  setCurrentPage(1);
                  if (appliedFilters) {
                    updateListLocation({ ...appliedFilters, view: nextView }, 1, new Set());
                  }
                }}>
                  <SelectTrigger className="w-[180px] h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xmls">XMLs da Nota</SelectItem>
                    <SelectItem value="events">Eventos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Tipo Doc</Label>
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
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Categoria</Label>
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
              </div>
              {viewType === "xmls" ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">Status</Label>
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
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Tipo Emit/Dest</Label>
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
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">Tipo Evento</Label>
                    <Select value={eventTipo} onValueChange={setEventTipo}>
                      <SelectTrigger className="w-[180px] h-11">
                        <SelectValue placeholder="Tipo do Evento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="cancelamento">Cancelamento</SelectItem>
                        <SelectItem value="carta_correcao">Carta de Correção</SelectItem>
                        <SelectItem value="inutilizacao">Inutilização</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Modelo</Label>
                    <Select value={eventModelo} onValueChange={setEventModelo}>
                      <SelectTrigger className="w-[180px] h-11">
                        <SelectValue placeholder="Modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="55">NFe</SelectItem>
                        <SelectItem value="65">NFCe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            {/* Período */}
            <div className="flex flex-wrap items-end gap-4 mt-4 pt-4 border-t">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4" />
                  Data Inicial
                </Label>
                <Input
                  type="date"
                  value={dataInicial}
                  onChange={(e) => setDataInicial(e.target.value)}
                  className="w-[180px] h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4" />
                  Data Final
                </Label>
                <Input
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                  className="w-[180px] h-11"
                />
              </div>
              <Button
                onClick={handleFilter}
                className="h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Filtrando...
                  </>
                ) : (
                  <>
                    <Filter className="w-4 h-4 mr-2" />
                    Filtrar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* XMLs Table */}
        <Card>
          <CardContent className="p-0">
            {viewType === "xmls" ? (
              isLoading ? (
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
                        <th className="px-6 py-4 text-left text-sm font-semibold w-12">
                          <Checkbox
                            checked={xmls.length > 0 && xmls.every((xml) => selectedXmlIds.has(xml.id))}
                            onCheckedChange={toggleSelectAll}
                          />
                        </th>
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
                            <Checkbox
                              checked={selectedXmlIds.has(xml.id)}
                              onCheckedChange={() => toggleXmlSelection(xml.id)}
                            />
                          </td>
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
                              <div className="font-medium">{formatDateBR(xml.dataEmissao)}</div>
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
                                onClick={() => {
                                  const search = location.includes("?") ? location.slice(location.indexOf("?")) : "";
                                  setLocation(`/xmls/${xml.id}${search}`);
                                }}
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDeleteDialog(xml)}
                                data-testid={`button-delete-${xml.id}`}
                                title="Excluir documento"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
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
                      onClick={() => goToPage(Math.max(1, currentPage - 1))}
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
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )) : (
              loadingEvents ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="ml-3 text-muted-foreground">Carregando eventos...</p>
                </div>
              ) : isErrorEvents ? (
                <div className="flex items-center justify-center p-12">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                  <p className="ml-3 text-destructive">Erro ao carregar eventos</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-4"
                    onClick={() => refetchEvents()}
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : paginatedEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Nenhum evento encontrado</h3>
                  <p className="text-muted-foreground mt-1">
                    {searchTerm || eventTipo !== "all" || eventModelo !== "all"
                      ? "Tente ajustar os filtros ou fazer uma nova busca"
                      : "Faça upload de XMLs de eventos para começar"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-6 py-4 text-left text-sm font-semibold">
                            Tipo Evento
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold">
                            Modelo
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold">
                            Chave/Intervalo
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold">
                            Data
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold">
                            Protocolo
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold">
                            Observação
                          </th>
                          <th className="px-6 py-4 text-right text-sm font-semibold">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedEvents.map((event) => (
                          <tr key={event.id} className="border-b hover-elevate">
                            <td className="px-6 py-4">
                              <Badge variant="outline" className="capitalize">
                                {event.tipoEvento.replace("_", " ")}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {event.modelo === "55" ? "NFe" : event.modelo === "65" ? "NFCe" : "—"}
                            </td>
                            <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                              {event.chaveNFe
                                ? event.chaveNFe.substring(0, 4) + "..." + event.chaveNFe.substring(event.chaveNFe.length - 4)
                                : event.numeroInicial && event.numeroFinal
                                  ? `${event.numeroInicial} - ${event.numeroFinal}`
                                  : "—"}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="font-medium">{formatDateBR(event.dataEvento)}</div>
                              <div className="text-muted-foreground">{event.horaEvento || "—"}</div>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {event.protocolo || "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground">
                              {event.justificativa || event.correcao || "—"}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownloadEventXml(event.id)}
                                  title="Baixar XML do evento"
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
                      {Math.min(currentPage * itemsPerPage, sortedEvents.length)} de{" "}
                      {sortedEvents.length} resultados
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-w-10"
                      >
                        {currentPage}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Envio de XMLs Selecionados */}
      <Dialog open={sendSelectedDialogOpen} onOpenChange={setSendSelectedDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Enviar XMLs Selecionados por Email</DialogTitle>
            <DialogDescription>
              Enviar {selectedXmlIds.size} XML(s) selecionado(s) por email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-from-selected">Emitente</Label>
              <Input
                id="email-from-selected"
                value={currentCompany?.emailUser || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email da empresa (não editável)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-to-selected">Destinatário</Label>
              <Input
                id="email-to-selected"
                type="email"
                value={emailToSelected}
                onChange={(e) => setEmailToSelected(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-subject-selected">Título (Assunto)</Label>
              <Input
                id="email-subject-selected"
                value={emailSubjectSelected}
                onChange={(e) => setEmailSubjectSelected(e.target.value)}
                placeholder="Assunto do email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-text-selected">Texto</Label>
              <Textarea
                id="email-text-selected"
                value={emailTextSelected}
                onChange={(e) => setEmailTextSelected(e.target.value)}
                placeholder="Texto do email"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSendSelectedDialogOpen(false)}
              disabled={sendingSelected}
            >
              Cancelar
            </Button>
            <Button onClick={handleSendSelected} disabled={sendingSelected}>
              {sendingSelected ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Exclusão de XML */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetDeleteDialog();
          } else {
            setDeleteDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Excluir Documento Fiscal
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm">
              Item:{" "}
              <span className="font-semibold">
                {xmlToDelete
                  ? `${xmlToDelete.tipoDoc} ${xmlToDelete.numeroNota || formatChave(xmlToDelete.chave)}`
                  : "—"}
              </span>
            </div>
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta ação é irreversível. O documento será removido da listagem e permanecerá
                registrado apenas para auditoria.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation" className="text-sm">
                Para confirmar, resolva:{" "}
                {deleteChallenge ? `${deleteChallenge.a} + ${deleteChallenge.b} = ?` : "—"}
              </Label>
              <Input
                id="delete-confirmation"
                type="number"
                value={deleteAnswer}
                onChange={(e) => setDeleteAnswer(e.target.value)}
                placeholder="Digite o resultado"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Essa verificação ajuda a evitar exclusões acidentais.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={resetDeleteDialog}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => xmlToDelete && deleteMutation.mutate(xmlToDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
              disabled={!xmlToDelete || !isDeleteAnswerValid || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Sim, Excluir"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
