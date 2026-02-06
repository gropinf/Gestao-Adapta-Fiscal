import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ListOrdered,
  FileText,
  Ban,
  AlertCircle,
  Filter,
  TrendingUp,
  Loader2,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { Company } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SequenceItem {
  tipo: "emitida" | "inutilizada" | "faltante";
  numero?: number;
  numeroInicio?: number;
  numeroFim?: number;
  data?: string;
  chave?: string;
  id?: string;
  justificativa?: string;
  dataCancelamento?: string | null;
}

interface SequenceSummary {
  totalEmitidas: number;
  totalInutilizadas: number;
  totalFaltantes: number;
  totalInconsistencias?: number;
  totalValorEmitidas?: number;
  primeiroNumero: number | null;
  ultimoNumero: number | null;
  modelo: string;
  periodo?: {
    inicio: string;
    fim: string;
  };
}

export default function AnaliseSequenciaPage() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
  const userId = useAuthStore((state) => state.user?.id);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetch("/api/companies", {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Erro ao carregar empresas");
      }

      return res.json();
    },
  });

  const currentCompany = companies.find((company) => company.id === currentCompanyId) || null;
  const canInutilizar = !!(
    currentCompany?.serie &&
    currentCompany?.certificadoPath &&
    currentCompany?.certificadoSenha
  );
  
  // Set default dates (first day of previous month to last day of previous month)
  const hoje = new Date();
  const primeiroDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  
  const [filters, setFilters] = useState({
    companyId: currentCompanyId || "",
    modelo: "55",
    periodStart: formatDate(primeiroDiaMesAnterior),
    periodEnd: formatDate(ultimoDiaMesAnterior),
  });

  // Atualiza companyId quando a empresa selecionada mudar
  useEffect(() => {
    if (currentCompanyId) {
      setFilters(prev => ({ ...prev, companyId: currentCompanyId }));
    }
  }, [currentCompanyId]);

  useEffect(() => {
    if (currentCompany?.serie) {
      setInutSerie(currentCompany.serie);
    }
  }, [currentCompany?.serie]);
  
  const [sequence, setSequence] = useState<SequenceItem[]>([]);
  const [summary, setSummary] = useState<SequenceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [showInconsistencies, setShowInconsistencies] = useState(false);
  const [inconsistencies, setInconsistencies] = useState<
    Array<{
      xmlId: string;
      numero: number;
      chave: string;
      dataEmissao: string;
      inutNumeroInicial: string;
      inutNumeroFinal: string;
      inutData: string;
      inutProtocolo: string | null;
    }>
  >([]);
  const [isInutilizarOpen, setIsInutilizarOpen] = useState(false);
  const [inutTarget, setInutTarget] = useState<{ inicio: number; fim: number } | null>(null);
  const [inutSerie, setInutSerie] = useState("");
  const [inutJustificativa, setInutJustificativa] = useState("");
  const [inutLoading, setInutLoading] = useState(false);

  // Removido carregamento automático - usuário deve clicar no botão "Analisar"
  // Isso evita erros ao acessar a página antes da empresa estar carregada

  const loadSequence = async () => {
    if (!filters.companyId) {
      toast({
        title: "Erro",
        description: "Selecione uma empresa",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: filters.companyId,
        modelo: filters.modelo,
        periodStart: filters.periodStart,
        periodEnd: filters.periodEnd,
      });

      const response = await fetch(`/api/xmls/sequence-analysis?${params}`, {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar análise de sequência");
      }

      const data = await response.json();
      setSequence(data.sequence);
      setSummary(data.summary);
      setInconsistencies(data.inconsistencias || []);
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDateBR = (dateStr: string): string => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const formatNumero = (num: number): string => {
    return num.toString().padStart(5, "0");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleFilter = () => {
    loadSequence();
  };

  const exportToText = () => {
    if (!summary || sequence.length === 0) return;
    const exportSequence = showOnlyMissing
      ? sequence.filter(item => item.tipo === "faltante")
      : sequence;

    let text = `ANÁLISE DE SEQUÊNCIA - ${summary.modelo}\n`;
    if (summary.periodo) {
      text += `Período: ${formatDateBR(summary.periodo.inicio)} a ${formatDateBR(summary.periodo.fim)}\n\n`;
    }
    text += `RESUMO:\n`;
    text += `Total Emitidas: ${summary.totalEmitidas}\n`;
    text += `Total Inutilizadas: ${summary.totalInutilizadas}\n`;
    text += `Total Faltantes: ${summary.totalFaltantes}\n`;
    text += `Total Valor Emitidas (sem canceladas): ${formatCurrency(summary.totalValorEmitidas || 0)}\n`;
    text += `Faixa: ${summary.primeiroNumero} a ${summary.ultimoNumero}\n\n`;
    text += `SEQUÊNCIA:\n`;
    text += `${"=".repeat(60)}\n\n`;

    exportSequence.forEach(item => {
      if (item.tipo === "emitida") {
        text += `${formatNumero(item.numero!)}  ${formatDateBR(item.data!)}\n`;
      } else if (item.tipo === "inutilizada") {
        const range = item.numeroInicio === item.numeroFim 
          ? formatNumero(item.numeroInicio!)
          : `${formatNumero(item.numeroInicio!)} a ${formatNumero(item.numeroFim!)}`;
        text += `${range} INUTILIZADAS em ${formatDateBR(item.data!)}\n`;
        if (item.justificativa) {
          text += `  Motivo: ${item.justificativa}\n`;
        }
      } else if (item.tipo === "faltante") {
        const range = item.numeroInicio === item.numeroFim 
          ? formatNumero(item.numeroInicio!)
          : `${formatNumero(item.numeroInicio!)} a ${formatNumero(item.numeroFim!)}`;
        text += `${range} FALTANTES / NÃO LOCALIZADAS\n`;
      }
    });

    if (inconsistencies.length > 0) {
      text += `\n\nINCONSISTÊNCIAS:\n`;
      text += `${"=".repeat(60)}\n\n`;
      inconsistencies.forEach((item) => {
        text += `Numero: ${formatNumero(item.numero)}\n`;
        text += `Emitida em: ${formatDateBR(item.dataEmissao)}\n`;
        text += `Chave: ${item.chave}\n`;
        text += `Inutilizacao: ${item.inutNumeroInicial} a ${item.inutNumeroFinal} em ${formatDateBR(item.inutData)}`;
        if (item.inutProtocolo) {
          text += ` (Protocolo ${item.inutProtocolo})`;
        }
        text += `\nXML ID: ${item.xmlId}\n`;
        text += `\n\n`;
      });
    }

    // Download
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analise-sequencia-${filters.modelo}-${filters.periodStart}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exportado",
      description: "Análise exportada com sucesso",
    });
  };

  const handleOpenInutilizar = (inicio: number, fim: number) => {
    if (!currentCompanyId) {
      toast({
        title: "Empresa não selecionada",
        description: "Selecione uma empresa antes de inutilizar.",
        variant: "destructive",
      });
      return;
    }

    if (!currentCompany) {
      toast({
        title: "Empresa não encontrada",
        description: "Não foi possível carregar os dados da empresa selecionada.",
        variant: "destructive",
      });
      return;
    }

    const missing: string[] = [];
    if (!currentCompany.serie) missing.push("série");
    if (!currentCompany.certificadoPath) missing.push("certificado A1");
    if (!currentCompany.certificadoSenha) missing.push("senha do certificado");

    if (missing.length > 0) {
      toast({
        title: "Dados incompletos",
        description: `Preencha ${missing.join(", ")} no cadastro do cliente antes de inutilizar.`,
        variant: "destructive",
      });
      return;
    }

    setInutSerie(currentCompany.serie);
    setInutTarget({ inicio, fim });
    setInutJustificativa("");
    setIsInutilizarOpen(true);
  };

  const handleSubmitInutilizar = async () => {
    if (!filters.companyId) {
      toast({
        title: "Empresa não selecionada",
        description: "Selecione uma empresa antes de inutilizar.",
        variant: "destructive",
      });
      return;
    }
    if (!currentCompany) {
      toast({
        title: "Empresa não encontrada",
        description: "Não foi possível carregar os dados da empresa selecionada.",
        variant: "destructive",
      });
      return;
    }
    if (!inutTarget) {
      toast({
        title: "Faixa inválida",
        description: "Selecione um número faltante.",
        variant: "destructive",
      });
      return;
    }
    if (!currentCompany.serie || !currentCompany.certificadoPath || !currentCompany.certificadoSenha) {
      toast({
        title: "Dados obrigatórios",
        description: "Preencha série, certificado A1 e senha no cadastro do cliente.",
        variant: "destructive",
      });
      return;
    }
    if (inutJustificativa.trim().length < 15) {
      toast({
        title: "Justificativa inválida",
        description: "A justificativa deve ter ao menos 15 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setInutLoading(true);
    try {
      const ano = filters.periodStart.slice(0, 4);
      const formData = new FormData();
      formData.append("companyId", filters.companyId);
      formData.append("modelo", filters.modelo);
      formData.append("serie", inutSerie || currentCompany.serie);
      formData.append("numeroInicial", String(inutTarget.inicio));
      formData.append("numeroFinal", String(inutTarget.fim));
      formData.append("justificativa", inutJustificativa);
      formData.append("ano", ano);

      const res = await fetch("/api/xml-events/inutilizar", {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erro ao inutilizar número");
      }

      toast({
        title: "Inutilização autorizada",
        description: data.xMotivo || "Número inutilizado com sucesso.",
      });
      setIsInutilizarOpen(false);
      await loadSequence();
    } catch (error) {
      toast({
        title: "Erro na inutilização",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setInutLoading(false);
    }
  };

  const filteredSequence = showOnlyMissing
    ? sequence.filter(item => item.tipo === "faltante")
    : sequence;

  const handleDeleteXml = async (xmlId: string, numero: number) => {
    if (!currentCompanyId) {
      toast({
        title: "Empresa não selecionada",
        description: "Selecione uma empresa antes de excluir",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      `Excluir a nota ${formatNumero(numero)}? Esta ação remove o XML da nota da base.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/xmls/${xmlId}?companyId=${currentCompanyId}`, {
        method: "DELETE",
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Erro ao excluir XML");
      }

      toast({
        title: "XML excluído",
        description: `Nota ${formatNumero(numero)} removida com sucesso`,
      });

      // Recarregar análise para refletir a exclusão
      loadSequence();
    } catch (error) {
      toast({
        title: "Erro ao excluir XML",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ListOrdered className="h-8 w-8" />
            Análise de Sequência de Notas
          </h1>
          <p className="text-muted-foreground">
            Identifique lacunas, inutilizações e notas faltantes na numeração
          </p>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>
              Configure os parâmetros para análise da sequência
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Select
                  value={filters.modelo}
                  onValueChange={(value) => setFilters({ ...filters, modelo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="55">55 - NFe</SelectItem>
                    <SelectItem value="65">65 - NFCe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={filters.periodStart}
                  onChange={(e) => setFilters({ ...filters, periodStart: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={filters.periodEnd}
                  onChange={(e) => setFilters({ ...filters, periodEnd: e.target.value })}
                />
              </div>

              <div className="space-y-2 flex items-end">
                <Button onClick={handleFilter} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Analisar
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Checkbox
                id="show-only-missing"
                checked={showOnlyMissing}
                onCheckedChange={(checked) => setShowOnlyMissing(checked === true)}
              />
              <Label htmlFor="show-only-missing">Mostrar somente faltantes</Label>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <Button
                variant={showInconsistencies ? "default" : "outline"}
                size="sm"
                onClick={() => setShowInconsistencies((prev) => !prev)}
                disabled={!summary || inconsistencies.length === 0}
              >
                Mostrar inconsistências
                {summary?.totalInconsistencias ? ` (${summary.totalInconsistencias})` : ""}
              </Button>
              {summary && inconsistencies.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Nenhuma inconsistência encontrada
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Card */}
        {summary && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Resumo da Análise</CardTitle>
                <Button variant="outline" size="sm" onClick={exportToText}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
              </div>
              <CardDescription>
                {summary.modelo}
                {summary.periodo && (
                  <> - {formatDateBR(summary.periodo.inicio)} a{" "}
                  {formatDateBR(summary.periodo.fim)}</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {summary.totalEmitidas}
                  </div>
                  <div className="text-sm text-muted-foreground">Emitidas</div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {summary.totalInutilizadas}
                  </div>
                  <div className="text-sm text-muted-foreground">Inutilizadas</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {summary.totalFaltantes}
                  </div>
                  <div className="text-sm text-muted-foreground">Faltantes</div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <div className="text-sm font-bold text-emerald-700">
                    {formatCurrency(summary.totalValorEmitidas || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total emitidas (sem canceladas)
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm font-bold text-gray-600">
                    {summary.primeiroNumero ? formatNumero(summary.primeiroNumero) : "-"}
                  </div>
                  <div className="text-sm text-muted-foreground">Primeira</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm font-bold text-gray-600">
                    {summary.ultimoNumero ? formatNumero(summary.ultimoNumero) : "-"}
                  </div>
                  <div className="text-sm text-muted-foreground">Última</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Inconsistencies Card */}
        {showInconsistencies && inconsistencies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Inconsistências Encontradas</CardTitle>
              <CardDescription>
                Notas emitidas que também aparecem como inutilizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {inconsistencies.map((item) => (
                  <div key={item.numero} className="flex flex-col gap-2 rounded border p-3">
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                      <Badge variant="destructive">{formatNumero(item.numero)}</Badge>
                      <span className="text-sm text-muted-foreground">
                        Emitida em {formatDateBR(item.dataEmissao)}
                      </span>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteXml(item.xmlId, item.numero)}
                      >
                        Excluir XML da Nota
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Inutilização: {item.inutNumeroInicial} a {item.inutNumeroFinal} em{" "}
                      {formatDateBR(item.inutData)}
                      {item.inutProtocolo ? ` (Protocolo ${item.inutProtocolo})` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      Chave: {item.chave}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sequence Card */}
        {filteredSequence.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sequência Completa</CardTitle>
              <CardDescription>
                {filteredSequence.length} registro(s) na sequência
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 font-mono text-sm">
                {filteredSequence.map((item, index) => (
                  <div key={index} className="flex items-start gap-4 py-2 hover:bg-muted/50 px-2 rounded">
                    {item.tipo === "emitida" && (
                      <>
                        <div className="flex items-center gap-2 flex-1">
                          <Badge variant="default" className="min-w-[80px] justify-center">
                            {formatNumero(item.numero!)}
                          </Badge>
                          <span className="text-muted-foreground">
                            {formatDateBR(item.data!)}
                          </span>
                          {item.dataCancelamento && (
                            <Badge variant="destructive">
                              Cancelada
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/xmls/${item.id}`)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    
                    {item.tipo === "inutilizada" && (
                      <div className="flex items-start gap-2 w-full">
                        <Ban className="h-4 w-4 text-orange-600 mt-1 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              {item.numeroInicio === item.numeroFim 
                                ? formatNumero(item.numeroInicio!)
                                : `${formatNumero(item.numeroInicio!)} a ${formatNumero(item.numeroFim!)}`
                              }
                            </Badge>
                            <span className="text-orange-600 font-semibold">INUTILIZADAS</span>
                            <span className="text-muted-foreground">
                              em {formatDateBR(item.data!)}
                            </span>
                          </div>
                          {item.justificativa && (
                            <div className="text-xs text-muted-foreground mt-1 ml-1">
                              Motivo: {item.justificativa}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {item.tipo === "faltante" && (
                      <div className="flex items-start gap-2 w-full">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-1 shrink-0" />
                        <div className="flex items-center gap-2 flex-1">
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            {item.numeroInicio === item.numeroFim 
                              ? formatNumero(item.numeroInicio!)
                              : `${formatNumero(item.numeroInicio!)} a ${formatNumero(item.numeroFim!)}`
                            }
                          </Badge>
                          <span className="text-red-600 font-semibold">
                            FALTANTES / NÃO LOCALIZADAS
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleOpenInutilizar(item.numeroInicio!, item.numeroFim!)
                          }
                          disabled={!canInutilizar}
                          title={
                            canInutilizar
                              ? "Inutilizar numeração"
                              : "Preencha série, certificado e senha no cadastro do cliente"
                          }
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          Inutilizar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && filteredSequence.length === 0 && summary && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <ListOrdered className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum registro encontrado</p>
                <p className="text-sm">
                  {showOnlyMissing
                    ? "Não há faltantes para os filtros selecionados"
                    : "Não foram encontradas notas emitidas no período selecionado"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        <Dialog open={isInutilizarOpen} onOpenChange={setIsInutilizarOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Inutilizar numeração</DialogTitle>
              <DialogDescription>
                Enviar inutilização à SEFAZ usando certificado A1.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número inicial</Label>
                  <Input value={inutTarget?.inicio ?? ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Número final</Label>
                  <Input value={inutTarget?.fim ?? ""} disabled />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Input value={filters.modelo} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Série</Label>
                  <Input value={inutSerie} disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Justificativa (mín. 15 caracteres)</Label>
                <Input
                  value={inutJustificativa}
                  onChange={(e) => setInutJustificativa(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Certificado A1</Label>
                <Input value={currentCompany?.certificadoPath || ""} disabled />
                {currentCompany?.certificadoPath && (
                  <a
                    href={currentCompany.certificadoPath}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Abrir certificado
                  </a>
                )}
              </div>
              <div className="space-y-2">
                <Label>Senha do certificado</Label>
                <Input
                  type="password"
                  value={currentCompany?.certificadoSenha || ""}
                  disabled
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInutilizarOpen(false)} disabled={inutLoading}>
                Cancelar
              </Button>
              <Button onClick={handleSubmitInutilizar} disabled={inutLoading}>
                {inutLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4 mr-2" />
                    Inutilizar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}





