import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Eye, EyeOff, Info, Loader2, Mail, Shield, Send } from "lucide-react";
import type { EmailGlobalSettings } from "@shared/schema";

interface EmailGlobalForm {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  useSsl: boolean;
  useTls: boolean;
}

export default function EmailGlobalPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: settings, isLoading } = useQuery<EmailGlobalSettings | null>({
    queryKey: ["/api/email/global"],
    enabled: isAdmin,
  });

  const [formData, setFormData] = useState<EmailGlobalForm>({
    host: "",
    port: 587,
    user: "",
    password: "",
    fromEmail: "",
    fromName: "",
    useSsl: false,
    useTls: true,
  });

  useEffect(() => {
    if (!settings) return;
    setFormData((prev) => ({
      host: settings.host || "",
      port: settings.port || 587,
      user: settings.user || "",
      password: prev.password || "",
      fromEmail: settings.fromEmail || "",
      fromName: settings.fromName || "",
      useSsl: settings.useSsl ?? false,
      useTls: settings.useTls ?? true,
    }));
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<EmailGlobalForm>) => {
      const res = await fetch("/api/email/global", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao salvar configuração");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuração salva!",
        description: "A configuração de email global foi atualizada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const dataToSend = { ...formData };
    if (!dataToSend.password && settings?.password) {
      delete (dataToSend as Partial<EmailGlobalForm>).password;
    }
    updateMutation.mutate(dataToSend);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const dataToSend = { ...formData };
      if (!dataToSend.password && settings?.password) {
        delete (dataToSend as Partial<EmailGlobalForm>).password;
      }

      if (dataToSend.host || dataToSend.user || dataToSend.password) {
        await updateMutation.mutateAsync(dataToSend);
      }

      const res = await fetch("/api/email/global/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        credentials: "include",
      });

      const result = await res.json();

      if (result.success) {
        toast({
          title: "✅ Teste enviado!",
          description: "A configuração global está funcionando corretamente.",
        });
      } else {
        toast({
          title: "❌ Falha no teste",
          description: result.error || "Não foi possível enviar o email de teste.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao testar",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const hasConfig = !!(
    formData.host &&
    formData.port &&
    formData.user &&
    (formData.password || settings?.password) &&
    formData.fromEmail &&
    formData.fromName
  );

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto p-8">
          <Card>
            <CardContent className="p-12 text-center">
              <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
              <p className="text-sm text-muted-foreground">
                Apenas administradores podem acessar a configuração global de email.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Configuração de E-mail Global</h1>
            <p className="text-muted-foreground">
              Configure o SMTP padrão do sistema para envios gerais (boas-vindas, reset de senha, etc.).
            </p>
          </div>
        </div>

        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            Esta configuração será usada como padrão para todos os emails do sistema. Se uma empresa
            não possuir SMTP configurado, o envio usará este email global.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Servidor SMTP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="globalHost">Servidor SMTP</Label>
                <Input
                  id="globalHost"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="smtp.gmail.com"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="globalPort">Porta</Label>
                <Input
                  id="globalPort"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 587 })}
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="globalUser">Usuário</Label>
                <Input
                  id="globalUser"
                  type="email"
                  value={formData.user}
                  onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                  placeholder="seu-email@exemplo.com"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="globalPassword">Senha</Label>
                <div className="relative">
                  <Input
                    id="globalPassword"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={settings?.password ? "Digite para alterar a senha" : "Senha do SMTP"}
                    className="h-11 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {settings?.password && !formData.password && (
                  <p className="text-xs text-blue-600">
                    ℹ️ Senha já configurada. Informe apenas se desejar alterar.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="globalSsl"
                  checked={formData.useSsl}
                  onCheckedChange={(checked) => setFormData({ ...formData, useSsl: checked })}
                />
                <Label htmlFor="globalSsl" className="cursor-pointer">
                  Usar SSL
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="globalTls"
                  checked={formData.useTls}
                  onCheckedChange={(checked) => setFormData({ ...formData, useTls: checked })}
                />
                <Label htmlFor="globalTls" className="cursor-pointer">
                  Usar TLS
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Remetente</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="globalFromEmail">E-mail Remetente</Label>
              <Input
                id="globalFromEmail"
                type="email"
                value={formData.fromEmail}
                onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                placeholder="remetente@empresa.com"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="globalFromName">Nome Remetente</Label>
              <Input
                id="globalFromName"
                value={formData.fromName}
                onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                placeholder="Nome do remetente"
                className="h-11"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <Button onClick={handleTest} variant="outline" disabled={!hasConfig || testing || updateMutation.isPending}>
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Testar E-mail
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={!hasConfig || updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Salvar
              </>
            )}
          </Button>
          {isLoading && (
            <span className="text-sm text-muted-foreground">Carregando configurações...</span>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
