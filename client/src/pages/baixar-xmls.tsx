import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { Company } from "@shared/schema";
import { Calendar, Download, FileText, Loader2, AlertCircle, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FormData {
  periodStart: string;
  periodEnd: string;
}

interface DownloadHistoryItem {
  id: string;
  periodStart: string;
  periodEnd: string;
  includeNfe: boolean;
  includeNfce: boolean;
  includeEvents: boolean;
  status: string;
  currentStage?: string | null;
  lastMessage?: string | null;
  progressUpdatedAt?: string | null;
  errorMessage?: string | null;
  errorDetails?: string | null;
  errorStack?: string | null;
  zipNfePath?: string | null;
  zipNfcePath?: string | null;
  zipEventsPath?: string | null;
  nfeCount: number;
  nfceCount: number;
  eventCount: number;
  createdAt: string;
  userName?: string;
  userEmail?: string;
}

export default function BaixarXmls() {
  const { toast } = useToast();
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<DownloadHistoryItem | null>(null);
  const [includeNfe, setIncludeNfe] = useState(true);
  const [includeNfce, setIncludeNfce] = useState(true);
  const [includeEvents, setIncludeEvents] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    setValue,
  } = useForm<FormData>();

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await fetch("/api/companies", {
        headers: getAuthHeader(),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar empresas");
      return response.json();
    },
  });

  const selectedCompany = companies?.find((c) => c.id === currentCompanyId);

  const loadHistory = async () => {
    if (!currentCompanyId) return;
    const response = await fetch(`/api/xml-downloads/history?companyId=${currentCompanyId}`, {
      headers: getAuthHeader(),
      credentials: "include",
    });
    if (!response.ok) throw new Error("Erro ao carregar histórico");
    const data = await response.json();
    setHistory(data);
  };

  useEffect(() => {
    if (currentCompanyId) {
      loadHistory().catch(() => {});
    }
  }, [currentCompanyId]);

  useEffect(() => {
    const hasProcessing = history.some((item) => item.status === "processing");
    if (!hasProcessing) return;
    const interval = setInterval(() => {
      loadHistory().catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [history]);

  useEffect(() => {
    if (!currentCompanyId) return;
    const { periodStart, periodEnd } = getValues();
    if (periodStart || periodEnd) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    const toDateInput = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    setValue("periodStart", toDateInput(start));
    setValue("periodEnd", toDateInput(end));
  }, [currentCompanyId, getValues, setValue]);

  const onSubmit = async (data: FormData) => {
    if (!currentCompanyId) {
      toast({
        title: "Atenção",
        description: "Selecione uma empresa antes de baixar",
        variant: "destructive",
      });
      return;
    }
    if (!includeNfe && !includeNfce && !includeEvents) {
      toast({
        title: "Seleção obrigatória",
        description: "Selecione ao menos um tipo para download",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/xml-downloads/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        credentials: "include",
        body: JSON.stringify({
          companyId: currentCompanyId,
          ...data,
          includeNfe,
          includeNfce,
          includeEvents,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Erro ao iniciar download");
      }
      toast({
        title: "Download iniciado",
        description: "O processamento ocorrerá em segundo plano",
      });
      await loadHistory();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao iniciar download",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!selectedCompany) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
              <h2 className="text-2xl font-bold mb-2">Empresa não selecionada</h2>
              <p className="text-muted-foreground">
                Selecione uma empresa no menu superior para baixar XMLs.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Download de XMLs</h1>
          <p className="text-muted-foreground">
            Baixe XMLs por período, separados por NFe, NFCe e eventos.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Gerar ZIPs
            </CardTitle>
            <CardDescription>Selecione o período e o tipo de XML</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="periodStart" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Data Inicial
                  </Label>
                  <Input
                    id="periodStart"
                    type="date"
                    {...register("periodStart", { required: "Data inicial é obrigatória" })}
                    className={errors.periodStart ? "border-red-500" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodEnd" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Data Final
                  </Label>
                  <Input
                    id="periodEnd"
                    type="date"
                    {...register("periodEnd", { required: "Data final é obrigatória" })}
                    className={errors.periodEnd ? "border-red-500" : ""}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={includeNfe} onCheckedChange={(val) => setIncludeNfe(!!val)} />
                  NFe
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={includeNfce} onCheckedChange={(val) => setIncludeNfce(!!val)} />
                  NFCe
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={includeEvents} onCheckedChange={(val) => setIncludeEvents(!!val)} />
                  Eventos
                </label>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Gerar ZIPs
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Histórico de Downloads
            </CardTitle>
            <CardDescription>Downloads por período</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum download realizado ainda
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>NFe</TableHead>
                      <TableHead>NFCe</TableHead>
                      <TableHead>Eventos</TableHead>
                      <TableHead>Downloads</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead className="text-right">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant={item.status === "success" ? "default" : item.status === "processing" ? "outline" : "destructive"}>
                            {item.status === "processing" ? "Processando" : item.status === "success" ? "Sucesso" : "Falha"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(item.periodStart)} até {formatDate(item.periodEnd)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.currentStage || "—"}
                          {item.lastMessage && (
                            <div className="truncate max-w-[220px]" title={item.lastMessage}>
                              {item.lastMessage}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{item.nfeCount}</TableCell>
                        <TableCell>{item.nfceCount}</TableCell>
                        <TableCell>{item.eventCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.zipNfePath && (
                              <Button asChild variant="ghost" size="sm">
                                <a href={item.zipNfePath} target="_blank" rel="noreferrer">
                                  NFe
                                </a>
                              </Button>
                            )}
                            {item.zipNfcePath && (
                              <Button asChild variant="ghost" size="sm">
                                <a href={item.zipNfcePath} target="_blank" rel="noreferrer">
                                  NFCe
                                </a>
                              </Button>
                            )}
                            {item.zipEventsPath && (
                              <Button asChild variant="ghost" size="sm">
                                <a href={item.zipEventsPath} target="_blank" rel="noreferrer">
                                  Eventos
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(item.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(item.errorDetails || item.errorStack) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setSelectedHistory(item)}
                              title="Ver detalhes"
                            >
                              <Info className="w-3 h-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedHistory} onOpenChange={(open) => !open && setSelectedHistory(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes do download</DialogTitle>
              <DialogDescription>Informações técnicas do processamento</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              {selectedHistory?.errorMessage && (
                <div>
                  <div className="font-medium">Erro</div>
                  <div className="text-muted-foreground">{selectedHistory.errorMessage}</div>
                </div>
              )}
              {selectedHistory?.errorDetails && (
                <div>
                  <div className="font-medium">Detalhes</div>
                  <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                    {selectedHistory.errorDetails}
                  </pre>
                </div>
              )}
              {selectedHistory?.errorStack && (
                <div>
                  <div className="font-medium">Stack</div>
                  <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                    {selectedHistory.errorStack}
                  </pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
