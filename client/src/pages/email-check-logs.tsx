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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, CheckCircle2, XCircle, Copy, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmailCheckLog {
  id: string;
  emailMonitorId: string;
  emailAddress: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  emailsChecked: number;
  xmlsFound: number;
  xmlsProcessed: number;
  xmlsDuplicated: number;
  errorMessage: string | null;
  errorDetails: string | null;
  triggeredBy: string;
  createdAt: string;
  companyId: string | null;
  companyName: string | null;
}

interface EmailMonitor {
  id: string;
  email: string;
  companyId: string;
}

export default function EmailCheckLogs() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMonitor, setFilterMonitor] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<EmailCheckLog | null>(null);
  const [copiedDetails, setCopiedDetails] = useState(false);

  // Fetch email monitors for filter (apenas admin - funcionalidade global)
  const { data: monitors = [] } = useQuery<EmailMonitor[]>({
    queryKey: ["email-monitors-all"],
    queryFn: async () => {
      if (!user || user.role !== "admin") return [];
      
      // Admin vê todos os monitores (funcionalidade global)
      const res = await fetch("/api/email-monitors", {
        headers: getAuthHeader(),
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && user.role === "admin",
  });

  // Fetch email check logs
  const { data: logs = [], isLoading } = useQuery<EmailCheckLog[]>({
    queryKey: ["email-check-logs", filterStatus, filterMonitor, filterDateFrom, filterDateTo],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filterStatus !== "all") {
        params.append("status", filterStatus);
      }

      if (filterMonitor !== "all") {
        params.append("emailMonitorId", filterMonitor);
      }

      if (filterDateFrom) {
        params.append("dateFrom", filterDateFrom);
      }

      if (filterDateTo) {
        params.append("dateTo", filterDateTo);
      }

      const res = await fetch(`/api/email-check-logs?${params.toString()}`, {
        headers: getAuthHeader(),
      });

      if (!res.ok) throw new Error("Erro ao carregar logs");
      return res.json();
    },
  });

  // Calcular estatísticas
  const stats = {
    total: logs.length,
    success: logs.filter(log => log.status === "success").length,
    error: logs.filter(log => log.status === "error").length,
    totalXmlsProcessed: logs.reduce((acc, log) => acc + log.xmlsProcessed, 0),
    totalEmailsChecked: logs.reduce((acc, log) => acc + log.emailsChecked, 0),
    avgDuration: logs.filter(log => log.durationMs).length > 0
      ? Math.round(
          logs
            .filter(log => log.durationMs)
            .reduce((acc, log) => acc + (log.durationMs || 0), 0) /
          logs.filter(log => log.durationMs).length
        )
      : 0,
  };

  const handleCopyLog = async (log: EmailCheckLog) => {
    const logText = `
=== LOG DE VERIFICAÇÃO DE EMAIL ===
Email: ${log.emailAddress}
Empresa: ${log.companyName || "N/A"}
Status: ${log.status === "success" ? "✅ Sucesso" : "❌ Erro"}
Data/Hora Início: ${format(new Date(log.startedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
Data/Hora Fim: ${log.finishedAt ? format(new Date(log.finishedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : "N/A"}
Duração: ${log.durationMs ? `${(log.durationMs / 1000).toFixed(2)}s` : "N/A"}
Emails Verificados: ${log.emailsChecked}
XMLs Encontrados: ${log.xmlsFound}
XMLs Processados: ${log.xmlsProcessed}
XMLs Duplicados: ${log.xmlsDuplicated}
Acionado por: ${log.triggeredBy}
${log.errorMessage ? `Erro: ${log.errorMessage}` : ""}
${log.errorDetails ? `Detalhes: ${log.errorDetails}` : ""}
    `.trim();

    try {
      await navigator.clipboard.writeText(logText);
      setCopiedId(log.id);
      toast({
        title: "Log copiado!",
        description: "O log foi copiado para a área de transferência.",
      });
      
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o log.",
        variant: "destructive",
      });
    }
  };

  const handleCopyDetails = async () => {
    if (!selectedLog) return;
    const details = selectedLog.errorDetails || selectedLog.errorMessage || "";
    if (!details) return;

    try {
      await navigator.clipboard.writeText(details);
      setCopiedDetails(true);
      toast({
        title: "Detalhes copiados!",
        description: "Os detalhes do erro foram copiados.",
      });
      setTimeout(() => setCopiedDetails(false), 2000);
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar os detalhes.",
        variant: "destructive",
      });
    }
  };

  const handleClearFilters = () => {
    setFilterStatus("all");
    setFilterMonitor("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs de Verificação de Email</h1>
          <p className="text-muted-foreground mt-2">
            Histórico detalhado de todas as tentativas de leitura de email (IMAP)
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total de Verificações</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Bem-sucedidas</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.success}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Com Erro</CardDescription>
              <CardTitle className="text-3xl text-red-600">{stats.error}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total de Emails</CardDescription>
              <CardTitle className="text-3xl">{stats.totalEmailsChecked}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>XMLs Processados</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{stats.totalXmlsProcessed}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Duração Média</CardDescription>
              <CardTitle className="text-3xl">
                {stats.avgDuration > 0 ? `${(stats.avgDuration / 1000).toFixed(1)}s` : "N/A"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtre os logs por diferentes critérios</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="success">Sucesso</SelectItem>
                    <SelectItem value="error">Erro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Email Monitor</Label>
                <Select value={filterMonitor} onValueChange={setFilterMonitor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {monitors.map((monitor) => (
                      <SelectItem key={monitor.id} value={monitor.id}>
                        {monitor.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={handleClearFilters}>
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Histórico de Verificações
            </CardTitle>
            <CardDescription>
              {logs.length} log(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum log encontrado.</p>
                <p className="text-sm mt-2">
                  Os logs são criados quando você testa a conexão de um monitor de email ou quando o sistema verifica automaticamente.
                </p>
              </div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead className="text-center">Emails</TableHead>
                      <TableHead className="text-center">XMLs</TableHead>
                      <TableHead>Acionado por</TableHead>
                      <TableHead>Erro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {log.status === "success" ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Sucesso
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Erro
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{log.emailAddress}</TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate" title={log.companyName || "N/A"}>
                            {log.companyName || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(log.startedAt), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(log.startedAt), "HH:mm:ss", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.durationMs ? (
                            <span className="text-sm">
                              {(log.durationMs / 1000).toFixed(2)}s
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="font-medium">{log.emailsChecked}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-0.5">
                            <div className="text-xs text-green-600">
                              {log.xmlsProcessed} ok
                            </div>
                            {log.xmlsFound > 0 && (
                              <div className="text-xs text-blue-600">
                                {log.xmlsFound} total
                              </div>
                            )}
                            {log.xmlsDuplicated > 0 && (
                              <div className="text-xs text-orange-600">
                                {log.xmlsDuplicated} dup
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {log.triggeredBy}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.errorMessage || log.errorDetails ? (
                            <div className="flex items-center gap-2 max-w-[220px]">
                              <span className="truncate text-xs text-red-600" title={log.errorMessage || "Detalhes disponíveis"}>
                                {log.errorMessage || "Detalhes disponíveis"}
                              </span>
                              {(log.errorDetails || log.errorMessage) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setSelectedLog(log)}
                                  className="h-6 w-6 text-red-600"
                                  aria-label="Ver detalhes do erro"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyLog(log)}
                            className="gap-2"
                          >
                            {copiedId === log.id ? (
                              <>
                                <Check className="h-4 w-4" />
                                Copiado!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copiar
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={!!selectedLog}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLog(null);
            setCopiedDetails(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Erro</DialogTitle>
            <DialogDescription>
              {selectedLog?.emailAddress} • {selectedLog?.companyName || "N/A"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Mensagem</span>
              <div className="rounded-md border bg-muted/40 p-3 text-red-700">
                {selectedLog?.errorMessage || "Sem mensagem de erro"}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Detalhes técnicos</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyDetails}
                  disabled={!selectedLog?.errorDetails && !selectedLog?.errorMessage}
                >
                  {copiedDetails ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar detalhes
                    </>
                  )}
                </Button>
              </div>
              <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 whitespace-pre-wrap">
                {selectedLog?.errorDetails || "Sem detalhes técnicos"}
              </pre>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <span>Emails verificados: {selectedLog?.emailsChecked ?? 0}</span>
              <span>XMLs encontrados: {selectedLog?.xmlsFound ?? 0}</span>
              <span>XMLs processados: {selectedLog?.xmlsProcessed ?? 0}</span>
              <span>XMLs duplicados: {selectedLog?.xmlsDuplicated ?? 0}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}






