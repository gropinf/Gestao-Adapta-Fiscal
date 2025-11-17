import { useMemo } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AlertsCard from "@/components/alerts-card";
import {
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Upload,
  Send,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Receipt,
  Loader2,
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
import { useAuthStore, getAuthHeader } from "@/lib/auth";
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

interface DashboardStats {
  totalXmls: number;
  emitidas: number;
  recebidas: number;
  totalNotas: number;
  totalImpostos: number;
  nfeCount: number;
  nfceCount: number;
  recentXmls: any[];
  volumeByDay: { date: string; count: number }[];
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);

  // Fetch dashboard stats
  const { data: stats, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", { companyId: currentCompanyId }],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      if (!currentCompanyId) {
        throw new Error("Company ID não definido");
      }

      const res = await fetch(`/api/dashboard/stats?companyId=${currentCompanyId}`, {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Erro ao carregar estatísticas");
      }

      return res.json();
    },
  });

  // Prepare pie chart data
  const pieData = useMemo(() => {
    if (!stats) return null;

    return {
      labels: ["Emitidas", "Recebidas"],
      datasets: [
        {
          data: [stats.emitidas, stats.recebidas],
          backgroundColor: [
            "hsl(142, 71%, 45%)", // Verde
            "hsl(217, 91%, 60%)", // Azul
          ],
          borderWidth: 0,
        },
      ],
    };
  }, [stats]);

  // Prepare line chart data
  const lineData = useMemo(() => {
    if (!stats) return null;

    return {
      labels: stats.volumeByDay.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      }),
      datasets: [
        {
          label: "XMLs Processados",
          data: stats.volumeByDay.map(d => d.count),
          borderColor: "hsl(142, 71%, 45%)",
          backgroundColor: "hsla(142, 71%, 45%, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    };
  }, [stats]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Loading state
  if (isLoading || !stats) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-8 space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Carregando estatísticas...</p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (isError || !currentCompanyId) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-8">
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">
                  {!currentCompanyId ? "Empresa não selecionada" : "Erro ao carregar estatísticas"}
                </h3>
                <p className="text-muted-foreground mt-1">
                  {!currentCompanyId 
                    ? "Por favor, selecione uma empresa no menu superior"
                    : "Não foi possível carregar os dados do dashboard"}
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
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral dos seus documentos fiscais
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setLocation("/upload")} data-testid="button-upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload XMLs
            </Button>
            <Button variant="outline" data-testid="button-send">
              <Send className="w-4 h-4 mr-2" />
              Enviar para Contador
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Total XMLs */}
          <Card className="hover-elevate" data-testid="card-total-xmls">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total de XMLs
                </CardTitle>
                <FileText className="w-5 h-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalXmls}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.nfeCount} NFe • {stats.nfceCount} NFCe
              </p>
            </CardContent>
          </Card>

          {/* Emitidas */}
          <Card className="hover-elevate" data-testid="card-emitidas">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Notas Emitidas
                </CardTitle>
                <ArrowUpRight className="w-5 h-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.emitidas}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalXmls > 0 
                  ? `${((stats.emitidas / stats.totalXmls) * 100).toFixed(0)}% do total`
                  : "Nenhum XML processado"}
              </p>
            </CardContent>
          </Card>

          {/* Recebidas */}
          <Card className="hover-elevate" data-testid="card-recebidas">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Notas Recebidas
                </CardTitle>
                <ArrowDownRight className="w-5 h-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recebidas}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalXmls > 0
                  ? `${((stats.recebidas / stats.totalXmls) * 100).toFixed(0)}% do total`
                  : "Nenhum XML processado"}
              </p>
            </CardContent>
          </Card>

          {/* Total Impostos */}
          <Card className="hover-elevate" data-testid="card-impostos">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Impostos
                </CardTitle>
                <Receipt className="w-5 h-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.totalImpostos)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                De {formatCurrency(stats.totalNotas)} em notas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alertas e Charts */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Alertas */}
          <AlertsCard />

          {/* Charts */}
          <div className="lg:col-span-2 grid gap-6 lg:grid-cols-2">
          {/* Pie Chart */}
          <Card data-testid="chart-distribution">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Distribuição de Notas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.totalXmls > 0 && pieData ? (
                <div className="flex items-center justify-center" style={{ height: "300px" }}>
                  <Pie
                    data={pieData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: "bottom",
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum dado para exibir</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Faça upload de XMLs para ver a distribuição
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line Chart */}
          <Card data-testid="chart-volume">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Volume dos Últimos 7 Dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lineData ? (
                <div style={{ height: "300px" }}>
                  <Line
                    data={lineData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            stepSize: 1,
                          },
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </div>

        {/* Recent XMLs */}
        <Card data-testid="table-recent-xmls">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">XMLs Recentes</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/xmls")}
                data-testid="button-view-all"
              >
                Ver todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentXmls.length > 0 ? (
              <div className="space-y-3">
                {stats.recentXmls.map((xml: any) => (
                  <div
                    key={xml.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover-elevate cursor-pointer"
                    onClick={() => setLocation(`/xmls`)}
                    data-testid={`recent-xml-${xml.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {xml.tipoDoc}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              xml.categoria === "emitida"
                                ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                                : "bg-purple-50 text-purple-700 border-purple-200 text-xs"
                            }
                          >
                            {xml.categoria}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {xml.razaoSocialDestinatario || "Destinatário não especificado"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(parseFloat(xml.totalNota || "0"))}</p>
                      <p className="text-xs text-muted-foreground">
                        {xml.dataEmissao}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Nenhum XML processado</h3>
                <p className="text-muted-foreground mt-1 mb-4">
                  Comece fazendo upload de arquivos XML
                </p>
                <Button onClick={() => setLocation("/upload")}>
                  <Upload className="w-4 h-4 mr-2" />
                  Fazer Upload
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
