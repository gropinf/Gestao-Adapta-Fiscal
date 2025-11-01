import { useMemo } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Upload,
  Send,
  Calendar,
  FileCheck,
  FileX,
} from "lucide-react";
import { Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";
import type { Xml } from "@shared/schema";
import { useLocation } from "wouter";

// Register ChartJS components
ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { currentCompanyId } = useAuthStore();

  // Fetch XMLs for current company
  const { data: xmls, isLoading } = useQuery<Xml[]>({
    queryKey: ["/api/xmls", { companyId: currentCompanyId }],
    enabled: !!currentCompanyId,
  });

  // Calculate KPIs from real data
  const kpis = useMemo(() => {
    if (!xmls || !currentCompanyId) return { total: 0, emitidas: 0, recebidas: 0, totalValue: 0, validCount: 0 };

    const emitidas = xmls.filter((x) => x.categoria === "emitida").length;
    const recebidas = xmls.filter((x) => x.categoria === "recebida").length;
    const validCount = xmls.filter((x) => x.statusValidacao === "valido").length;
    const totalValue = xmls.reduce((sum, x) => {
      const value = parseFloat(x.totalNota || "0");
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

    return {
      total: xmls.length,
      emitidas,
      recebidas,
      totalValue,
      validCount,
    };
  }, [xmls, currentCompanyId]);

  // Prepare chart data from real XMLs
  const pieData = useMemo(() => {
    if (!xmls) return null;

    const nfeEmitidas = xmls.filter((x) => x.tipoDoc === "NFe" && x.categoria === "emitida").length;
    const nfeRecebidas = xmls.filter((x) => x.tipoDoc === "NFe" && x.categoria === "recebida").length;
    const nfce = xmls.filter((x) => x.tipoDoc === "NFCe").length;

    return {
      labels: ["NFe Emitidas", "NFe Recebidas", "NFCe"],
      datasets: [
        {
          data: [nfeEmitidas, nfeRecebidas, nfce],
          backgroundColor: [
            "hsl(142, 71%, 45%)",
            "hsl(217, 91%, 48%)",
            "hsl(195, 85%, 42%)",
          ],
          borderWidth: 0,
        },
      ],
    };
  }, [xmls]);

  // Prepare line chart data (last 6 months)
  const lineData = useMemo(() => {
    if (!xmls) return null;

    const now = new Date();
    const monthsLabels = [];
    const monthsData = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString("pt-BR", { month: "short" });
      monthsLabels.push(monthName.charAt(0).toUpperCase() + monthName.slice(1));

      const count = xmls.filter((x) => {
        const xmlDate = new Date(x.dataEmissao);
        return xmlDate.getMonth() === date.getMonth() && xmlDate.getFullYear() === date.getFullYear();
      }).length;

      monthsData.push(count);
    }

    return {
      labels: monthsLabels,
      datasets: [
        {
          label: "Volume de XMLs",
          data: monthsData,
          borderColor: "hsl(142, 71%, 45%)",
          backgroundColor: "hsl(142, 71%, 45%, 0.1)",
          tension: 0.4,
        },
      ],
    };
  }, [xmls]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  // Get recent 5 XMLs
  const recentXmls = useMemo(() => {
    if (!xmls) return [];
    return [...xmls]
      .sort((a, b) => new Date(b.dataEmissao).getTime() - new Date(a.dataEmissao).getTime())
      .slice(0, 5);
  }, [xmls]);

  const formatCurrency = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(num);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral das suas notas fiscais
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" data-testid="button-send-accountant" disabled>
              <Send className="w-4 h-4 mr-2" />
              Enviar para Contador
            </Button>
            <Button data-testid="button-upload-batch" onClick={() => setLocation("/upload")}>
              <Upload className="w-4 h-4 mr-2" />
              Upload em Lote
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total XMLs
              </CardTitle>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-xmls">{kpis.total}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <span>{kpis.emitidas} emitidas, {kpis.recebidas} recebidas</span>
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Valor Total
              </CardTitle>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-value">{formatCurrency(kpis.totalValue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Soma de todas as notas
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Válidos
              </CardTitle>
              <FileCheck className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-primary" data-testid="text-valid-xmls">
                    {kpis.validCount}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {kpis.total > 0 ? ((kpis.validCount / kpis.total) * 100).toFixed(1) : 0}% conformidade
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover-elevate border-destructive/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alertas
              </CardTitle>
              <AlertCircle className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-destructive" data-testid="text-alerts">
                    {kpis.total - kpis.validCount}
                  </div>
                  <p className="text-xs text-destructive mt-1">
                    XMLs com inconsistências
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Distribuição de Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !pieData ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <div className="h-64">
                    <Pie data={pieData} options={chartOptions} />
                  </div>
                  <div className="flex gap-4 justify-center mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[hsl(142,71%,45%)]"></div>
                      <span className="text-sm text-muted-foreground">NFe Emitidas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[hsl(217,91%,48%)]"></div>
                      <span className="text-sm text-muted-foreground">NFe Recebidas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[hsl(195,85%,42%)]"></div>
                      <span className="text-sm text-muted-foreground">NFCe</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Volume por Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !lineData ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="h-64">
                  <Line data={lineData} options={chartOptions} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent XMLs table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              XMLs Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-6 py-4 text-left text-sm font-semibold">
                      Tipo
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">
                      Data
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">
                      Destinatário
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold">
                      Total
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="px-6 py-4"><Skeleton className="h-6 w-16" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-6 w-20" /></td>
                      </tr>
                    ))
                  ) : recentXmls.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                        Nenhum XML encontrado. Faça upload de XMLs para começar.
                      </td>
                    </tr>
                  ) : (
                    recentXmls.map((xml) => (
                      <tr
                        key={xml.id}
                        className="border-b hover-elevate cursor-pointer"
                        onClick={() => setLocation(`/xmls`)}
                        data-testid={`row-xml-${xml.id}`}
                      >
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="font-mono">
                            {xml.tipoDoc}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm">{formatDate(xml.dataEmissao)}</td>
                        <td className="px-6 py-4 text-sm">
                          {xml.razaoSocialDestinatario || "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-medium tabular-nums">
                          {formatCurrency(xml.totalNota)}
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
