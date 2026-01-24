import { useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeader, useAuthStore } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Timer, PlayCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MonitorRunLog {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
}

type RunDetails = {
  totalMonitors?: number;
  executed?: number;
  skipped?: number;
  successful?: number;
  failed?: number;
  failures?: Array<{
    monitorId?: string;
    email?: string;
    success?: boolean;
    message?: string;
    errors?: Array<{
      stage?: string;
      message?: string;
      emailUid?: number;
      filename?: string;
    }>;
  }>;
  error?: string;
  stack?: string;
};

export default function EmailMonitorRuns() {
  const { user } = useAuthStore();
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [selectedRun, setSelectedRun] = useState<MonitorRunLog | null>(null);

  const { data: runs = [], isLoading } = useQuery<MonitorRunLog[]>({
    queryKey: ["email-monitor-runs", filterDateFrom, filterDateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterDateFrom) params.append("dateFrom", filterDateFrom);
      if (filterDateTo) params.append("dateTo", filterDateTo);

      const res = await fetch(`/api/email-monitor-runs?${params.toString()}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Erro ao carregar histórico");
      return res.json();
    },
    enabled: !!user && user.role === "admin",
  });

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch {
      return "Data inválida";
    }
  };

  const parseDetails = (details: string | null): RunDetails => {
    if (!details) return {};
    try {
      return JSON.parse(details);
    } catch {
      return {};
    }
  };

  const hasDetails = (details?: RunDetails) => {
    if (!details) return false;
    if (details.error || details.stack) return true;
    if (details.failures && details.failures.length > 0) return true;
    return false;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Histórico de Agendamentos</h1>
          <p className="text-muted-foreground mt-2">
            Execuções automáticas e manuais do monitoramento de email
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtre por período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilterDateFrom("");
                    setFilterDateTo("");
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Execuções
            </CardTitle>
            <CardDescription>{runs.length} execução(ões) encontrada(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : runs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <PlayCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum agendamento encontrado.</p>
              </div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead className="text-center">Executados</TableHead>
                      <TableHead className="text-center">Pulados</TableHead>
                      <TableHead className="text-center">Sucesso</TableHead>
                      <TableHead className="text-center">Falhas</TableHead>
                      <TableHead className="text-right">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => {
                      const details = parseDetails(run.details);
                      const isManual = run.action === "email_monitor_run_now";
                      return (
                        <TableRow key={run.id}>
                          <TableCell>
                            {isManual ? (
                              <Badge variant="outline" className="text-xs">
                                Manual
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-600 text-xs">Agendado</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDateTime(run.createdAt)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {run.userName || run.userEmail || run.userId}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {details.executed ?? 0}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {details.skipped ?? 0}
                          </TableCell>
                          <TableCell className="text-center text-sm text-green-600">
                            {details.successful ?? 0}
                          </TableCell>
                          <TableCell className="text-center text-sm text-red-600">
                            {details.failed ?? 0}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedRun(run)}
                              disabled={!hasDetails(details)}
                              title={hasDetails(details) ? "Ver detalhes" : "Sem detalhes"}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={!!selectedRun}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRun(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Execução</DialogTitle>
            <DialogDescription>
              {selectedRun?.userName || selectedRun?.userEmail || selectedRun?.userId} •{" "}
              {selectedRun ? formatDateTime(selectedRun.createdAt) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {selectedRun ? (
              (() => {
                const details = parseDetails(selectedRun.details);
                if (!hasDetails(details)) {
                  return (
                    <div className="rounded-md border bg-muted/40 p-3 text-muted-foreground">
                      Sem detalhes disponíveis.
                    </div>
                  );
                }
                return (
                  <>
                    {details.error && (
                      <div className="rounded-md border bg-red-50 p-3 text-red-700">
                        {details.error}
                      </div>
                    )}
                    {details.failures && details.failures.length > 0 && (
                      <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                        {details.failures.map((failure, index) => (
                          <div key={`${failure.monitorId}-${index}`} className="text-xs">
                            <div className="font-semibold text-red-700">
                              {failure.email || failure.monitorId || "Monitor"}: {failure.message || "Falha"}
                            </div>
                            {failure.errors && failure.errors.length > 0 && (
                              <div className="text-muted-foreground">
                                {failure.errors[0]?.stage ? `${failure.errors[0].stage}: ` : ""}
                                {failure.errors[0]?.message || "Erro"}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {details.stack && (
                      <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 whitespace-pre-wrap text-xs">
                        {details.stack}
                      </pre>
                    )}
                  </>
                );
              })()
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
