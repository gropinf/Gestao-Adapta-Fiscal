import { useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Users, Mail, Building2, Edit, Trash2, Loader2, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import type { Accountant, Company } from "@shared/schema";

interface AccountantForm {
  cnpj?: string;
  nome: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  crt?: string;
  emailContador: string;
  telefone?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  ativo?: boolean;
  companyIds: string[];
}

interface AccountantWithCompanies extends Accountant {
  companies?: Company[];
}

export default function Contabilidades() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccountant, setEditingAccountant] = useState<AccountantWithCompanies | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountantToDelete, setAccountantToDelete] = useState<AccountantWithCompanies | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);
  const [cnpjSearchResult, setCnpjSearchResult] = useState<"success" | "error" | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterAtivo, setFilterAtivo] = useState<string>("all");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<AccountantForm>();

  // Fetch accountants
  const { data: accountants = [], isLoading: loadingAccountants } = useQuery<AccountantWithCompanies[]>({
    queryKey: ["/api/accountants"],
    enabled: !!userId,
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

  // Fetch companies for selection
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: !!userId,
  });

  // Máscaras de input
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

  const formatCep = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 8) {
      return cleaned.replace(/^(\d{5})(\d)/, "$1-$2");
    }
    return value;
  };

  // Busca dados do CNPJ na ReceitaWS
  const handleSearchCNPJ = async () => {
    const cnpj = watch("cnpj");
    
    if (!cnpj) {
      toast({
        title: "CNPJ não informado",
        description: "Digite um CNPJ antes de buscar",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingCNPJ(true);
    setCnpjSearchResult(null);

    try {
      const cleanedCnpj = cnpj.replace(/\D/g, "");
      
      const res = await fetch(`/api/cnpj/${cleanedCnpj}`, {
        headers: getAuthHeader(),
        credentials: "include",
      });

      const result = await res.json();

      if (!result.success) {
        setCnpjSearchResult("error");
        toast({
          title: "CNPJ não encontrado",
          description: result.error || "Não foi possível consultar este CNPJ",
          variant: "destructive",
        });
        return;
      }

      // Preenche os campos automaticamente
      const data = result.data;
      setValue("nome", data.razaoSocial);
      setValue("nomeFantasia", data.nomeFantasia);
      setValue("telefone", data.telefone || "");
      setValue("rua", data.rua);
      setValue("numero", data.numero);
      setValue("bairro", data.bairro);
      setValue("cidade", data.cidade);
      setValue("uf", data.uf);
      setValue("cep", data.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2"));

      setCnpjSearchResult("success");
      
      toast({
        title: result.cached ? "Dados carregados (cache)" : "Dados da Receita Federal",
        description: `Informações de ${data.razaoSocial} preenchidas automaticamente`,
      });

    } catch (error) {
      setCnpjSearchResult("error");
      toast({
        title: "Erro na consulta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsSearchingCNPJ(false);
    }
  };

  // Create accountant mutation
  const createMutation = useMutation({
    mutationFn: async (data: AccountantForm) => {
      // Remove máscaras antes de enviar
      const cleanData = {
        ...data,
        cnpj: data.cnpj?.replace(/\D/g, ""),
        cep: data.cep?.replace(/\D/g, ""),
        companyIds: Array.from(selectedCompanies),
      };
      
      const res = await fetch("/api/accountants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        credentials: "include",
        body: JSON.stringify(cleanData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao criar contabilidade");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accountants"] });
      setIsDialogOpen(false);
      setSelectedCompanies(new Set());
      reset();
      toast({
        title: "Contabilidade cadastrada!",
        description: "O escritório contábil foi adicionado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cadastrar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update accountant mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AccountantForm }) => {
      const cleanData = {
        ...data,
        cnpj: data.cnpj?.replace(/\D/g, ""),
        cep: data.cep?.replace(/\D/g, ""),
        companyIds: Array.from(selectedCompanies),
      };
      
      const res = await fetch(`/api/accountants/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        credentials: "include",
        body: JSON.stringify(cleanData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao atualizar contabilidade");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accountants"] });
      setIsDialogOpen(false);
      setEditingAccountant(null);
      setSelectedCompanies(new Set());
      reset();
      toast({
        title: "Contabilidade atualizada!",
        description: "Os dados foram atualizados com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete accountant mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accountants/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao deletar contabilidade");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accountants"] });
      setDeleteDialogOpen(false);
      setAccountantToDelete(null);
      toast({
        title: "Contabilidade removida!",
        description: "O escritório contábil foi removido com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AccountantForm) => {
    if (selectedCompanies.size === 0) {
      toast({
        title: "Atenção",
        description: "Selecione pelo menos uma empresa",
        variant: "destructive",
      });
      return;
    }

    if (editingAccountant) {
      updateMutation.mutate({ id: editingAccountant.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleNewAccountant = () => {
    setEditingAccountant(null);
    setSelectedCompanies(new Set());
    reset({ 
      cnpj: "",
      nome: "", 
      nomeFantasia: "",
      emailContador: "",
      ativo: true,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (accountant: AccountantWithCompanies) => {
    setEditingAccountant(accountant);
    
    // Formata CNPJ e CEP para exibição
    const cnpjFormatted = accountant.cnpj?.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
    const cepFormatted = accountant.cep?.replace(/^(\d{5})(\d{3})$/, "$1-$2");
    
    reset({
      cnpj: cnpjFormatted || "",
      nome: accountant.nome,
      nomeFantasia: accountant.nomeFantasia || "",
      inscricaoEstadual: accountant.inscricaoEstadual || "",
      crt: accountant.crt || "",
      emailContador: accountant.emailContador,
      telefone: accountant.telefone || "",
      rua: accountant.rua || "",
      numero: accountant.numero || "",
      bairro: accountant.bairro || "",
      cidade: accountant.cidade || "",
      uf: accountant.uf || "",
      cep: cepFormatted || "",
      ativo: accountant.ativo ?? true,
    });
    // Pré-seleciona as empresas já associadas
    const companyIds = new Set(accountant.companies?.map(c => c.id) || []);
    setSelectedCompanies(companyIds);
    setIsDialogOpen(true);
  };

  const handleDelete = (accountant: AccountantWithCompanies) => {
    setAccountantToDelete(accountant);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (accountantToDelete) {
      deleteMutation.mutate(accountantToDelete.id);
    }
  };

  const toggleCompany = (companyId: string) => {
    const newSelection = new Set(selectedCompanies);
    if (newSelection.has(companyId)) {
      newSelection.delete(companyId);
    } else {
      newSelection.add(companyId);
    }
    setSelectedCompanies(newSelection);
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contabilidades</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os escritórios contábeis
            </p>
          </div>
          <Button onClick={handleNewAccountant} data-testid="button-add-accountant">
            <Plus className="w-4 h-4 mr-2" />
            Nova Contabilidade
          </Button>
        </div>

        {/* Pesquisa e Filtros */}
        {accountants.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Campo de Pesquisa */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="search-query" className="text-sm">
                    Pesquisar
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="search-query"
                      type="text"
                      placeholder="Buscar por CNPJ, Razão Social ou Nome Fantasia..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSearchQuery("")}
                    title="Limpar pesquisa"
                  >
                    ✕
                  </Button>
                )}
              </div>
              
              {/* Filtros */}
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="filter-ativo" className="text-sm">
                    Status
                  </Label>
                  <Select value={filterAtivo} onValueChange={setFilterAtivo}>
                    <SelectTrigger id="filter-ativo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="true">Ativas</SelectItem>
                      <SelectItem value="false">Inativas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filterAtivo !== "all" && (
                  <Button
                    variant="outline"
                    onClick={() => setFilterAtivo("all")}
                  >
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contabilidades list */}
        {loadingAccountants ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Carregando contabilidades...</p>
          </div>
        ) : accountants.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {accountants
              .filter((contabilidade) => {
                // Filtro de pesquisa
                if (searchQuery) {
                  const query = searchQuery.toLowerCase();
                  const cnpjFormatted = contabilidade.cnpj?.replace(
                    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                    "$1.$2.$3/$4-$5"
                  );
                  const matchesCnpj = contabilidade.cnpj?.includes(query) || cnpjFormatted?.includes(query);
                  const matchesNome = contabilidade.nome.toLowerCase().includes(query);
                  const matchesFantasia = contabilidade.nomeFantasia?.toLowerCase().includes(query);
                  
                  if (!matchesCnpj && !matchesNome && !matchesFantasia) {
                    return false;
                  }
                }
                
                // Filtro por ativo
                if (filterAtivo !== "all") {
                  const isAtivo = filterAtivo === "true";
                  if (contabilidade.ativo !== isAtivo) return false;
                }
                
                return true;
              })
              .map((contabilidade) => (
              <Card key={contabilidade.id} className="hover-elevate">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold mb-2" data-testid={`text-accountant-${contabilidade.id}`}>
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
                            <Badge variant="outline" className="border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 mt-1">
                              Inativa
                            </Badge>
                          )}
                          {contabilidade.companies && contabilidade.companies.length > 0 && (
                            <div className="flex items-start gap-2 mt-2 pt-2 border-t">
                              <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <div className="flex flex-wrap gap-2">
                                {contabilidade.companies.map((empresa) => (
                                  <Badge
                                    key={empresa.id}
                                    variant="outline"
                                    className="bg-muted"
                                    data-testid={`badge-company-${contabilidade.id}-${empresa.id}`}
                                  >
                                    {empresa.razaoSocial}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(contabilidade)}
                        data-testid={`button-edit-${contabilidade.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(contabilidade)}
                        data-testid={`button-delete-${contabilidade.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhuma contabilidade cadastrada
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Adicione escritórios contábeis para facilitar o envio de documentos
              </p>
              <Button onClick={handleNewAccountant}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Contabilidade
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Dialog de Cadastro */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingAccountant(null);
            setSelectedCompanies(new Set());
            reset();
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAccountant ? "Editar Contabilidade" : "Cadastrar Nova Contabilidade"}
              </DialogTitle>
              <DialogDescription>
                {editingAccountant 
                  ? "Atualize as informações do escritório contábil"
                  : "Preencha as informações do escritório contábil"
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto">
              {/* Dados da Contabilidade */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Dados da Contabilidade</h3>
                
                {/* CNPJ com busca */}
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <div className="flex gap-2">
                    <Input
                      id="cnpj"
                      {...register("cnpj", {
                        onChange: (e) => {
                          e.target.value = formatCnpj(e.target.value);
                          setCnpjSearchResult(null);
                        },
                      })}
                      placeholder="00.000.000/0000-00"
                      className="h-11 flex-1"
                      maxLength={18}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSearchCNPJ}
                      disabled={isSearchingCNPJ || !watch("cnpj")}
                      className="h-11"
                    >
                      {isSearchingCNPJ ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Buscar
                        </>
                      )}
                    </Button>
                  </div>
                  {cnpjSearchResult === "success" && (
                    <Alert className="bg-primary/10 border-primary/20 text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        Dados da Receita Federal carregados com sucesso!
                      </AlertDescription>
                    </Alert>
                  )}
                  {cnpjSearchResult === "error" && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        CNPJ não encontrado ou inválido
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label>
                    <Input
                      id="inscricaoEstadual"
                      {...register("inscricaoEstadual")}
                      placeholder="000.000.000.000"
                      className="h-11"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="crt">CRT - Código de Regime Tributário</Label>
                    <Select
                      value={watch("crt") || ""}
                      onValueChange={(value) => setValue("crt", value)}
                    >
                      <SelectTrigger id="crt" className="h-11">
                        <SelectValue placeholder="Selecione o CRT" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Simples Nacional</SelectItem>
                        <SelectItem value="2">2 - Simples Nacional (Excesso)</SelectItem>
                        <SelectItem value="3">3 - Regime Normal</SelectItem>
                        <SelectItem value="4">4 - MEI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nome">Razão Social / Nome *</Label>
                  <Input
                    id="nome"
                    {...register("nome", { required: "Nome é obrigatório" })}
                    data-testid="input-accountant-name"
                    placeholder="Nome do Escritório Contábil"
                    className="h-11"
                  />
                  {errors.nome && (
                    <p className="text-sm text-destructive">{errors.nome.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                  <Input
                    id="nomeFantasia"
                    {...register("nomeFantasia")}
                    placeholder="Nome Fantasia"
                    className="h-11"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      {...register("telefone")}
                      placeholder="(11) 91234-5678"
                      className="h-11"
                      maxLength={15}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="emailContador">Email do Contador *</Label>
                    <Input
                      id="emailContador"
                      {...register("emailContador", { 
                        required: "Email é obrigatório",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Email inválido",
                        },
                      })}
                      data-testid="input-accountant-email"
                      type="email"
                      placeholder="contador@escritorio.com.br"
                      className="h-11"
                    />
                    {errors.emailContador && (
                      <p className="text-sm text-destructive">{errors.emailContador.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Endereço</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="rua">Rua</Label>
                    <Input
                      id="rua"
                      {...register("rua")}
                      placeholder="Rua, Avenida..."
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      {...register("numero")}
                      placeholder="123"
                      className="h-11"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      {...register("bairro")}
                      placeholder="Bairro"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      {...register("cidade")}
                      placeholder="Cidade"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uf">UF</Label>
                    <Input
                      id="uf"
                      {...register("uf")}
                      placeholder="SP"
                      maxLength={2}
                      className="h-11 uppercase"
                      onChange={(e) => {
                        e.target.value = e.target.value.toUpperCase();
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      {...register("cep", {
                        onChange: (e) => {
                          e.target.value = formatCep(e.target.value);
                        },
                      })}
                      placeholder="00000-000"
                      className="h-11"
                      maxLength={9}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Empresas Associadas *</Label>
                <p className="text-sm text-muted-foreground">
                  Selecione quais empresas serão atendidas por esta contabilidade
                </p>
                {companies.length > 0 ? (
                  <div className="space-y-2 border rounded-lg p-4 max-h-60 overflow-y-auto">
                    {companies.map((empresa) => (
                      <div
                        key={empresa.id}
                        className="flex items-center space-x-2 p-2 rounded hover-elevate"
                      >
                        <Checkbox
                          id={`empresa-${empresa.id}`}
                          checked={selectedCompanies.has(empresa.id)}
                          onCheckedChange={() => toggleCompany(empresa.id)}
                          data-testid={`checkbox-empresa-${empresa.id}`}
                        />
                        <label
                          htmlFor={`empresa-${empresa.id}`}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          <div className="font-medium">{empresa.razaoSocial}</div>
                          <div className="text-xs text-muted-foreground">
                            {empresa.cnpj.replace(
                              /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                              "$1.$2.$3/$4-$5"
                            )}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Card className="p-4 bg-muted/50">
                    <p className="text-sm text-center text-muted-foreground">
                      Nenhuma empresa cadastrada. Cadastre clientes primeiro.
                    </p>
                  </Card>
                )}
                {selectedCompanies.size === 0 && (
                  <p className="text-sm text-destructive">Selecione pelo menos uma empresa</p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  data-testid="button-save-accountant"
                  disabled={isSubmitting || selectedCompanies.size === 0}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editingAccountant ? "Atualizando..." : "Salvando..."}
                    </>
                  ) : (
                    editingAccountant ? "Atualizar Contabilidade" : "Salvar Contabilidade"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a contabilidade{" "}
                <span className="font-semibold">{accountantToDelete?.nome}</span>?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  "Excluir"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
