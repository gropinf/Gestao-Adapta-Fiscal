import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, FileText, Download } from "lucide-react";

export default function Relatorios() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground mt-1">
            Gere relatórios personalizados dos seus documentos fiscais
          </p>
        </div>

        {/* Coming soon placeholder */}
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Relatórios em Desenvolvimento
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Em breve você poderá gerar relatórios personalizados em Excel e PDF
              com análises detalhadas dos seus documentos fiscais.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
