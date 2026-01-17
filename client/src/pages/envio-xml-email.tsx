import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { Company } from "@shared/schema";
import { Calendar, Mail, Package, Send, CheckCircle2, XCircle, Loader2, AlertCircle, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/dashboard-layout";

interface EmailHistoryItem {
  id: string;
  destinationEmail: string;
  periodStart: string;
  periodEnd: string;
  xmlCount: number;
  zipFilename: string;
  emailSubject: string;
  status: string;
  errorMessage?: string;
  createdAt: string;
  userName: string;
  userEmail: string;
}

interface FormData {
  periodStart: string;
  periodEnd: string;
  destinationEmail: string;
}

export default function EnvioXmlEmail() {
  const { toast } = useToast();
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [history, setHistory] = useState<EmailHistoryItem[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>();

  // Busca lista de empresas do usuário
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

  // Empresa selecionada atualmente
  const selectedCompany = companies?.find((c) => c.id === currentCompanyId);
  const isEmailConfigured = Boolean(
    selectedCompany?.emailUser &&
      selectedCompany?.emailHost &&
      selectedCompany?.emailPort &&
      selectedCompany?.emailPassword
  );

  // Carrega histórico ao montar o componente ou trocar de empresa
  useEffect(() => {
    if (currentCompanyId) {
      loadHistory();
    }
  }, [currentCompanyId]);

  const loadHistory = async () => {
    if (!currentCompanyId) return;

    setLoadingHistory(true);
    try {
      const response = await fetch(
        `/api/xml-email/history?companyId=${currentCompanyId}`,
        {
          headers: getAuthHeader(),
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao carregar histórico");
      }

      const data = await response.json();
      setHistory(data);
    } catch (error: any) {
      console.error("Erro ao carregar histórico:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o histórico de envios",
        variant: "destructive",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!currentCompanyId) {
      toast({
        title: "Atenção",
        description: "Selecione uma empresa antes de enviar",
        variant: "destructive",
      });
      return;
    }
    if (!isEmailConfigured) {
      toast({
        title: "Email não configurado",
        description: "Configure o email SMTP da empresa antes de enviar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/xml-email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        credentials: "include",
        body: JSON.stringify({
          companyId: currentCompanyId,
          ...data,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao enviar XMLs");
      }

      toast({
        title: "✅ Sucesso!",
        description: `${result.data.xmlCount} XML${result.data.xmlCount !== 1 ? 's' : ''} enviado${result.data.xmlCount !== 1 ? 's' : ''} com sucesso para ${data.destinationEmail}`,
      });

      // Limpa formulário e recarrega histórico
      reset();
      loadHistory();
    } catch (error: any) {
      console.error("Erro ao enviar XMLs:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar XMLs por email",
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast({
          title: "✅ Copiado!",
          description: `${label} copiado para a área de transferência`,
        });
      },
      () => {
        toast({
          title: "Erro",
          description: "Não foi possível copiar",
          variant: "destructive",
        });
      }
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === "success") {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-300">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Sucesso
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-100 text-red-700 border-red-300">
          <XCircle className="w-3 h-3 mr-1" />
          Falha
        </Badge>
      );
    }
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
                Selecione uma empresa no menu superior para enviar XMLs por email.
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
        <h1 className="text-3xl font-bold mb-2">📧 Envio de XMLs por Email</h1>
        <p className="text-muted-foreground">
          Envie XMLs de Notas Fiscais compactados por email para contabilidade
        </p>
      </div>

      {/* Card de Envio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Enviar XMLs por Email
          </CardTitle>
          <CardDescription>
            Informe o período de emissão dos XMLs e o email de destino
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Informações da Empresa */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Empresa Selecionada
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium text-blue-700">Razão Social:</span>{" "}
                  <span className="text-blue-900">{selectedCompany.razaoSocial}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">CNPJ:</span>{" "}
                  <span className="text-blue-900">
                    {selectedCompany.cnpj.replace(
                      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                      "$1.$2.$3/$4-$5"
                    )}
                  </span>
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium text-blue-700">Email Remetente:</span>{" "}
                  <span className="text-blue-900">
                    {selectedCompany.emailUser || "Não configurado"}
                  </span>
                </div>
              </div>
            </div>
            {!isEmailConfigured && (
              <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-3 text-sm">
                Email SMTP não configurado para esta empresa. Informe host, porta, usuário e senha
                em Configurações da Empresa para habilitar o envio.
              </div>
            )}

            {/* Período de Emissão */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="periodStart" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Data Inicial
                </Label>
                <Input
                  id="periodStart"
                  type="date"
                  {...register("periodStart", {
                    required: "Data inicial é obrigatória",
                  })}
                  className={errors.periodStart ? "border-red-500" : ""}
                />
                {errors.periodStart && (
                  <p className="text-sm text-red-500">{errors.periodStart.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="periodEnd" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Data Final
                </Label>
                <Input
                  id="periodEnd"
                  type="date"
                  {...register("periodEnd", {
                    required: "Data final é obrigatória",
                  })}
                  className={errors.periodEnd ? "border-red-500" : ""}
                />
                {errors.periodEnd && (
                  <p className="text-sm text-red-500">{errors.periodEnd.message}</p>
                )}
              </div>
            </div>

            {/* Email de Destino */}
            <div className="space-y-2">
              <Label htmlFor="destinationEmail" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email de Destino
              </Label>
              <Input
                id="destinationEmail"
                type="email"
                placeholder="contabilidade@exemplo.com"
                {...register("destinationEmail", {
                  required: "Email de destino é obrigatório",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Email inválido",
                  },
                })}
                className={errors.destinationEmail ? "border-red-500" : ""}
              />
              {errors.destinationEmail && (
                <p className="text-sm text-red-500">{errors.destinationEmail.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Os XMLs das notas e os eventos serão compactados em arquivos ZIP separados
              </p>
            </div>

            {/* Botão Enviar */}
            <Button type="submit" className="w-full" disabled={loading || !isEmailConfigured}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar XMLs por Email
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Card de Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Histórico de Envios
          </CardTitle>
          <CardDescription>
            Visualize todos os envios de XMLs realizados para esta empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Nenhum envio realizado ainda para esta empresa
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Email Destino</TableHead>
                    <TableHead>XMLs</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Enviado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(item.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(item.periodStart)} até {formatDate(item.periodEnd)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]" title={item.destinationEmail}>
                            {item.destinationEmail}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(item.destinationEmail, "Email")}
                            title="Copiar email"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.xmlCount} arquivo{item.xmlCount !== 1 ? 's' : ''}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px] text-xs" title={item.zipFilename}>
                            {item.zipFilename}
                          </span>
                          {item.zipFilename && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => copyToClipboard(item.zipFilename, "Nome do arquivo")}
                              title="Copiar nome do arquivo"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{item.userName}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]" title={item.userEmail}>
                            {item.userEmail}
                          </div>
                        </div>
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
    </DashboardLayout>
  );
}

