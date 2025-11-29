import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ActivatePage() {
  const [, params] = useRoute("/activate/:token");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [userData, setUserData] = useState<{ email: string; name: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [showResend, setShowResend] = useState(false);

  const token = params?.token;

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/auth/activate/${token}`);
        
        if (res.ok) {
          const data = await res.json();
          setUserData(data);
          setTokenValid(true);
          setResendEmail(data.email);
        } else if (res.status === 410) {
          // Token expired
          setTokenExpired(true);
          const data = await res.json().catch(() => ({}));
          setResendEmail(data.email || "");
        } else {
          // Invalid token
          setTokenValid(false);
        }
      } catch (error) {
        console.error("Error validating token:", error);
        setTokenValid(false);
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter no mínimo 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "As senhas digitadas não são iguais",
        variant: "destructive",
      });
      return;
    }

    setValidating(true);

    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Erro ao ativar conta" }));
        throw new Error(errorData.error || errorData.message || "Erro ao ativar conta");
      }

      const data = await res.json();

      toast({
        title: "Conta ativada!",
        description: "Sua conta foi ativada com sucesso. Você já pode fazer login.",
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    } catch (error) {
      toast({
        title: "Erro ao ativar conta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setValidating(false);
    }
  };

  const handleResendActivation = async () => {
    if (!resendEmail) {
      toast({
        title: "Email não encontrado",
        description: "Não foi possível identificar o email",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/auth/resend-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Erro ao reenviar email" }));
        throw new Error(errorData.error || errorData.message || "Erro ao reenviar email");
      }

      toast({
        title: "Email enviado!",
        description: "Um novo link de ativação foi enviado para " + resendEmail,
      });

      setShowResend(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao reenviar email",
        variant: "destructive",
      });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validando link de ativação...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token
  if (!token || (!tokenValid && !tokenExpired)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-2xl">Link Inválido</CardTitle>
            <CardDescription>
              O link de ativação é inválido ou não existe
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este link de ativação não é válido. Verifique se você copiou o link completo do email.
              </AlertDescription>
            </Alert>

            {!showResend ? (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setShowResend(true)}
              >
                <Mail className="mr-2 h-4 w-4" />
                Solicitar Novo Link
              </Button>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
                <Button className="w-full" onClick={handleResendActivation}>
                  Reenviar Link de Ativação
                </Button>
              </div>
            )}

            <Button variant="ghost" className="w-full" onClick={() => setLocation("/")}>
              Voltar para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Token expired
  if (tokenExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
              <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-2xl">Link Expirado</CardTitle>
            <CardDescription>
              Este link de ativação expirou
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Os links de ativação são válidos por 24 horas. Solicite um novo link para ativar sua conta.
              </AlertDescription>
            </Alert>

            {!showResend ? (
              <Button className="w-full" onClick={() => setShowResend(true)}>
                <Mail className="mr-2 h-4 w-4" />
                Solicitar Novo Link
              </Button>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
                <Button className="w-full" onClick={handleResendActivation}>
                  Reenviar Link de Ativação
                </Button>
              </div>
            )}

            <Button variant="ghost" className="w-full" onClick={() => setLocation("/")}>
              Voltar para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid token - activation form
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Ative sua Conta</CardTitle>
          <CardDescription>
            Defina sua senha para começar a usar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleActivate} className="space-y-4">
            {/* User Info (readonly) */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                value={userData?.name || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userData?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-4">Defina sua senha</p>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2 mt-3">
                <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Digite a senha novamente"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <AlertDescription className="text-blue-900 dark:text-blue-100">
                Após ativar sua conta, você poderá fazer login no sistema com seu email e senha.
              </AlertDescription>
            </Alert>

            <Button type="submit" className="w-full" disabled={validating}>
              {validating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ativando conta...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Ativar Conta
                </>
              )}
            </Button>

            <Button 
              type="button" 
              variant="ghost" 
              className="w-full" 
              onClick={() => setLocation("/")}
            >
              Voltar para Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}











