import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, CheckCircle2, TrendingUp, Shield, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/auth/login", { email, password });
      const data = await response.json();
      
      setAuth(data.user, data.token, data.accessLogId);
      toast({
        title: "Login realizado com sucesso!",
        description: `Bem-vindo, ${data.user.name}`,
      });
      
      setLocation("/selecionar-empresa");
    } catch (error: any) {
      const rawMessage = typeof error?.message === "string" ? error.message : "";
      const friendlyMessage = rawMessage.startsWith("401") || rawMessage.includes("Invalid credentials")
        ? "Email ou senha incorretos. Verifique suas credenciais e tente novamente."
        : rawMessage.startsWith("403")
          ? "Sua conta está inativa ou sem permissão de acesso. Fale com o suporte."
          : rawMessage.startsWith("429")
            ? "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente."
            : "Não foi possível acessar sua conta agora. Tente novamente em instantes.";
      toast({
        title: "Não foi possível entrar",
        description: friendlyMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel - Login Form */}
      <div className="flex items-center justify-center p-8 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="w-7 h-7 text-primary-foreground" />
              </div>
              <div className="flex flex-col items-start">
                <h1 className="text-3xl font-bold">Adapta Fiscal</h1>
                <span className="text-xs text-muted-foreground mt-1">
                  Versão {import.meta.env.VITE_APP_VERSION || "—"}
                </span>
              </div>
            </div>
            <h2 className="text-2xl font-semibold">Bem-vindo de volta</h2>
            <p className="text-muted-foreground">
              Entre com suas credenciais para acessar sua conta
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                data-testid="input-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  data-testid="input-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-lg pr-12"
                />
                <button
                  type="button"
                  data-testid="button-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <button
                type="button"
                data-testid="link-forgot-password"
                onClick={() => setLocation("/forgot-password")}
                className="text-sm text-primary hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>

            <Button
              type="submit"
              data-testid="button-login"
              disabled={isLoading}
              className="w-full h-12 rounded-lg text-base font-semibold"
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground space-y-2">
            <div>
              Não tem uma conta?{" "}
              <button 
                type="button"
                data-testid="link-request-access"
                onClick={() => setLocation("/request-access")}
                className="text-primary hover:underline font-medium"
              >
                Solicite acesso
              </button>
            </div>
            <div>
              Conta inativa?{" "}
              <button 
                type="button"
                onClick={() => setLocation("/reenviar-ativacao")}
                className="text-primary hover:underline font-medium"
              >
                Reenviar ativação
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Marketing/Promo */}
      <div className="hidden lg:flex flex-col items-center justify-center p-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-64 h-64 bg-primary rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-chart-2 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-lg space-y-12">
          <div className="space-y-6">
            <h2 className="text-4xl font-bold leading-tight">
              Automatize sua gestão fiscal com{" "}
              <span className="text-primary">Adapta Online</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Baixe, valide e organize NFe/NFCe em lote. Integre com sua contabilidade para zero esforço!
            </p>
          </div>

          {/* Stats showcase */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 rounded-xl bg-card border border-card-border hover-elevate">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold">99%</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Conformidade SEFAZ
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-card-border hover-elevate">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold">50K+</span>
              </div>
              <p className="text-sm text-muted-foreground">
                XMLs processados/mês
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-card-border hover-elevate">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold">100%</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Seguro e criptografado
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-card-border hover-elevate">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold">24/7</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Monitoramento ativo
              </p>
            </div>
          </div>

          <div className="pt-6">
            <button 
              data-testid="link-learn-more"
              className="text-primary font-medium flex items-center gap-2 hover:gap-3 transition-all"
            >
              Saiba mais sobre o Adapta Online
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
