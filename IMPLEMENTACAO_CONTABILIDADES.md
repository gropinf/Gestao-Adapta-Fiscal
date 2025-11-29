# Implementação Completa - Página de Contabilidades

## ✅ O que já foi implementado:

1. **Schema** - Tabela `accountants` atualizada com campos:
   - cnpj, nome_fantasia, inscricao_estadual, crt
   - telefone, rua, numero, bairro, cidade, uf, cep
   - ativo (boolean)

2. **Migration** - `008_add_company_fields_to_accountants.sql` criada e aplicada

3. **Backend** - Interface `AccountantForm` atualizada

4. **Funções JavaScript**:
   - `formatCnpj()` - Formata CNPJ
   - `formatCep()` - Formata CEP
   - `handleSearchCNPJ()` - Busca dados na ReceitaWS
   - Mutations atualizadas para incluir novos campos

## 🚧 Implementações Pendentes

### 1. FORMULÁRIO COMPLETO (Substituir linha ~544-570)

Substituir o conteúdo do formulário atual por:

```tsx
<form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto">
  {/* Dados da Empresa */}
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

  {/* Empresas Associadas - MANTER O CÓDIGO EXISTENTE */}
  <div className="space-y-4">
    <Label>Empresas Associadas *</Label>
    <p className="text-sm text-muted-foreground">
      Selecione quais empresas serão atendidas por esta contabilidade
    </p>
    {/* ... resto do código de seleção de empresas ... */}
  </div>

  <DialogFooter>
    {/* ... botões existentes ... */}
  </DialogFooter>
</form>
```

### 2. PESQUISA NA LISTAGEM (Adicionar após linha ~435, antes da listagem)

```tsx
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
```

### 3. FILTRO NA LISTAGEM (Substituir linha ~445)

```tsx
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
```

### 4. CARDS COM NOVOS CAMPOS (Substituir linha ~457-479)

```tsx
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
    <Badge variant="outline" className="border-red-300 dark:border-red-700 text-red-600 dark:text-red-400">
      Inativa
    </Badge>
  )}
  {contabilidade.companies && contabilidade.companies.length > 0 && (
    <div className="flex items-start gap-2 mt-2">
      <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="flex flex-wrap gap-2">
        {contabilidade.companies.map((empresa) => (
          <Badge
            key={empresa.id}
            variant="outline"
            className="bg-muted"
          >
            {empresa.razaoSocial}
          </Badge>
        ))}
      </div>
    </div>
  )}
</div>
```

## 🎯 Resultado Final

Com essas implementações, a página de contabilidades terá:

- ✅ Cadastro completo com CNPJ, endereço, CRT, telefone, email
- ✅ Busca automática de dados na ReceitaWS pelo CNPJ
- ✅ Pesquisa em tempo real (CNPJ, Razão Social, Nome Fantasia)
- ✅ Filtro por status (Ativa/Inativa)
- ✅ Exibição de todos os dados nos cards
- ✅ Formulários com máscara de CNPJ e CEP
- ✅ Validação de campos obrigatórios

## 📝 Observação

O backend (routes.ts) precisa ser atualizado para aceitar os novos campos nas rotas:
- POST /api/accountants
- PUT /api/accountants/:id

Verifique se o storage.ts também precisa de atualizações nos métodos:
- createAccountant()
- updateAccountant()








