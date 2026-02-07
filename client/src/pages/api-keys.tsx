import { useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Key, Plus, Copy, Trash2, AlertCircle } from "lucide-react";

interface ApiKey {
  id: string;
  name: string | null;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export default function ApiKeysPage() {
  const { toast } = useToast();
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const { data: keys = [], isLoading, refetch } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys", currentCompanyId],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const res = await fetch(`/api/api-keys?companyId=${currentCompanyId}`, {
        headers: getAuthHeader(),
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Erro ao carregar API Keys");
      }
      return res.json();
    },
  });

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast({
          title: "✅ Copiado!",
          description: `${label} copiado para a área de transferência`,
        });
      },
      () => {
        toast({
          title: "Erro",
          description: "Não foi possível copiar",
          variant: "destructive",
        });
      }
    );
  };

  const handleCreateKey = async () => {
    if (!currentCompanyId) {
      toast({
        title: "Empresa não selecionada",
        description: "Selecione uma empresa antes de gerar a API key.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          companyId: currentCompanyId,
          name: newKeyName.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erro ao gerar API key");
      }

      setCreatedKey(data.apiKey || null);
      setNewKeyName("");
      await refetch();
      toast({
        title: "API key criada",
        description: "A chave foi gerada com sucesso. Salve em local seguro.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao criar API key",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    const confirmed = window.confirm("Deseja revogar esta API key?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/api-keys/${keyId}`, {
        method: "DELETE",
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao revogar API key");
      }

      await refetch();
      toast({
        title: "API key revogada",
        description: "A chave foi revogada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao revogar",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  if (!currentCompanyId) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
              <h2 className="text-2xl font-bold mb-2">Empresa não selecionada</h2>
              <p className="text-muted-foreground">
                Selecione uma empresa no menu superior para gerenciar API Keys.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">API Keys</h1>
            <p className="text-muted-foreground">
              Gere chaves para envio de XMLs via API
            </p>
          </div>
          <Button onClick={() => {
            setCreateOpen(true);
            setCreatedKey(null);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Nova API key
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Chaves cadastradas
            </CardTitle>
            <CardDescription>
              A chave completa é exibida apenas no momento da criação
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-muted-foreground">Carregando...</div>
            ) : keys.length === 0 ? (
              <div className="text-center text-muted-foreground">
                Nenhuma API key criada ainda
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Prefixo</TableHead>
                      <TableHead>Criada em</TableHead>
                      <TableHead>Último uso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell>{key.name || "—"}</TableCell>
                        <TableCell className="font-mono">{key.keyPrefix}</TableCell>
                        <TableCell>{formatDateTime(key.createdAt)}</TableCell>
                        <TableCell>{formatDateTime(key.lastUsedAt)}</TableCell>
                        <TableCell>
                          {key.revokedAt ? "Revogada" : "Ativa"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeKey(key.id)}
                            disabled={!!key.revokedAt}
                            title="Revogar"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Nova API key</DialogTitle>
            <DialogDescription>
              Defina um nome e gere a chave. O valor completo será exibido apenas uma vez.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Nome (opcional)</Label>
              <Input
                id="api-key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Ex: AppMonitorXML"
              />
            </div>
            {createdKey && (
              <div className="border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-lg p-3 text-sm space-y-2">
                <div className="font-medium">API key gerada</div>
                <div className="flex items-center gap-2">
                  <code className="break-all text-xs">{createdKey}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(createdKey, "API key")}
                    title="Copiar"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="text-xs">
                  Salve em local seguro. Não será possível visualizar novamente.
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Fechar
            </Button>
            <Button onClick={handleCreateKey} disabled={creating}>
              {creating ? "Gerando..." : "Gerar API key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
