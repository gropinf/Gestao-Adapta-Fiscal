import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Building2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import type { Company } from "@shared/schema";

function formatCnpj(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function getCompanyStatusLabel(status?: number | null) {
  switch (status) {
    case 1:
      return "Aguardando Liberação";
    case 2:
      return "Liberado";
    case 3:
      return "Suspenso";
    case 4:
      return "Cancelado";
    default:
      return "-";
  }
}

export default function SelecionarEmpresa() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, accessLogId, setAccessLogId, setCurrentCompany } = useAuthStore();
  const [query, setQuery] = useState("");
  const [isSelecting, setIsSelecting] = useState(false);

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: !!user,
  });

  const filteredCompanies = useMemo(() => {
    if (!companies) return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return companies;
    return companies.filter((company) => {
      const haystack = [
        company.cnpj,
        company.razaoSocial,
        company.nomeFantasia,
        company.cidade,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [companies, query]);

  const registerSelection = useCallback(async (companyId: string) => {
    if (!accessLogId) return;
    try {
      await fetch("/api/auth/select-company", {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyId, accessLogId }),
      });
      setAccessLogId(null);
    } catch (error) {
      console.error("Erro ao registrar seleção de empresa:", error);
    }
  }, [accessLogId, setAccessLogId]);

  const handleSelectCompany = async (companyId: string) => {
    if (isSelecting) return;
    setIsSelecting(true);
    try {
      setCurrentCompany(companyId);
      await registerSelection(companyId);
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Não foi possível selecionar a empresa",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSelecting(false);
    }
  };

  useEffect(() => {
    if (!companies || companies.length !== 1) return;
    const companyId = companies[0].id;
    setCurrentCompany(companyId);
    registerSelection(companyId).finally(() => {
      setLocation("/dashboard");
    });
  }, [companies, registerSelection, setCurrentCompany, setLocation]);

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-foreground">Selecione uma Empresa</h1>
          <p className="text-muted-foreground">
            Escolha a empresa que deseja acessar. Você pode trocar de empresa a qualquer momento no seletor do topo.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-background border rounded-lg px-4 py-3 mb-6 shadow-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por CNPJ, Razão Social, Nome Fantasia ou Cidade..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="bg-background border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[160px_minmax(200px,1fr)_minmax(180px,1fr)_minmax(140px,1fr)_180px_120px] gap-4 px-6 py-4 text-xs font-semibold uppercase text-muted-foreground border-b">
            <span>CNPJ</span>
            <span>Razão Social</span>
            <span>Nome Fantasia</span>
            <span>Cidade</span>
            <span>Status</span>
            <span>Ações</span>
          </div>

          {isLoading ? (
            <div className="px-6 py-6 text-sm text-muted-foreground">Carregando empresas...</div>
          ) : filteredCompanies.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground">
              Nenhuma empresa encontrada para os termos informados.
            </div>
          ) : (
            filteredCompanies.map((company) => (
              <div
                key={company.id}
                className="grid grid-cols-[160px_minmax(200px,1fr)_minmax(180px,1fr)_minmax(140px,1fr)_180px_120px] gap-4 px-6 py-4 items-center border-b last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <span className="text-sm text-muted-foreground">{formatCnpj(company.cnpj)}</span>
                <span className="text-sm font-medium text-foreground">{company.razaoSocial}</span>
                <span className="text-sm text-muted-foreground">{company.nomeFantasia || "-"}</span>
                <span className="text-sm text-muted-foreground">{company.cidade || "-"}</span>
                <span className="text-sm text-muted-foreground">{getCompanyStatusLabel(company.status)}</span>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleSelectCompany(company.id)}
                  disabled={isSelecting}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Selecionar
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
