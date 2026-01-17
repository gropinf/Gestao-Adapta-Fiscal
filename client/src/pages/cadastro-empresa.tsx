import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, CheckCircle2, ArrowLeft, Mail, Copy, Check } from "lucide-react";

interface CompanyData {
  id?: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  telefone?: string;
  email?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

interface EmailInfo {
  email: string;
  name: string;
  active: boolean;
}

type Step = "search" | "exists" | "confirm" | "emails" | "success";

export default function CadastroEmpresa() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [cnpj, setCnpj] = useState("");
  const [step, setStep] = useState<Step>("search");
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [existingEmails, setExistingEmails] = useState<EmailInfo[]>([]);
  const [emails, setEmails] = useState<Array<{ email: string; name: string }>>([{ email: "", name: "" }]);
  const [companyId, setCompanyId] = useState<string>("");
  const [copied, setCopied] = useState<string>("");

  const formatCnpj = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 14) {
      return cleaned
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return value;
  };

  const handleSearchCnpj = async () => {
    if (!cnpj || cnpj.replace(/\D/g, "").length !== 14) {
      toast({
        title: "CNPJ inválido",
        description: "Por favor, digite um CNPJ válido com 14 dígitos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const cleanedCnpj = cnpj.replace(/\D/g, "");
      const res = await fetch("/api/public/check-cnpj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: cleanedCnpj }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Erro",
          description: data.error || "Erro ao buscar CNPJ",
          variant: "destructive",
        });
        return;
      }

      if (data.exists) {
        // Empresa já existe
        setCompany(data.company);
        setExistingEmails(data.emails || []);
        setCompanyId(data.company.id);
        setStep("exists");
      } else {
        // Empresa não existe - mostra dados para confirmação
        setCompany(data.companyData);
        setStep("confirm");
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao conectar com o servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCreate = async () => {
    if (!company) return;

    setLoading(true);
    try {
      const cleanedCnpj = company.cnpj.replace(/\D/g, "");
      const res = await fetch("/api/public/create-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: cleanedCnpj, confirm: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Erro",
          description: data.error || "Erro ao criar empresa",
          variant: "destructive",
        });
        return;
      }

      setCompanyId(data.company.id);
      setCompany({ ...company, id: data.company.id });
      setStep("emails");
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao conectar com o servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmail = () => {
    setEmails([...emails, { email: "", name: "" }]);
  };

  const handleRemoveEmail = (index: number) => {
    if (emails.length > 1) {
      setEmails(emails.filter((_, i) => i !== index));
    }
  };

  const handleEmailChange = (index: number, field: "email" | "name", value: string) => {
    const newEmails = [...emails];
    newEmails[index][field] = value;
    setEmails(newEmails);
  };

  const handleLinkEmails = async () => {
    // Validação: pelo menos 1 email obrigatório
    const validEmails = emails.filter(e => e.email.trim());
    if (validEmails.length === 0) {
      toast({
        title: "Email obrigatório",
        description: "Você precisa cadastrar pelo menos 1 email",
        variant: "destructive",
      });
      return;
    }

    // Valida formato dos emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const emailData of validEmails) {
      if (!emailRegex.test(emailData.email)) {
        toast({
          title: "Email inválido",
          description: `O email "${emailData.email}" não é válido`,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const results = [];
      for (const emailData of validEmails) {
        const res = await fetch("/api/public/link-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            email: emailData.email.trim(),
            name: emailData.name.trim() || emailData.email.trim().split("@")[0],
          }),
        });

        const data = await res.json();
        results.push({
          email: emailData.email,
          success: res.ok,
          message: data.message || data.error,
        });
      }

      // Verifica se todos foram bem-sucedidos
      const allSuccess = results.every(r => r.success);
      
      if (allSuccess) {
        setStep("success");
      } else {
        toast({
          title: "Alguns emails tiveram problemas",
          description: results.filter(r => !r.success).map(r => `${r.email}: ${r.message}`).join(", "),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao conectar com o servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 2000);
      toast({
        title: "Copiado!",
        description: "Conteúdo copiado para a área de transferência",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência",
        variant: "destructive",
      });
    }
  };

  const renderCompanyInfo = (showCopy = true) => {
    if (!company) return null;

    const info = [
      `CNPJ: ${company.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}`,
      `Razão Social: ${company.razaoSocial}`,
      company.nomeFantasia ? `Nome Fantasia: ${company.nomeFantasia}` : null,
      company.inscricaoEstadual ? `Inscrição Estadual: ${company.inscricaoEstadual}` : null,
      company.telefone ? `Telefone: ${company.telefone}` : null,
      company.email ? `Email: ${company.email}` : null,
      company.rua ? `Endereço: ${company.rua}${company.numero ? `, ${company.numero}` : ''}${company.bairro ? ` - ${company.bairro}` : ''}${company.cidade ? ` - ${company.cidade}/${company.uf || ''}` : ''}${company.cep ? ` - CEP: ${company.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : ''}` : null,
    ].filter(Boolean).join("\n");

    return (
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg flex-1">
            {info}
          </pre>
          {showCopy && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(info, "company-info")}
              className="shrink-0"
            >
              {copied === "company-info" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Cadastro Realizado com Sucesso!</CardTitle>
            <CardDescription>
              Emails cadastrados e vinculados à empresa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-900 dark:text-green-100">
                {company && (
                  <>
                    A empresa <strong>{company.razaoSocial}</strong> foi cadastrada com sucesso.
                    Os emails foram vinculados e os usuários receberam instruções por email.
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate("/")}>
                Ir para Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl">Cadastro de Empresa</CardTitle>
              <CardDescription>
                {step === "search" && "Digite o CNPJ para verificar ou cadastrar a empresa"}
                {step === "exists" && "Empresa já cadastrada - Cadastre emails para vincular"}
                {step === "confirm" && "Confirme os dados e crie a empresa"}
                {step === "emails" && "Cadastre os emails para vincular à empresa"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === "search" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                  maxLength={18}
                  disabled={loading}
                />
              </div>

              <Button
                onClick={handleSearchCnpj}
                className="w-full"
                disabled={loading || !cnpj}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Building2 className="mr-2 h-4 w-4" />
                    Buscar CNPJ
                  </>
                )}
              </Button>
            </>
          )}

          {step === "exists" && company && (
            <>
              <Alert>
                <AlertDescription>
                  Esta empresa já está cadastrada no sistema. Você pode cadastrar novos emails para vincular à empresa.
                </AlertDescription>
              </Alert>

              <div>
                <Label className="text-base font-semibold mb-2 block">Informações da Empresa</Label>
                {renderCompanyInfo()}
              </div>

              {existingEmails.length > 0 && (
                <div>
                  <Label className="text-base font-semibold mb-2 block">Emails Já Vinculados</Label>
                  <div className="space-y-2">
                    {existingEmails.map((emailInfo, idx) => {
                      const emailText = `${emailInfo.email} (${emailInfo.name}) - ${emailInfo.active ? 'Ativo' : 'Pendente de ativação'}`;
                      return (
                        <div key={idx} className="flex items-center justify-between gap-2 bg-muted p-3 rounded-lg">
                          <span className="text-sm">{emailText}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(emailText, `existing-email-${idx}`)}
                          >
                            {copied === `existing-email-${idx}` ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("search");
                    setCnpj("");
                    setCompany(null);
                    setExistingEmails([]);
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Buscar Outro CNPJ
                </Button>
                <Button onClick={() => setStep("emails")} className="flex-1">
                  <Mail className="mr-2 h-4 w-4" />
                  Cadastrar Novos Emails
                </Button>
              </div>
            </>
          )}

          {step === "confirm" && company && (
            <>
              <Alert>
                <AlertDescription>
                  Esta empresa não está cadastrada. Confirme os dados abaixo e clique em "Confirmar e Criar Empresa".
                </AlertDescription>
              </Alert>

              <div>
                <Label className="text-base font-semibold mb-2 block">Dados da Empresa (ReceitaWS)</Label>
                {renderCompanyInfo()}
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("search");
                    setCompany(null);
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button onClick={handleConfirmCreate} className="flex-1" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirmar e Criar Empresa
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === "emails" && (
            <>
              <Alert>
                <AlertDescription>
                  Cadastre pelo menos 1 email para vincular à empresa. Se o email não existir, será criado um novo usuário e enviado link de ativação. Se já existir, será vinculado automaticamente.
                </AlertDescription>
              </Alert>

              {company && (
                <div>
                  <Label className="text-base font-semibold mb-2 block">Empresa</Label>
                  {renderCompanyInfo(false)}
                </div>
              )}

              <div>
                <Label className="text-base font-semibold mb-2 block">Emails para Vincular *</Label>
                <div className="space-y-3">
                  {emails.map((emailData, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <Input
                            placeholder="nome@email.com"
                            type="email"
                            value={emailData.email}
                            onChange={(e) => handleEmailChange(index, "email", e.target.value)}
                            disabled={loading}
                          />
                        </div>
                        <div>
                          <Input
                            placeholder="Nome completo (opcional)"
                            value={emailData.name}
                            onChange={(e) => handleEmailChange(index, "name", e.target.value)}
                            disabled={loading}
                          />
                        </div>
                      </div>
                      {emails.length > 1 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveEmail(index)}
                          disabled={loading}
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddEmail}
                  className="mt-2"
                  disabled={loading}
                >
                  + Adicionar Email
                </Button>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (step === "emails" && existingEmails.length > 0) {
                      setStep("exists");
                    } else {
                      setStep("search");
                      setCnpj("");
                      setCompany(null);
                    }
                    setEmails([{ email: "", name: "" }]);
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button onClick={handleLinkEmails} className="flex-1" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Vincular Emails
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
