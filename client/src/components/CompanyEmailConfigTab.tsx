import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/auth";
import { Loader2, Mail, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Company } from "@shared/schema";

interface CompanyEmailConfigTabProps {
  company: Company;
}

interface EmailConfigForm {
  emailHost: string;
  emailPort: number;
  emailSsl: boolean;
  emailUser: string;
  emailPassword: string;
}

export function CompanyEmailConfigTab({ company }: CompanyEmailConfigTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testing, setTesting] = useState(false);
  
  // Busca empresa atualizada do cache
  const updatedCompany = queryClient.getQueryData<Company[]>(["/api/companies"])?.find(c => c.id === company.id) || company;
  
  const [formData, setFormData] = useState<EmailConfigForm>({
    emailHost: updatedCompany.emailHost || "",
    emailPort: updatedCompany.emailPort || 587,
    emailSsl: updatedCompany.emailSsl ?? true,
    emailUser: updatedCompany.emailUser || "",
    emailPassword: "", // Nunca preencher senha existente por segurança
  });

  // Atualiza formData quando a empresa mudar (exceto senha)
  useEffect(() => {
    setFormData(prev => ({
      emailHost: updatedCompany.emailHost || "",
      emailPort: updatedCompany.emailPort || 587,
      emailSsl: updatedCompany.emailSsl ?? true,
      emailUser: updatedCompany.emailUser || "",
      emailPassword: prev.emailPassword || "", // Mantém senha apenas se já foi digitada
    }));
  }, [updatedCompany.id, updatedCompany.emailHost, updatedCompany.emailPort, updatedCompany.emailSsl, updatedCompany.emailUser]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<EmailConfigForm>) => {
      const res = await fetch(`/api/companies/${company.id}`, {
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
        throw new Error(error.error || "Erro ao atualizar configuração");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Configuração salva!",
        description: "As configurações de email SMTP foram salvas com sucesso",
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

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      // Primeiro salva as configurações
      await updateMutation.mutateAsync(formData);

      // Depois testa a conexão
      const res = await fetch(`/api/email/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        credentials: "include",
        body: JSON.stringify({ companyId: company.id }),
      });

      const result = await res.json();

      if (result.success) {
        toast({
          title: "✅ Conexão bem-sucedida!",
          description: "A configuração de email SMTP está funcionando corretamente",
        });
      } else {
        toast({
          title: "❌ Erro na conexão",
          description: result.error || "Não foi possível conectar ao servidor SMTP",
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

  const handleSave = () => {
    // Se senha não foi alterada e já existe configuração, não enviar senha vazia
    const dataToSend = { ...formData };
    if (!dataToSend.emailPassword && updatedCompany.emailPassword) {
      // Remove senha do objeto se não foi alterada
      delete (dataToSend as any).emailPassword;
    }
    updateMutation.mutate(dataToSend);
  };

  const hasConfig = !!(formData.emailHost && formData.emailPort && formData.emailUser && formData.emailPassword);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Configuração de Email SMTP
          </CardTitle>
          <CardDescription>
            Configure as credenciais SMTP para envio de XMLs por email. Esta configuração será usada ao enviar XMLs para contabilidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Nota:</strong> Esta configuração é usada para ENVIAR emails (SMTP). 
              Para RECEBER emails automaticamente, use a funcionalidade de Monitor de Email.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emailHost">Servidor SMTP (Host) *</Label>
                <Input
                  id="emailHost"
                  type="text"
                  value={formData.emailHost}
                  onChange={(e) => setFormData({ ...formData, emailHost: e.target.value })}
                  placeholder="smtp.gmail.com"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Exemplos: smtp.gmail.com, smtp.office365.com
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailPort">Porta *</Label>
                <Input
                  id="emailPort"
                  type="number"
                  value={formData.emailPort}
                  onChange={(e) => setFormData({ ...formData, emailPort: parseInt(e.target.value) || 587 })}
                  placeholder="587"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Comuns: 587 (TLS), 465 (SSL), 25
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="emailSsl"
                  checked={formData.emailSsl}
                  onCheckedChange={(checked) => setFormData({ ...formData, emailSsl: checked })}
                />
                <Label htmlFor="emailSsl" className="cursor-pointer">
                  Usar SSL/TLS
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Marque esta opção se o servidor SMTP requer conexão segura
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailUser">Usuário (Email) *</Label>
              <Input
                id="emailUser"
                type="email"
                value={formData.emailUser}
                onChange={(e) => setFormData({ ...formData, emailUser: e.target.value })}
                placeholder="seu-email@exemplo.com"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                O endereço de email usado para autenticação SMTP
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailPassword">Senha *</Label>
              <Input
                id="emailPassword"
                type="password"
                value={formData.emailPassword}
                onChange={(e) => setFormData({ ...formData, emailPassword: e.target.value })}
                placeholder={updatedCompany.emailPassword ? "Digite nova senha para alterar" : "Senha do email ou senha de aplicativo"}
                className="h-11"
              />
              {updatedCompany.emailPassword && !formData.emailPassword && (
                <p className="text-xs text-blue-600">
                  ℹ️ Senha já configurada. Digite uma nova senha apenas se desejar alterá-la.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Para Gmail, use uma senha de aplicativo. Para outros provedores, use a senha normal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={!hasConfig || updateMutation.isPending}
              variant="default"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Salvar Configuração
                </>
              )}
            </Button>

            <Button
              onClick={handleTestConnection}
              disabled={!hasConfig || testing || updateMutation.isPending}
              variant="outline"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Testar Conexão
                </>
              )}
            </Button>
          </div>

          {hasConfig && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Configuração completa. Você pode testar a conexão ou salvar.
              </AlertDescription>
            </Alert>
          )}

          {!hasConfig && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Preencha todos os campos obrigatórios para habilitar o envio de emails
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Informações de Configuração</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>Gmail:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Host: smtp.gmail.com</li>
            <li>Porta: 587 (TLS) ou 465 (SSL)</li>
            <li>Use uma senha de aplicativo (não a senha normal)</li>
          </ul>
          
          <p className="mt-4"><strong>Outlook/Office365:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Host: smtp.office365.com</li>
            <li>Porta: 587</li>
            <li>SSL/TLS: Ativado</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

