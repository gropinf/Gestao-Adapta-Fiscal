import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { apiRequest } from "../lib/queryClient";
import { useAuthStore } from "../lib/auth";

type R2MigrationRun = {
  id: string;
  status: "processing" | "success" | "failed" | "cancelled";
  dryRun: boolean;
  deleteFromContabo: boolean;
  batchSize: number;
  prefix?: string | null;
  totalProcessed: number;
  migrated: number;
  skipped: number;
  failed: number;
  lastKey?: string | null;
  lastMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export default function R2MigrationPage() {
  const [dryRun, setDryRun] = useState(true);
  const [deleteFromContabo, setDeleteFromContabo] = useState(false);
  const [batchSize, setBatchSize] = useState(200);
  const [prefix, setPrefix] = useState("");
  const [filepathUrlPrefix, setFilepathUrlPrefix] = useState(
    "https://usc1.contabostorage.com/caixafacil"
  );
  const [autoPrefix, setAutoPrefix] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [latest, setLatest] = useState<R2MigrationRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replaceOldPrefix, setReplaceOldPrefix] = useState(
    "https://usc1.contabostorage.com/"
  );
  const [replaceNewPrefix, setReplaceNewPrefix] = useState(
    "https://2bc5d0df678f03bc392ae1480a9cb559.r2.cloudflarestorage.com/"
  );
  const [replaceResult, setReplaceResult] = useState<{ xmlsUpdated: number; eventsUpdated: number } | null>(null);
  const [replaceRunning, setReplaceRunning] = useState(false);
  const [replaceScopeAll, setReplaceScopeAll] = useState(true);
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);

  useEffect(() => {
    const loadCompanyPrefix = async () => {
      if (!currentCompanyId) return;
      try {
        const res = await apiRequest("GET", "/api/companies");
        const data = await res.json();
        const company = Array.isArray(data)
          ? data.find((item: any) => item?.id === currentCompanyId)
          : null;
        if (company?.cnpj && autoPrefix) {
          const cleanCnpj = String(company.cnpj).replace(/[^\d]/g, "");
          setFilepathUrlPrefix(`https://usc1.contabostorage.com/caixafacil/${cleanCnpj}/xml`);
        }
      } catch (err: any) {
        setError(err?.message || "Falha ao carregar empresa");
      }
    };

    loadCompanyPrefix();
  }, [currentCompanyId, autoPrefix]);

  const loadLatest = async () => {
    try {
      const res = await apiRequest("GET", "/api/r2-migration/latest");
      const data = await res.json();
      setLatest(data || null);
      if (data?.status === "processing") {
        setRunning(true);
      } else {
        setRunning(false);
      }
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar status");
    }
  };

  useEffect(() => {
    loadLatest();
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      loadLatest();
    }, 10000);
    return () => clearInterval(interval);
  }, [running]);

  const parseJsonResponse = async (res: Response) => {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        throw new Error("Resposta HTML inesperada. Verifique se o backend foi atualizado.");
      }
      throw new Error(text);
    }
  };

  const startMigration = async () => {
    setError(null);
    if (!currentCompanyId) {
      setError("Selecione uma empresa para iniciar a migração.");
      return;
    }
    if (confirmText !== "MIGRAR") {
      setError("Digite MIGRAR para confirmar.");
      return;
    }
    setRunning(true);
    try {
      const res = await apiRequest("POST", "/api/r2-migration/run", {
        dryRun,
        deleteFromContabo,
        batchSize,
        prefix: prefix.trim() || null,
        filepathUrlPrefix: filepathUrlPrefix.trim() || null,
        companyId: currentCompanyId,
      });
      const data = await parseJsonResponse(res);
      setLatest(data.run || null);
      setConfirmText("");
    } catch (err: any) {
      setRunning(false);
      setError(err?.message || "Falha ao iniciar migração");
    }
  };

  const cancelMigration = async () => {
    if (!latest?.id) return;
    setError(null);
    if (!confirm("Deseja cancelar a migração em andamento?")) {
      return;
    }
    try {
      const res = await apiRequest("POST", "/api/r2-migration/cancel", { runId: latest.id });
      const data = await res.json();
      setLatest(data.run || null);
      setRunning(false);
    } catch (err: any) {
      setError(err?.message || "Falha ao cancelar migração");
    }
  };

  const replacePrefix = async () => {
    if (!confirm("Deseja ajustar o prefixo dos filepaths no banco?")) {
      return;
    }
    setReplaceRunning(true);
    setReplaceResult(null);
    try {
      const res = await apiRequest("POST", "/api/r2-migration/replace-prefix", {
        companyId: replaceScopeAll ? null : currentCompanyId,
        oldPrefix: replaceOldPrefix.trim(),
        newPrefix: replaceNewPrefix.trim(),
        scope: replaceScopeAll ? "all" : "company",
      });
      const data = await parseJsonResponse(res);
      setReplaceResult({
        xmlsUpdated: data.xmlsUpdated || 0,
        eventsUpdated: data.eventsUpdated || 0,
      });
    } catch (err: any) {
      setError(err?.message || "Falha ao ajustar prefixo");
    } finally {
      setReplaceRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Migração Contabo ➜ R2</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-sm text-muted-foreground">
            Use esta tela para executar a migração em produção sem acesso à VPS. Essa opção é
            temporária e deve ser removida após o uso.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="batchSize">Batch size</Label>
              <Input
                id="batchSize"
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value) || 200)}
                min={50}
                max={1000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prefix">Prefix (opcional)</Label>
              <Input
                id="prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="ex: https://usc1.contabostorage.com/caixafacil/48718004000136/xml"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="replaceScopeAll">Aplicar em todas as empresas</Label>
              <div className="text-xs text-muted-foreground">
                Se desligado, aplica apenas na empresa selecionada.
              </div>
            </div>
            <Switch
              id="replaceScopeAll"
              checked={replaceScopeAll}
              onCheckedChange={setReplaceScopeAll}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filepathUrlPrefix">Prefixo base do Contabo</Label>
            <Input
              id="filepathUrlPrefix"
              value={filepathUrlPrefix}
              onChange={(e) => {
                setAutoPrefix(false);
                setFilepathUrlPrefix(e.target.value);
              }}
              placeholder="ex: https://usc1.contabostorage.com/caixafacil"
            />
            <div className="text-xs text-muted-foreground">
              Usado para filtrar as URLs do storage antes de migrar.
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="dryRun">Dry run</Label>
              <div className="text-xs text-muted-foreground">
                Não grava no R2 nem altera o banco.
              </div>
            </div>
            <Switch id="dryRun" checked={dryRun} onCheckedChange={setDryRun} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="deleteFromContabo">Apagar do Contabo</Label>
              <div className="text-xs text-muted-foreground">
                Remove arquivos do Contabo após migração.
              </div>
            </div>
            <Switch
              id="deleteFromContabo"
              checked={deleteFromContabo}
              onCheckedChange={setDeleteFromContabo}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmText">Confirmação</Label>
            <Input
              id="confirmText"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite MIGRAR para habilitar"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={startMigration} disabled={running}>
              {running ? "Em execução..." : "Iniciar migração"}
            </Button>
            <Button variant="destructive" onClick={cancelMigration} disabled={!running}>
              Cancelar
            </Button>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ajustar prefixo do storage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Use esta ação quando os arquivos já foram copiados para o R2 e você só precisa
            atualizar o prefixo das URLs no banco.
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="replaceOldPrefix">Prefixo antigo</Label>
              <Input
                id="replaceOldPrefix"
                value={replaceOldPrefix}
                onChange={(e) => setReplaceOldPrefix(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replaceNewPrefix">Prefixo novo</Label>
              <Input
                id="replaceNewPrefix"
                value={replaceNewPrefix}
                onChange={(e) => setReplaceNewPrefix(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={replacePrefix} disabled={replaceRunning}>
              {replaceRunning ? "Ajustando..." : "Ajustar prefixo"}
            </Button>
            {replaceResult && (
              <div className="text-sm text-muted-foreground">
                XMLs: {replaceResult.xmlsUpdated} | Eventos: {replaceResult.eventsUpdated}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status da última execução</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {latest ? (
            <>
              <div>Status: {latest.status}</div>
              <div>Início: {latest.startedAt ? new Date(latest.startedAt).toLocaleString() : "-"}</div>
              <div>Fim: {latest.finishedAt ? new Date(latest.finishedAt).toLocaleString() : "-"}</div>
              <div>Processados: {latest.totalProcessed}</div>
              <div>Migrados: {latest.migrated}</div>
              <div>Ignorados: {latest.skipped}</div>
              <div>Falhas: {latest.failed}</div>
              <div>Última chave: {latest.lastKey || "-"}</div>
              <div>Última mensagem: {latest.lastMessage || "-"}</div>
            </>
          ) : (
            <div>Nenhuma execução registrada.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
