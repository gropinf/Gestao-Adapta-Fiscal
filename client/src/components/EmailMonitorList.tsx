import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Plus, Edit, Trash2, Loader2, CheckCircle2, XCircle, TestTube, Info, PlayCircle, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmailMonitor {
  id: string;
  companyId: string;
  email: string;
  host: string;
  port: number;
  ssl: boolean;
  active: boolean;
  deleteAfterProcess: boolean;
  monitorSince: string | null;
  lastCheckedAt: string | null;
  lastEmailId: string | null;
  checkIntervalMinutes: number;
  createdAt: string;
}

interface ScheduleSettings {
  enabled: boolean;
}

// Monitor de email é funcionalidade global (não vinculada a empresa)
export function EmailMonitorList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<EmailMonitor | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState<string | null>(null);
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [isTogglingSchedule, setIsTogglingSchedule] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    host: "imap.gmail.com",
    port: 993,
    ssl: true,
    deleteAfterProcess: false,
    monitorSince: "", // Data inicial para monitoramento
    checkIntervalMinutes: 15, // Intervalo padrão: 15 minutos
  });

  // Fetch email monitors (todos - funcionalidade global)
  const { data: monitors = [], isLoading } = useQuery<EmailMonitor[]>({
    queryKey: ["email-monitors"],
    queryFn: async () => {
      const res = await fetch(`/api/email-monitors`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Erro ao carregar monitores de email");
      return res.json();
    },
  });

  const { data: scheduleSettings } = useQuery<ScheduleSettings>({
    queryKey: ["email-monitor-schedule"],
    queryFn: async () => {
      const res = await fetch("/api/email-monitor-schedule", {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Erro ao carregar configuração do agendamento");
      return res.json();
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        // companyId removido - monitor é global
        email: data.email,
        password: data.password,
        host: data.host,
        port: data.port,
        ssl: data.ssl,
        deleteAfterProcess: data.deleteAfterProcess,
        monitorSince: data.monitorSince || null,
        checkIntervalMinutes: data.checkIntervalMinutes,
      };
      
      // Verificar se email já existe antes de enviar
      const normalizedEmail = data.email.toLowerCase().trim();
      const existingMonitor = monitors.find(m => m.email.toLowerCase().trim() === normalizedEmail);
      if (existingMonitor) {
        throw new Error(`O email ${normalizedEmail} já está cadastrado em outro monitor.`);
      }

      const res = await fetch("/api/email-monitors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || "Erro ao criar monitor");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-monitors"] });
      setIsAddDialogOpen(false);
      setShowPassword(false);
      resetForm();
      toast({
        title: "Monitor criado!",
        description: "Monitor de email cadastrado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      // Se email está sendo alterado, verificar se não existe em outro monitor
      if (data.email) {
        const normalizedEmail = data.email.toLowerCase().trim();
        const existingMonitor = monitors.find(
          m => m.email.toLowerCase().trim() === normalizedEmail && m.id !== id
        );
        if (existingMonitor) {
          throw new Error(`O email ${normalizedEmail} já está cadastrado em outro monitor.`);
        }
      }

      const res = await fetch(`/api/email-monitors/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || "Erro ao atualizar monitor");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-monitors"] });
      setIsEditDialogOpen(false);
      setSelectedMonitor(null);
      setShowEditPassword(false);
      resetForm();
      toast({
        title: "Monitor atualizado!",
        description: "Monitor de email atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/email-monitors/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Erro ao deletar monitor");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-monitors"] });
      setIsDeleteDialogOpen(false);
      setSelectedMonitor(null);
      toast({
        title: "Monitor removido!",
        description: "Monitor de email removido com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle active
  const handleToggleActive = async (monitor: EmailMonitor) => {
    try {
      await updateMutation.mutateAsync({
        id: monitor.id,
        data: { active: !monitor.active },
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Test connection
  const handleTestConnection = async (id: string) => {
    setIsTesting(id);
    try {
      const res = await fetch(`/api/email-monitors/${id}/test`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      const result = await res.json();
      
      if (res.ok) {
        toast({
          title: "Teste de conexão",
          description: result.message,
        });
      } else {
        toast({
          title: "Erro no teste",
          description: result.error || "Falha ao testar conexão",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao testar conexão",
        variant: "destructive",
      });
    } finally {
      setIsTesting(null);
    }
  };

  // Check emails now (manual verification)
  const handleCheckNow = async (id: string, email: string) => {
    setIsChecking(id);
    try {
      const res = await fetch(`/api/email-monitors/${id}/check`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      const result = await res.json();
      
      if (res.ok) {
        const { data } = result;
        toast({
          title: "✅ Verificação concluída!",
          description: `${data.emailsChecked} email(s) verificado(s), ${data.xmlsProcessed} XML(s) baixado(s)${data.xmlsDuplicated > 0 ? `, ${data.xmlsDuplicated} duplicado(s)` : ''}`,
          duration: 5000,
        });
        
        // Recarregar lista de monitores para atualizar "Última Verificação"
        queryClient.invalidateQueries({ queryKey: ["email-monitors"] });
      } else {
        toast({
          title: "Erro na verificação",
          description: result.error || result.message || "Falha ao verificar emails",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao verificar emails",
        variant: "destructive",
      });
    } finally {
      setIsChecking(null);
    }
  };

  const handleCheckAllNow = async () => {
    setIsCheckingAll(true);
    try {
      const res = await fetch(`/api/email-monitors/run-now`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      const result = await res.json();

      if (res.ok) {
        const { data } = result;
        toast({
          title: "✅ Verificação geral concluída!",
          description: `Executados: ${data.executed}, pulados: ${data.skipped}, sucesso: ${data.successful}, falhas: ${data.failed}`,
          duration: 6000,
        });
        queryClient.invalidateQueries({ queryKey: ["email-monitors"] });
      } else {
        toast({
          title: "Erro na verificação geral",
          description: result.error || result.message || "Falha ao verificar monitores",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao verificar monitores",
        variant: "destructive",
      });
    } finally {
      setIsCheckingAll(false);
    }
  };

  const handleToggleSchedule = async (enabled: boolean) => {
    setIsTogglingSchedule(true);
    try {
      const res = await fetch("/api/email-monitor-schedule", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ enabled }),
      });

      const result = await res.json();

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["email-monitor-schedule"] });
        toast({
          title: enabled ? "Agendamento ativado" : "Agendamento desativado",
          description: enabled
            ? "O monitoramento automático foi reativado."
            : "O monitoramento automático foi pausado.",
        });
      } else {
        toast({
          title: "Erro ao atualizar agendamento",
          description: result.error || "Falha ao atualizar configuração",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar configuração",
        variant: "destructive",
      });
    } finally {
      setIsTogglingSchedule(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      host: "imap.gmail.com",
      port: 993,
      ssl: true,
      deleteAfterProcess: false,
      monitorSince: "",
      checkIntervalMinutes: 15,
    });
  };

  const handleEdit = (monitor: EmailMonitor) => {
    setSelectedMonitor(monitor);
    setFormData({
      email: monitor.email,
      password: "",
      host: monitor.host,
      port: monitor.port,
      ssl: monitor.ssl,
      deleteAfterProcess: monitor.deleteAfterProcess,
      monitorSince: monitor.monitorSince ? monitor.monitorSince.split('T')[0] : "", // Format para input date
      checkIntervalMinutes: monitor.checkIntervalMinutes,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (monitor: EmailMonitor) => {
    setSelectedMonitor(monitor);
    setIsDeleteDialogOpen(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "Data inválida";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2">Carregando monitores...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Monitores de Email</h3>
          <p className="text-sm text-muted-foreground">
            Configure contas de email para download automático de XMLs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border rounded-md px-3 py-1.5 text-sm">
            <span className="text-muted-foreground">Agendamento</span>
            <Switch
              checked={scheduleSettings?.enabled ?? true}
              onCheckedChange={handleToggleSchedule}
              disabled={isTogglingSchedule}
            />
          </div>
          <Button
            variant="outline"
            onClick={handleCheckAllNow}
            disabled={isCheckingAll}
          >
            {isCheckingAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-4 w-4" />
                Rodar Agora
              </>
            )}
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Email
          </Button>
        </div>
      </div>

      {/* Table */}
      {monitors.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum monitor cadastrado</p>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            Adicionar Primeiro Monitor
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Porta</TableHead>
                <TableHead>SSL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Monitorar Desde</TableHead>
                <TableHead>Intervalo</TableHead>
                <TableHead>Última Verificação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monitors.map((monitor) => (
                <TableRow key={monitor.id}>
                  <TableCell className="font-medium">{monitor.email}</TableCell>
                  <TableCell>{monitor.host}</TableCell>
                  <TableCell>{monitor.port}</TableCell>
                  <TableCell>
                    {monitor.ssl ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Sim
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Não</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={monitor.active}
                        onCheckedChange={() => handleToggleActive(monitor)}
                      />
                      <span className="text-sm">
                        {monitor.active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {monitor.monitorSince 
                      ? format(new Date(monitor.monitorSince), "dd/MM/yyyy", { locale: ptBR })
                      : "Todos"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {monitor.checkIntervalMinutes} min
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(monitor.lastCheckedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCheckNow(monitor.id, monitor.email)}
                        disabled={isChecking === monitor.id || !monitor.active}
                        title={!monitor.active ? "Ative o monitor primeiro" : "Verificar emails agora"}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        {isChecking === monitor.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlayCircle className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestConnection(monitor.id)}
                        disabled={isTesting === monitor.id}
                        title="Testar conexão IMAP"
                      >
                        {isTesting === monitor.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(monitor)}
                        title="Editar monitor"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(monitor)}
                        title="Deletar monitor"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) {
          setShowPassword(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Monitor de Email</DialogTitle>
            <DialogDescription>
              Configure uma conta de email para monitoramento automático
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Configurações IMAP Comuns:</strong><br/>
                <span className="font-mono text-xs">
                  Gmail: imap.gmail.com:993 (SSL)<br/>
                  Outlook: outlook.office365.com:993 (SSL)
                </span>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword(!showPassword);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Gmail: Use "Senha de App" (não a senha normal)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">Host IMAP *</Label>
                <Input
                  id="host"
                  placeholder="imap.gmail.com"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  ⚠️ Use IMAP (não SMTP). Gmail: imap.gmail.com
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="port">Porta *</Label>
                <Input
                  id="port"
                  type="number"
                  placeholder="993"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  993 (SSL) ou 143 (sem SSL)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="ssl"
                checked={formData.ssl}
                onCheckedChange={(checked) => setFormData({ ...formData, ssl: checked })}
              />
              <Label htmlFor="ssl">Usar SSL/TLS</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="deleteAfterProcess"
                checked={formData.deleteAfterProcess}
                onCheckedChange={(checked) => setFormData({ ...formData, deleteAfterProcess: checked })}
              />
              <Label htmlFor="deleteAfterProcess">Deletar email após processar</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monitorSince">Monitorar A Partir De (opcional)</Label>
              <Input
                id="monitorSince"
                type="date"
                value={formData.monitorSince}
                onChange={(e) => setFormData({ ...formData, monitorSince: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Emails anteriores a esta data serão ignorados. Deixe em branco para processar todos os emails.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkInterval">Intervalo de Verificação (minutos)</Label>
              <Input
                id="checkInterval"
                type="number"
                min="5"
                max="1440"
                value={formData.checkIntervalMinutes}
                onChange={(e) => setFormData({ ...formData, checkIntervalMinutes: parseInt(e.target.value) || 15 })}
              />
              <p className="text-xs text-muted-foreground">
                Com que frequência verificar por novos emails (recomendado: 15-30 minutos)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddDialogOpen(false);
              setShowPassword(false);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setShowEditPassword(false);
          setSelectedMonitor(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Monitor de Email</DialogTitle>
            <DialogDescription>
              Atualize as configurações do monitor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Configurações IMAP Comuns:</strong><br/>
                <span className="font-mono text-xs">
                  Gmail: imap.gmail.com:993 (SSL)<br/>
                  Outlook: outlook.office365.com:993 (SSL)
                </span>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-password">Nova Senha (deixe em branco para manter)</Label>
              <div className="relative">
                <Input
                  id="edit-password"
                  type={showEditPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowEditPassword(!showEditPassword);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50"
                  tabIndex={-1}
                  aria-label={showEditPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showEditPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-host">Host IMAP *</Label>
                <Input
                  id="edit-host"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  ⚠️ Use IMAP (não SMTP). Gmail: imap.gmail.com
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-port">Porta *</Label>
                <Input
                  id="edit-port"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  993 (SSL) ou 143 (sem SSL)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-ssl"
                checked={formData.ssl}
                onCheckedChange={(checked) => setFormData({ ...formData, ssl: checked })}
              />
              <Label htmlFor="edit-ssl">Usar SSL/TLS</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-deleteAfterProcess"
                checked={formData.deleteAfterProcess}
                onCheckedChange={(checked) => setFormData({ ...formData, deleteAfterProcess: checked })}
              />
              <Label htmlFor="edit-deleteAfterProcess">Deletar email após processar</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-monitorSince">Monitorar A Partir De (opcional)</Label>
              <Input
                id="edit-monitorSince"
                type="date"
                value={formData.monitorSince}
                onChange={(e) => setFormData({ ...formData, monitorSince: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Emails anteriores a esta data serão ignorados.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-checkInterval">Intervalo de Verificação (minutos)</Label>
              <Input
                id="edit-checkInterval"
                type="number"
                min="5"
                max="1440"
                value={formData.checkIntervalMinutes}
                onChange={(e) => setFormData({ ...formData, checkIntervalMinutes: parseInt(e.target.value) || 15 })}
              />
              <p className="text-xs text-muted-foreground">
                Com que frequência verificar por novos emails (recomendado: 15-30 minutos)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setShowEditPassword(false);
              setSelectedMonitor(null);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedMonitor) {
                  const updateData: any = {
                    email: formData.email,
                    host: formData.host,
                    port: formData.port,
                    ssl: formData.ssl,
                    deleteAfterProcess: formData.deleteAfterProcess,
                    monitorSince: formData.monitorSince || null,
                    checkIntervalMinutes: formData.checkIntervalMinutes,
                  };
                  if (formData.password) {
                    updateData.password = formData.password;
                  }
                  
                  console.log('[Email Monitor UI] Enviando atualização:', {
                    monitorSince: updateData.monitorSince,
                    checkIntervalMinutes: updateData.checkIntervalMinutes,
                  });
                  
                  updateMutation.mutate({ id: selectedMonitor.id, data: updateData });
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Monitor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o monitor <strong>{selectedMonitor?.email}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedMonitor && deleteMutation.mutate(selectedMonitor.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removendo...
                </>
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

