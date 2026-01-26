import { useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader, useAuthStore } from "@/lib/auth";
import { AlertTriangle, Trash2 } from "lucide-react";

type PurgeResult = {
  total: number;
  checked: number;
  deleted: number;
  skippedAuthorized: number;
  filesDeleted: number;
  danfesDeleted: number;
  errors: Array<{ id: string; chave: string; error: string }>;
};

export default function PurgeUnapprovedXmls() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const [dateFrom, setDateFrom] = useState("2026-01-01");
  const [dateTo, setDateTo] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<PurgeResult | null>(null);

  const handleRun = async () => {
    if (!isAdmin) {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem executar esta limpeza.",
        variant: "destructive",
      });
      return;
    }

    if (confirmText.trim().toUpperCase() !== "APAGAR") {
      toast({
        title: "Confirmação inválida",
        description: "Digite APAGAR para confirmar.",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setResult(null);
    try {
      const params = new URLSearchParams();
      params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/xmls/purge-unapproved?${params.toString()}`, {
        method: "DELETE",
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao executar limpeza");
      }

      const data = await res.json();
      setResult(data);
      toast({
        title: "Limpeza concluída",
        description: `${data.deleted} XML(s) removido(s).`,
      });
    } catch (error) {
      toast({
        title: "Erro na limpeza",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Limpeza de XMLs não autorizados</h1>
          <p className="text-muted-foreground mt-1">
            Remove XMLs não autorizados pela SEFAZ a partir da data informada.
          </p>
        </div>

        <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Esta ação remove registros do banco e do storage (inclui DANFE).
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Parâmetros</CardTitle>
            <CardDescription>Use &gt;= 2026-01-01 para o que foi solicitado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data inicial</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data final (opcional)</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirmação</Label>
              <Input
                placeholder='Digite "APAGAR" para confirmar'
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
            <Button
              onClick={handleRun}
              disabled={isRunning || !isAdmin}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isRunning ? "Executando..." : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Executar limpeza
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>Total analisados: {result.total}</div>
              <div>Verificados: {result.checked}</div>
              <div>Removidos: {result.deleted}</div>
              <div>Autorizados ignorados: {result.skippedAuthorized}</div>
              <div>Arquivos removidos: {result.filesDeleted}</div>
              <div>DANFEs removidos: {result.danfesDeleted}</div>
              <div>Erros: {result.errors.length}</div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
