import { useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { ErrorBoundaryPage } from "@/components/ErrorBoundaryPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, FileText, Download, Loader2, FileSpreadsheet, Calendar } from "lucide-react";
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Relatorios() {
  const { toast } = useToast();
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
  
  const [isExporting, setIsExporting] = useState(false);
  const [isSummaryExporting, setIsSummaryExporting] = useState(false);
  
  // Filtros
  const [tipoDoc, setTipoDoc] = useState("all");
  const [categoria, setCategoria] = useState("all");
  const [statusValidacao, setStatusValidacao] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeDetails, setIncludeDetails] = useState(false);

  const handleExportExcel = async () => {
    if (!currentCompanyId) {
      toast({
        title: "Empresa não selecionada",
        description: "Selecione uma empresa no menu superior",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      const body: any = {
        companyId: currentCompanyId,
        includeDetails,
      };

      if (tipoDoc !== "all") body.tipoDoc = tipoDoc;
      if (categoria !== "all") body.categoria = categoria;
      if (statusValidacao !== "all") body.statusValidacao = statusValidacao;
      if (dateFrom) body.dateFrom = dateFrom;
      if (dateTo) body.dateTo = dateTo;

      const res = await fetch("/api/reports/excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao gerar relatório");
      }

      // Download do arquivo
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "relatorio.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Relatório gerado!",
        description: "O arquivo Excel foi baixado com sucesso",
      });

    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast({
        title: "Erro ao gerar relatório",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSummary = async () => {
    if (!currentCompanyId) {
      toast({
        title: "Empresa não selecionada",
        description: "Selecione uma empresa no menu superior",
        variant: "destructive",
      });
      return;
    }

    setIsSummaryExporting(true);

    try {
      const body: any = {
        companyId: currentCompanyId,
      };

      if (dateFrom) body.dateFrom = dateFrom;
      if (dateTo) body.dateTo = dateTo;

      const res = await fetch("/api/reports/excel/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao gerar resumo");
      }

      // Download do arquivo
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "resumo.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Resumo gerado!",
        description: "O arquivo Excel foi baixado com sucesso",
      });

    } catch (error) {
      console.error("Erro ao exportar resumo:", error);
      toast({
        title: "Erro ao gerar resumo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsSummaryExporting(false);
    }
  };

  return (
    <ErrorBoundaryPage>
      <DashboardLayout>
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground mt-1">
            Gere relatórios personalizados em Excel dos seus documentos fiscais
          </p>
        </div>

        {/* Relatório Detalhado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Relatório Detalhado de XMLs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Exporta todos os XMLs com informações completas em planilha Excel
            </p>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select value={tipoDoc} onValueChange={setTipoDoc}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="NFe">NFe</SelectItem>
                    <SelectItem value="NFCe">NFCe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="emitida">Emitidas</SelectItem>
                    <SelectItem value="recebida">Recebidas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusValidacao} onValueChange={setStatusValidacao}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="valido">Válidos</SelectItem>
                    <SelectItem value="invalido">Inválidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateFrom">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Data Inicial
                </Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateTo">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Data Final
                </Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            {/* Opções adicionais */}
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="includeDetails"
                checked={includeDetails}
                onCheckedChange={setIncludeDetails}
              />
              <Label htmlFor="includeDetails" className="cursor-pointer">
                Incluir aba de detalhes técnicos (IDs, caminhos de arquivo, etc.)
              </Label>
            </div>

            {/* Informações da planilha */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">O relatório incluirá:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✅ Informações da empresa e período</li>
                <li>✅ Totalizadores (emitidas, recebidas, valores)</li>
                <li>✅ Lista completa de XMLs com todos os campos</li>
                <li>✅ Formatação brasileira (moeda, datas)</li>
                <li>✅ Largura de colunas otimizada</li>
                {includeDetails && <li>✅ Aba adicional com detalhes técnicos</li>}
              </ul>
            </div>

            <Button
              onClick={handleExportExcel}
              disabled={isExporting || !currentCompanyId}
              className="w-full h-12"
              data-testid="button-export-excel"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Gerando Relatório...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Exportar para Excel
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Resumo por Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Resumo por Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Exporta estatísticas agrupadas por data (quantidade, valores, etc.)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="summaryDateFrom">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Data Inicial
                </Label>
                <Input
                  id="summaryDateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="summaryDateTo">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Data Final
                </Label>
                <Input
                  id="summaryDateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">O resumo incluirá:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✅ Agrupamento por data</li>
                <li>✅ Quantidade de XMLs por dia</li>
                <li>✅ Emitidas vs Recebidas por dia</li>
                <li>✅ Totais de valores por dia</li>
                <li>✅ Totais de impostos por dia</li>
              </ul>
            </div>

            <Button
              onClick={handleExportSummary}
              disabled={isSummaryExporting || !currentCompanyId}
              className="w-full h-12"
              data-testid="button-export-summary"
            >
              {isSummaryExporting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Gerando Resumo...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Exportar Resumo
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Instruções */}
        <Card className="bg-muted/30">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Sobre os Relatórios
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Relatório Detalhado:</strong> Contém todas as informações de cada XML
                (chave, datas, CNPJs, valores, status). Ideal para análises completas e envio para contadores.
              </p>
              <p>
                <strong>Resumo por Data:</strong> Agrupa os dados por dia, facilitando a visualização
                de tendências e volumes. Ideal para análises gerenciais rápidas.
              </p>
              <p className="mt-4">
                💡 <strong>Dica:</strong> Use os filtros de data para gerar relatórios mensais ou
                trimestrais personalizados.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      </DashboardLayout>
    </ErrorBoundaryPage>
  );
}
