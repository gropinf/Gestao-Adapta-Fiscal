import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

interface SequenceItem {
  tipo: "emitida" | "inutilizada" | "faltante";
  numero?: number;
  numeroInicio?: number;
  numeroFim?: number;
  data?: string;
  chave?: string;
  id?: string;
  justificativa?: string;
}

interface SequenceSummary {
  totalEmitidas: number;
  totalInutilizadas: number;
  totalFaltantes: number;
  primeiroNumero: number | null;
  ultimoNumero: number | null;
  modelo: string;
  periodo: {
    inicio: string;
    fim: string;
  };
}

export default function AnaliseSequenciaPage() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  
  // Get selected company from URL or localStorage
  const selectedCompanyId = localStorage.getItem("selectedCompanyId") || "";
  
  // Set default dates (first day of current month to today)
  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  
  const [filters, setFilters] = useState({
    companyId: selectedCompanyId,
    modelo: "55",
    periodStart: formatDate(primeiroDiaMes),
    periodEnd: formatDate(hoje),
  });
  
  const [sequence, setSequence] = useState<SequenceItem[]>([]);
  const [summary, setSummary] = useState<SequenceSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (filters.companyId) {
      loadSequence();
    }
  }, []);

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
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar análise de sequência");
      }

      const data = await response.json();
      setSequence(data.sequence);
      setSummary(data.summary);
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

  const handleFilter = () => {
    loadSequence();
  };

  const exportToText = () => {
    if (!summary || sequence.length === 0) return;

    let text = `ANÁLISE DE SEQUÊNCIA - ${summary.modelo}\n`;
    text += `Período: ${formatDateBR(summary.periodo.inicio)} a ${formatDateBR(summary.periodo.fim)}\n\n`;
    text += `RESUMO:\n`;
    text += `Total Emitidas: ${summary.totalEmitidas}\n`;
    text += `Total Inutilizadas: ${summary.totalInutilizadas}\n`;
    text += `Total Faltantes: ${summary.totalFaltantes}\n`;
    text += `Faixa: ${summary.primeiroNumero} a ${summary.ultimoNumero}\n\n`;
    text += `SEQUÊNCIA:\n`;
    text += `${"=".repeat(60)}\n\n`;

    sequence.forEach(item => {
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
                {summary.modelo} - {formatDateBR(summary.periodo.inicio)} a{" "}
                {formatDateBR(summary.periodo.fim)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

        {/* Sequence Card */}
        {sequence.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sequência Completa</CardTitle>
              <CardDescription>
                {sequence.length} registro(s) na sequência
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 font-mono text-sm">
                {sequence.map((item, index) => (
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
                        <div className="flex items-center gap-2">
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
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && sequence.length === 0 && summary && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <ListOrdered className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhuma nota encontrada</p>
                <p className="text-sm">
                  Não foram encontradas notas emitidas no período selecionado
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}





