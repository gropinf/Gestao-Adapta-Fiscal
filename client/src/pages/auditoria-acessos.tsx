import { useState, useEffect } from "react";
import { useLocation } from "wouter";
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
import { Loader2, Shield, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AccessLog {
  id: string;
  userId: string;
  companyId: string | null;
  loginAt: string | null;
  logoutAt: string | null;
  switchedCompanyAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  // Informações enriquecidas do backend
  userEmail: string | null;
  userName: string | null;
  companyName: string | null;
  companyCnpj: string | null;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
}

interface Company {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
}

export default function AuditoriaAcessos() {
  const [, setLocation] = useLocation();
  const { user } = useAuthStore();
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [filterCompanyId, setFilterCompanyId] = useState<string>("all");

  // Verificar se usuário é admin
  useEffect(() => {
    if (!user || user.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  // Fetch users for filter
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users", {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Erro ao carregar usuários");
      return res.json();
    },
  });

  // Fetch companies for filter
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await fetch("/api/companies", {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Erro ao carregar empresas");
      return res.json();
    },
  });

  // Fetch access logs
  const { data: logs = [], isLoading } = useQuery<AccessLog[]>({
    queryKey: ["audit-access-logs", filterUserId, filterCompanyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterUserId !== "all") params.append("userId", filterUserId);
      if (filterCompanyId !== "all") params.append("companyId", filterCompanyId);

      const res = await fetch(`/api/audit/access-logs?${params}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Erro ao carregar logs de acesso");
      return res.json();
    },
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch {
      return "Data inválida";
    }
  };

  const calculateDuration = (loginAt: string | null, logoutAt: string | null) => {
    if (!loginAt || !logoutAt) return "-";
    try {
      const login = new Date(loginAt);
      const logout = new Date(logoutAt);
      const diff = logout.getTime() - login.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      
      if (hours > 0) {
        return `${hours}h ${mins}min`;
      }
      return `${minutes}min`;
    } catch {
      return "-";
    }
  };

  const getEventType = (log: AccessLog) => {
    if (log.loginAt) return { type: "Login", color: "bg-blue-600" };
    if (log.logoutAt) return { type: "Logout", color: "bg-gray-600" };
    if (log.switchedCompanyAt) return { type: "Troca Empresa", color: "bg-purple-600" };
    return { type: "Desconhecido", color: "bg-gray-400" };
  };

  // Não renderizar a página se não for admin
  if (!user || user.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
                <p className="text-muted-foreground">
                  Apenas administradores podem acessar esta página.
                </p>
              </div>
            </CardContent>
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
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Auditoria de Acessos</h1>
                <p className="text-muted-foreground mt-1">
                  Histórico completo de logins, logouts e trocas de empresa
                </p>
              </div>
            </div>
          </div>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>
              Filtre os logs de acesso por usuário, empresa ou período
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filter-user">Usuário</Label>
                <Select value={filterUserId} onValueChange={setFilterUserId}>
                  <SelectTrigger id="filter-user">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Usuários</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-company">Empresa</Label>
                <Select value={filterCompanyId} onValueChange={setFilterCompanyId}>
                  <SelectTrigger id="filter-company">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Empresas</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.razaoSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2">Carregando logs...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum log de acesso encontrado</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Login</TableHead>
                      <TableHead>Logout</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead className="max-w-xs">User Agent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const eventType = getEventType(log);
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge variant="default" className={eventType.color}>
                              {eventType.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{log.userName || "N/A"}</span>
                              <span className="text-xs text-muted-foreground">{log.userEmail || ""}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.companyName ? (
                              <div className="flex flex-col">
                                <span className="font-medium">{log.companyName}</span>
                                <span className="text-xs text-muted-foreground">{log.companyCnpj || ""}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(log.loginAt)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(log.logoutAt)}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {calculateDuration(log.loginAt, log.logoutAt)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.ipAddress || "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={log.userAgent || ""}>
                            {log.userAgent || "-"}
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

        {/* Stats */}
        {logs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{logs.length}</div>
                <p className="text-xs text-muted-foreground">Total de Registros</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {logs.filter(l => l.loginAt).length}
                </div>
                <p className="text-xs text-muted-foreground">Logins</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {logs.filter(l => l.logoutAt).length}
                </div>
                <p className="text-xs text-muted-foreground">Logouts</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {logs.filter(l => l.switchedCompanyAt).length}
                </div>
                <p className="text-xs text-muted-foreground">Trocas de Empresa</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}



