import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeader } from "@/lib/auth";
import { Users, Mail, Building2, Loader2 } from "lucide-react";
import type { Accountant } from "@shared/schema";

interface CompanyAccountantsTabProps {
  companyId: string;
}

interface AccountantWithCompanies extends Accountant {
  companies?: Array<{ id: string; razaoSocial: string }>;
}

export function CompanyAccountantsTab({ companyId }: CompanyAccountantsTabProps) {
  // Busca todas as contabilidades
  const { data: allAccountants = [], isLoading } = useQuery<AccountantWithCompanies[]>({
    queryKey: ["/api/accountants"],
    queryFn: async () => {
      const res = await fetch("/api/accountants", {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Erro ao carregar contabilidades");
      }

      const accountantsData = await res.json();

      // Busca empresas de cada contador
      const accountantsWithCompanies = await Promise.all(
        accountantsData.map(async (acc: Accountant) => {
          try {
            const compRes = await fetch(`/api/accountants/${acc.id}/companies`, {
              headers: getAuthHeader(),
              credentials: "include",
            });
            const companies = compRes.ok ? await compRes.json() : [];
            return { ...acc, companies };
          } catch {
            return { ...acc, companies: [] };
          }
        })
      );

      return accountantsWithCompanies;
    },
  });

  // Filtra contabilidades vinculadas a esta empresa
  const linkedAccountants = allAccountants.filter((accountant) =>
    accountant.companies?.some((company) => company.id === companyId)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Carregando contabilidades...</p>
      </div>
    );
  }

  if (linkedAccountants.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            Nenhuma contabilidade vinculada
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            Esta empresa ainda não possui contabilidades vinculadas.
            <br />
            Vincule contabilidades na página de Contabilidades.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {linkedAccountants.length} contabilidade{linkedAccountants.length > 1 ? 's' : ''} vinculada{linkedAccountants.length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {linkedAccountants.map((contabilidade) => (
          <Card key={contabilidade.id} className="hover-elevate">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold mb-2">
                    {contabilidade.nome}
                  </h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {contabilidade.cnpj && (
                      <p>
                        <span className="font-medium">CNPJ:</span>{" "}
                        {contabilidade.cnpj.replace(
                          /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                          "$1.$2.$3/$4-$5"
                        )}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span>{contabilidade.emailContador}</span>
                    </div>
                    {contabilidade.telefone && (
                      <p>
                        <span className="font-medium">Telefone:</span> {contabilidade.telefone}
                      </p>
                    )}
                    {contabilidade.crt && (
                      <p>
                        <span className="font-medium">CRT:</span>{" "}
                        {contabilidade.crt === "1" && "Simples Nacional"}
                        {contabilidade.crt === "2" && "Simples Nacional (Excesso)"}
                        {contabilidade.crt === "3" && "Regime Normal"}
                        {contabilidade.crt === "4" && "MEI"}
                      </p>
                    )}
                    {contabilidade.cidade && contabilidade.uf && (
                      <p>
                        <span className="font-medium">Localização:</span>{" "}
                        {contabilidade.cidade} - {contabilidade.uf}
                      </p>
                    )}
                    {!contabilidade.ativo && (
                      <Badge variant="outline" className="border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 mt-2">
                        Inativa
                      </Badge>
                    )}
                    {contabilidade.companies && contabilidade.companies.length > 1 && (
                      <div className="flex items-start gap-2 mt-2 pt-2 border-t">
                        <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-xs mb-1">Outras empresas atendidas:</p>
                          <div className="flex flex-wrap gap-2">
                            {contabilidade.companies
                              .filter((emp) => emp.id !== companyId)
                              .map((empresa) => (
                                <Badge
                                  key={empresa.id}
                                  variant="outline"
                                  className="bg-muted text-xs"
                                >
                                  {empresa.razaoSocial}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}







