import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { EmailMonitorList } from "@/components/EmailMonitorList";
import { useAuthStore } from "@/lib/auth";
import { Mail, Info, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";

export default function EmailMonitorPage() {
  const { user } = useAuthStore();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";

  // Redirecionar se não for admin
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-8 space-y-8">
          <Card>
            <CardContent className="p-12 text-center">
              <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Acesso Restrito
              </h3>
              <p className="text-sm text-muted-foreground">
                Apenas administradores podem acessar o Monitor de Email.
              </p>
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
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Monitoramento de Email</h1>
                <p className="text-muted-foreground mt-1">
                  Configure contas de email para download automático de XMLs (funcionalidade global)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Alert */}
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            Os monitores de email conectam-se automaticamente às caixas de entrada configuradas e fazem
            download de arquivos XML anexados. O sistema verifica periodicamente por novos emails.
            <strong className="block mt-2">Os monitores processam XMLs de todas as empresas automaticamente.</strong>
          </AlertDescription>
        </Alert>

        {/* Email Monitor List */}
        <Card>
          <CardContent className="p-6">
            <EmailMonitorList />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

