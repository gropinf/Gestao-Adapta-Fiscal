import { useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Building2, Edit, Trash2, Loader2, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import type { Company } from "@shared/schema";
import { CompanyEditDialog } from "@/components/CompanyEditDialog";

interface CompanyForm {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  crt?: string;
  telefone?: string;
  email?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  ativo?: boolean;
  status?: number;
}

export default function Clientes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);
  const [cnpjSearchResult, setCnpjSearchResult] = useState<"success" | "error" | null>(null);
  const [filterAtivo, setFilterAtivo] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState("");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<CompanyForm>();

  // Fetch companies
  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetch("/api/companies", {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Erro ao carregar clientes");
      }

      return res.json();
    },
  });

  // Create company mutation
  const createMutation = useMutation({
    mutationFn: async (data: CompanyForm) => {
      // Remove máscaras antes de enviar
      const cleanData = {
        ...data,
        cnpj: data.cnpj.replace(/\D/g, ""),
        cep: data.cep?.replace(/\D/g, ""),
      };

      const res = await fetch("/api/companies", {
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
        throw new Error(error.error || "Erro ao criar cliente");
      }

      return res.json();
    },
  });

  // Update company mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CompanyForm }) => {
      const cleanData = {
        ...data,
        cnpj: data.cnpj.replace(/\D/g, ""),
        cep: data.cep?.replace(/\D/g, ""),
      };

      const res = await fetch(`/api/companies/${id}`, {
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
        throw new Error(error.error || "Erro ao atualizar cliente");
      }

      return res.json();
    },
  });

  // Delete company mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao deletar cliente");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setDeleteDialogOpen(false);
      setCompanyToDelete(null);
      toast({
        title: "Cliente removido!",
        description: "O cliente foi removido com sucesso",
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

  const uploadCertificate = async (companyId: string) => {
    if (!certificateFile || !certificatePassword) return;
    const formData = new FormData();
    formData.append("certificate", certificateFile);
    formData.append("certPassword", certificatePassword);
    const res = await fetch(`/api/companies/${companyId}/certificate`, {
      method: "POST",
      headers: getAuthHeader(),
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "Erro ao enviar certificado");
    }
  };

  const onSubmit = async (data: CompanyForm) => {
    try {
      if ((certificateFile && !certificatePassword) || (!certificateFile && certificatePassword)) {
        toast({
          title: "Certificado incompleto",
          description: "Informe certificado A1 e senha.",
          variant: "destructive",
        });
        return;
      }
      if (editingCompany) {
        const company = await updateMutation.mutateAsync({ id: editingCompany.id, data });
        await uploadCertificate(company.id);
      } else {
        const company = await createMutation.mutateAsync(data);
        await uploadCertificate(company.id);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsDialogOpen(false);
      setEditingCompany(null);
      reset();
      setCertificateFile(null);
      setCertificatePassword("");
      toast({
        title: editingCompany ? "Cliente atualizado!" : "Cliente cadastrado!",
        description: "As informações foram salvas com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    // Formata CNPJ para exibição
    const cnpjFormatted = company.cnpj.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
    const cepFormatted = company.cep?.replace(/^(\d{5})(\d{3})$/, "$1-$2");
    
    reset({
      cnpj: cnpjFormatted,
      razaoSocial: company.razaoSocial,
      nomeFantasia: company.nomeFantasia || "",
      inscricaoEstadual: company.inscricaoEstadual || "",
      crt: company.crt || "",
      telefone: company.telefone || "",
      email: company.email || "",
      rua: company.rua || "",
      numero: company.numero || "",
      bairro: company.bairro || "",
      cidade: company.cidade || "",
      uf: company.uf || "",
      cep: cepFormatted || "",
      ativo: company.ativo ?? true,
      status: company.status ?? 2,
    });
    setCertificateFile(null);
    setCertificatePassword("");
    setIsDialogOpen(true);
  };

  const handleDelete = (company: Company) => {
    setCompanyToDelete(company);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (companyToDelete) {
      deleteMutation.mutate(companyToDelete.id);
    }
  };

  const handleNewCliente = () => {
    setEditingCompany(null);
    reset({
      cnpj: "",
      razaoSocial: "",
      nomeFantasia: "",
      inscricaoEstadual: "",
      ativo: true,
      status: 2,
    });
    setCertificateFile(null);
    setCertificatePassword("");
    setIsDialogOpen(true);
  };

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
      setValue("razaoSocial", data.razaoSocial);
      setValue("nomeFantasia", data.nomeFantasia);
      setValue("telefone", data.telefone || "");
      setValue("email", data.email || "");
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

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Clientes</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os emitentes cadastrados
            </p>
          </div>
          <Button onClick={handleNewCliente} data-testid="button-add-cliente">
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>

        {/* Pesquisa e Filtros */}
        {companies.length > 0 && (
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
                    Status de Ativação
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

                <div className="flex-1">
                  <Label htmlFor="filter-status" className="text-sm">
                    Status
                  </Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger id="filter-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="1">Aguardando Liberação</SelectItem>
                      <SelectItem value="2">Liberado</SelectItem>
                      <SelectItem value="3">Suspenso</SelectItem>
                      <SelectItem value="4">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(filterAtivo !== "all" || filterStatus !== "all") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFilterAtivo("all");
                      setFilterStatus("all");
                    }}
                  >
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clientes list */}
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Carregando clientes...</p>
          </div>
        ) : companies.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {companies
              .filter((cliente) => {
                // Filtro de pesquisa
                if (searchQuery) {
                  const query = searchQuery.toLowerCase();
                  const cnpjFormatted = cliente.cnpj.replace(
                    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                    "$1.$2.$3/$4-$5"
                  );
                  const matchesCnpj = cliente.cnpj.includes(query) || cnpjFormatted.includes(query);
                  const matchesRazao = cliente.razaoSocial.toLowerCase().includes(query);
                  const matchesFantasia = cliente.nomeFantasia?.toLowerCase().includes(query);
                  
                  if (!matchesCnpj && !matchesRazao && !matchesFantasia) {
                    return false;
                  }
                }
                
                // Filtro por ativo
                if (filterAtivo !== "all") {
                  const isAtivo = filterAtivo === "true";
                  if (cliente.ativo !== isAtivo) return false;
                }
                // Filtro por status
                if (filterStatus !== "all") {
                  if (cliente.status !== parseInt(filterStatus)) return false;
                }
                return true;
              })
              .map((cliente) => (
              <Card key={cliente.id} className="hover-elevate">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-semibold" data-testid={`text-cliente-${cliente.id}`}>
                            {cliente.razaoSocial}
                          </h3>
                          {/* Badge de Status */}
                          {cliente.status === 1 && (
                            <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100">
                              Aguardando
                            </Badge>
                          )}
                          {cliente.status === 2 && (
                            <Badge variant="default" className="bg-green-600">
                              Liberado
                            </Badge>
                          )}
                          {cliente.status === 3 && (
                            <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-100">
                              Suspenso
                            </Badge>
                          )}
                          {cliente.status === 4 && (
                            <Badge variant="destructive">
                              Cancelado
                            </Badge>
                          )}
                          {/* Badge de Ativo/Inativo */}
                          {!cliente.ativo && (
                            <Badge variant="outline" className="border-red-300 dark:border-red-700 text-red-600 dark:text-red-400">
                              Inativa
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>
                            <span className="font-medium">CNPJ:</span>{" "}
                            {cliente.cnpj.replace(
                              /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                              "$1.$2.$3/$4-$5"
                            )}
                          </p>
                          {cliente.nomeFantasia && (
                            <p>
                              <span className="font-medium">Nome Fantasia:</span>{" "}
                              {cliente.nomeFantasia}
                            </p>
                          )}
                          {cliente.crt && (
                            <p>
                              <span className="font-medium">CRT:</span>{" "}
                              {cliente.crt === "1" && "Simples Nacional"}
                              {cliente.crt === "2" && "Simples Nacional (Excesso)"}
                              {cliente.crt === "3" && "Regime Normal"}
                              {cliente.crt === "4" && "MEI"}
                            </p>
                          )}
                          {cliente.telefone && (
                            <p>
                              <span className="font-medium">Telefone:</span>{" "}
                              {cliente.telefone}
                            </p>
                          )}
                          {cliente.email && (
                            <p>
                              <span className="font-medium">Email:</span>{" "}
                              {cliente.email}
                            </p>
                          )}
                          {cliente.cidade && cliente.uf && (
                            <p>
                              <span className="font-medium">Localização:</span>{" "}
                              {cliente.cidade} - {cliente.uf}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(cliente)}
                        data-testid={`button-edit-${cliente.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(cliente)}
                        data-testid={`button-delete-${cliente.id}`}
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
              <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhum cliente cadastrado
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Comece cadastrando seu primeiro emitente
              </p>
              <Button onClick={handleNewCliente}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Cliente
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Dialog de Cadastro/Edição */}
        {editingCompany ? (
          <CompanyEditDialog
            company={editingCompany}
            isOpen={isDialogOpen}
            onClose={() => {
              setIsDialogOpen(false);
              setEditingCompany(null);
              reset();
              setCertificateFile(null);
              setCertificatePassword("");
            }}
            editForm={
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
              {/* Dados da Empresa */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Dados da Empresa</h3>
                
                {/* CNPJ com busca */}
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="cnpj"
                      {...register("cnpj", { 
                        required: "CNPJ é obrigatório",
                        onChange: (e) => {
                          e.target.value = formatCnpj(e.target.value);
                          setCnpjSearchResult(null);
                        },
                      })}
                      data-testid="input-cnpj"
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
                      data-testid="button-search-cnpj"
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
                  {errors.cnpj && (
                    <p className="text-sm text-destructive">{errors.cnpj.message}</p>
                  )}
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
                      data-testid="input-ie"
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
                  <Label htmlFor="razaoSocial">Razão Social *</Label>
                  <Input
                    id="razaoSocial"
                    {...register("razaoSocial", { required: "Razão Social é obrigatória" })}
                    data-testid="input-razao-social"
                    placeholder="Razão Social da Empresa"
                    className="h-11"
                  />
                  {errors.razaoSocial && (
                    <p className="text-sm text-destructive">{errors.razaoSocial.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                  <Input
                    id="nomeFantasia"
                    {...register("nomeFantasia")}
                    data-testid="input-nome-fantasia"
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
                      data-testid="input-telefone"
                      placeholder="(11) 91234-5678"
                      className="h-11"
                      maxLength={15}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register("email")}
                      data-testid="input-email"
                      placeholder="contato@empresa.com.br"
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Certificado A1 (opcional)</Label>
                  <Input
                    type="file"
                    accept=".pfx,.p12"
                    onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                    className="h-11"
                  />
                  {editingCompany?.certificadoPath && (
                    <p className="text-xs text-muted-foreground">
                      Certificado atual cadastrado.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Senha do certificado</Label>
                  <Input
                    type="password"
                    value={certificatePassword}
                    onChange={(e) => setCertificatePassword(e.target.value)}
                    className="h-11"
                  />
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
                      data-testid="input-rua"
                      placeholder="Rua, Avenida..."
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      {...register("numero")}
                      data-testid="input-numero"
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
                      data-testid="input-bairro"
                      placeholder="Bairro"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      {...register("cidade")}
                      data-testid="input-cidade"
                      placeholder="Cidade"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uf">UF</Label>
                    <Input
                      id="uf"
                      {...register("uf")}
                      data-testid="input-uf"
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
                      data-testid="input-cep"
                      placeholder="00000-000"
                      className="h-11"
                      maxLength={9}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Certificado A1 (opcional)</Label>
                  <Input
                    type="file"
                    accept=".pfx,.p12"
                    onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha do certificado</Label>
                  <Input
                    type="password"
                    value={certificatePassword}
                    onChange={(e) => setCertificatePassword(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Status da Empresa</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status-edit">Status</Label>
                    <Select
                      value={watch("status")?.toString() || "2"}
                      onValueChange={(value) => setValue("status", parseInt(value))}
                    >
                      <SelectTrigger id="status-edit" className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Aguardando Liberação</SelectItem>
                        <SelectItem value="2">Liberado</SelectItem>
                        <SelectItem value="3">Suspenso</SelectItem>
                        <SelectItem value="4">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ativo-edit" className="mb-3 block">Empresa Ativa</Label>
                    <div className="flex items-center space-x-2 h-11">
                      <Switch
                        id="ativo-edit"
                        checked={watch("ativo") ?? true}
                        onCheckedChange={(checked) => setValue("ativo", checked)}
                      />
                      <Label htmlFor="ativo-edit" className="cursor-pointer">
                        {watch("ativo") ? "Ativa" : "Inativa"}
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingCompany(null);
                    reset();
                    setCertificateFile(null);
                    setCertificatePassword("");
                  }}
                  data-testid="button-cancel"
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  data-testid="button-save-cliente"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Atualizar Cliente"
                  )}
                </Button>
              </DialogFooter>
            </form>
            }
          />
        ) : (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              reset();
            }
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
                <DialogDescription>
                  Preencha as informações do emitente
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
              {/* Dados da Empresa */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Dados da Empresa</h3>
                
                {/* CNPJ com busca */}
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="cnpj"
                      {...register("cnpj", { 
                        required: "CNPJ é obrigatório",
                        onChange: (e) => {
                          e.target.value = formatCnpj(e.target.value);
                          setCnpjSearchResult(null);
                        },
                      })}
                      data-testid="input-cnpj"
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
                      data-testid="button-search-cnpj"
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
                  {errors.cnpj && (
                    <p className="text-sm text-destructive">{errors.cnpj.message}</p>
                  )}
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
                      data-testid="input-ie"
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
                  <Label htmlFor="razaoSocial">Razão Social *</Label>
                  <Input
                    id="razaoSocial"
                    {...register("razaoSocial", { required: "Razão Social é obrigatória" })}
                    data-testid="input-razao-social"
                    placeholder="Razão Social da Empresa"
                    className="h-11"
                  />
                  {errors.razaoSocial && (
                    <p className="text-sm text-destructive">{errors.razaoSocial.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                  <Input
                    id="nomeFantasia"
                    {...register("nomeFantasia")}
                    data-testid="input-nome-fantasia"
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
                      data-testid="input-telefone"
                      placeholder="(11) 91234-5678"
                      className="h-11"
                      maxLength={15}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register("email")}
                      data-testid="input-email"
                      placeholder="contato@empresa.com.br"
                      className="h-11"
                    />
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
                      data-testid="input-rua"
                      placeholder="Rua, Avenida..."
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      {...register("numero")}
                      data-testid="input-numero"
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
                      data-testid="input-bairro"
                      placeholder="Bairro"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      {...register("cidade")}
                      data-testid="input-cidade"
                      placeholder="Cidade"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uf">UF</Label>
                    <Input
                      id="uf"
                      {...register("uf")}
                      data-testid="input-uf"
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
                      data-testid="input-cep"
                      placeholder="00000-000"
                      className="h-11"
                      maxLength={9}
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Status da Empresa</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status-new">Status</Label>
                    <Select
                      value={watch("status")?.toString() || "2"}
                      onValueChange={(value) => setValue("status", parseInt(value))}
                    >
                      <SelectTrigger id="status-new" className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Aguardando Liberação</SelectItem>
                        <SelectItem value="2">Liberado</SelectItem>
                        <SelectItem value="3">Suspenso</SelectItem>
                        <SelectItem value="4">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ativo-new" className="mb-3 block">Empresa Ativa</Label>
                    <div className="flex items-center space-x-2 h-11">
                      <Switch
                        id="ativo-new"
                        checked={watch("ativo") ?? true}
                        onCheckedChange={(checked) => setValue("ativo", checked)}
                      />
                      <Label htmlFor="ativo-new" className="cursor-pointer">
                        {watch("ativo") ? "Ativa" : "Inativa"}
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    reset();
                    setCertificateFile(null);
                    setCertificatePassword("");
                  }}
                  data-testid="button-cancel"
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  data-testid="button-save-cliente"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Cliente"
                  )}
                </Button>
              </DialogFooter>
            </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o cliente{" "}
                <span className="font-semibold">{companyToDelete?.razaoSocial}</span>?
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
