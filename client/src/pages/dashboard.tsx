import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  // Mock data for charts
  const pieData = {
    labels: ["NFe Emitidas", "NFe Recebidas", "NFCe"],
    datasets: [
      {
        data: [45, 35, 20],
        backgroundColor: [
          "hsl(142, 71%, 45%)",
          "hsl(217, 91%, 48%)",
          "hsl(195, 85%, 42%)",
        ],
        borderWidth: 0,
      },
    ],
  };

  const lineData = {
    labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"],
    datasets: [
      {
        label: "Volume de XMLs",
        data: [120, 190, 150, 280, 220, 310],
        borderColor: "hsl(142, 71%, 45%)",
        backgroundColor: "hsl(142, 71%, 45%, 0.1)",
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  const recentXmls = [
    {
      id: "1",
      tipo: "NFe",
      data: "2024-11-01",
      destinatario: "Cliente ABC Ltda",
      total: "R$ 15.450,00",
      status: "valido",
    },
    {
      id: "2",
      tipo: "NFCe",
      data: "2024-11-01",
      destinatario: "Consumidor Final",
      total: "R$ 89,90",
      status: "valido",
    },
    {
      id: "3",
      tipo: "NFe",
      data: "2024-10-31",
      destinatario: "Empresa XYZ SA",
      total: "R$ 32.100,00",
      status: "valido",
    },
    {
      id: "4",
      tipo: "NFe",
      data: "2024-10-31",
      destinatario: "Fornecedor 123",
      total: "R$ 8.750,00",
      status: "invalido",
    },
    {
      id: "5",
      tipo: "NFe",
      data: "2024-10-30",
      destinatario: "Partner Corp",
      total: "R$ 22.450,00",
      status: "valido",
    },
  ];

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
            <Button variant="outline" data-testid="button-send-accountant">
              <Send className="w-4 h-4 mr-2" />
              Enviar para Contador
            </Button>
            <Button data-testid="button-upload-batch">
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
              <div className="text-2xl font-bold" data-testid="text-total-xmls">1.270</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3 text-primary" />
                <span className="text-primary">+12.5%</span> vs mês anterior
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Notas do Mês
              </CardTitle>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-month-xmls">310</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3 text-primary" />
                <span className="text-primary">+8.2%</span> vs média
              </p>
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
              <div className="text-2xl font-bold text-primary" data-testid="text-valid-xmls">
                305
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                98.4% conformidade
              </p>
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
              <div className="text-2xl font-bold text-destructive" data-testid="text-alerts">
                5
              </div>
              <p className="text-xs text-destructive mt-1">
                XMLs com inconsistências
              </p>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Volume por Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <Line data={lineData} options={chartOptions} />
              </div>
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
                  {recentXmls.map((xml) => (
                    <tr
                      key={xml.id}
                      className="border-b hover-elevate cursor-pointer"
                      data-testid={`row-xml-${xml.id}`}
                    >
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="font-mono">
                          {xml.tipo}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm">{xml.data}</td>
                      <td className="px-6 py-4 text-sm">
                        {xml.destinatario}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium tabular-nums">
                        {xml.total}
                      </td>
                      <td className="px-6 py-4">
                        {xml.status === "valido" ? (
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
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
