# Campo Status na Lista de XMLs

## Informação Exibida

O campo exibe o **status de validação** de cada XML na página `/xmls`, com dois valores possíveis:

- ✅ **Válido** - Badge verde com ícone CheckCircle2
- ❌ **Inválido** - Badge vermelho com ícone FileX

---

## Lógica Utilizada

### 1. Frontend (`/workspace/client/src/pages/xmls.tsx`)

**Linhas 354-373**: Renderização do status na tabela

```tsx
<td className="px-6 py-4">
  {xml.statusValidacao === "valido" ? (
    <Badge
      variant="outline"
      className="bg-primary/10 text-primary border-primary/20"
      data-testid={`status-valid-${xml.id}`}
    >
      <CheckCircle2 className="w-3 h-3 mr-1" />
      Válido
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="bg-destructive/10 text-destructive border-destructive/20"
      data-testid={`status-invalid-${xml.id}`}
    >
      <FileX className="w-3 h-3 mr-1" />
      Inválido
    </Badge>
  )}
</td>
```

---

### 2. Backend - Definição no Schema (`/workspace/shared/schema.ts`)

**Linha 78**: Definição do campo no banco de dados

```typescript
statusValidacao: text("status_validacao").notNull().default("valido"), // valido, invalido, pendente
```

**Valores possíveis**: `"valido"`, `"invalido"`, `"pendente"`

---

### 3. Backend - Atribuição Durante o Upload (`/workspace/server/routes.ts`)

**Linhas 1172-1186**: Criação do registro no banco

Atualmente, **todos os XMLs que passam pela validação recebem status "valido"** automaticamente:

```typescript
const xml = await storage.createXml({
  companyId: targetCompanyId,
  chave: parsedXml.chave,
  tipoDoc: parsedXml.tipoDoc,
  dataEmissao: parsedXml.dataEmissao,
  hora: parsedXml.hora || "00:00:00",
  cnpjEmitente: parsedXml.cnpjEmitente,
  cnpjDestinatario: parsedXml.cnpjDestinatario || null,
  razaoSocialDestinatario: parsedXml.razaoSocialDestinatario || null,
  totalNota: parsedXml.totalNota.toString(),
  totalImpostos: parsedXml.totalImpostos.toString(),
  categoria,
  statusValidacao: "valido", // ← Sempre definido como "valido"
  filepath: saveResult.filepath || "",
});
```

---

## Validações Realizadas Antes de Marcar como "Válido"

O XML passa por **10 etapas de validação** antes de ser salvo como "valido":

### Etapa 1: Validação de Extensão
- Verifica se o arquivo termina com `.xml`
- **Erro**: "Arquivo não é XML (extensão inválida)"

### Etapa 2: Validação de Estrutura XML NFe
- Verifica presença de tags básicas: `<NFe>`, `<nfeProc>`, `<infNFe>`
- Função: `isValidNFeXml(xmlContent)`
- **Erro**: "Arquivo não é um XML de NFe/NFCe válido"

### Etapa 3: Parse do XML
- Extrai todos os dados estruturados do XML
- Função: `parseXmlContent(xmlContent)`
- **Erro**: Mensagem específica do parser

### Etapa 4: Validação da Chave
- Verifica se a chave tem exatamente 44 dígitos numéricos
- Função: `validateChave(parsedXml.chave)`
- **Erro**: "Chave de acesso inválida (deve ter 44 dígitos numéricos)"

### Etapa 5: Verificação de Duplicata no Banco
- Consulta se a chave já existe no banco de dados
- **Erro**: "XML duplicado (chave já existe no banco de dados)"

### Etapa 6: Verificação de Duplicata no Storage
- Verifica se o arquivo já existe no storage físico
- **Erro**: "XML duplicado (arquivo já existe no storage)"

### Etapa 7: Categorização Automática
- Determina se é "emitida" ou "recebida"
- Compara CNPJ emitente/destinatário com empresas do usuário

### Etapa 8: Salvamento no Storage
- Salva o arquivo XML no diretório `validated/`
- **Erro**: "Erro ao salvar arquivo no storage"

### Etapa 9: Salvamento no Banco de Dados
- Insere registro completo na tabela `xmls`

### Etapa 10: Limpeza
- Remove arquivo temporário do upload

---

## Status "Inválido"

### Comportamento Atual

**⚠️ IMPORTANTE**: Atualmente **não existe lógica implementada** para marcar XMLs como "invalido" após o upload.

**Fluxo atual**:
- ✅ XML válido → Salvo com `statusValidacao: "valido"`
- ❌ XML inválido → **Rejeitado no upload**, não é salvo no banco

### Único Caso de Status "Inválido"

O único XML com status "invalido" no sistema é criado **manualmente nos seeds de teste**:

```typescript
// server/seeds.ts - Linhas 294-298
{
  totalNota: "890.00",
  totalImpostos: "160.20",
  categoria: "recebida",
  statusValidacao: "invalido", // Um XML inválido para testar alertas
}
```

Esse XML é usado para testar:
- Geração de alertas para XMLs inválidos
- Exibição visual de badges vermelhos na interface
- Filtros por status na página `/xmls`

---

## Fluxo de Validação Completo

```
Upload de XML
    ↓
[Extensão .xml?] → NÃO → ❌ Rejeitado
    ↓ SIM
[Tags NFe válidas?] → NÃO → ❌ Rejeitado
    ↓ SIM
[Parse com sucesso?] → NÃO → ❌ Rejeitado
    ↓ SIM
[Chave 44 dígitos?] → NÃO → ❌ Rejeitado
    ↓ SIM
[Duplicado no BD?] → SIM → ❌ Rejeitado
    ↓ NÃO
[Duplicado no storage?] → SIM → ❌ Rejeitado
    ↓ NÃO
[Salva no storage] → ERRO → ❌ Rejeitado
    ↓ OK
✅ Salvo no BD com statusValidacao: "valido"
```

---

## Filtro de Status na Interface

### Frontend - Filtro na Página `/xmls`

**Linhas 232-241**: Select de status

```tsx
<Select value={statusValidacao} onValueChange={setStatusValidacao}>
  <SelectTrigger className="w-[180px] h-11">
    <SelectValue placeholder="Status" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Todos</SelectItem>
    <SelectItem value="valido">Válidos</SelectItem>
    <SelectItem value="invalido">Inválidos</SelectItem>
  </SelectContent>
</Select>
```

### Backend - Filtro na API

**Arquivo**: `/workspace/server/storage.ts` - Linhas 248-249

```typescript
if (filters?.statusValidacao) {
  query = query.where(eq(xmls.statusValidacao, filters.statusValidacao)) as any;
}
```

---

## Possíveis Melhorias Futuras

### 1. Validação de Assinatura Digital
- Verificar certificado digital do XML
- Validar hash e integridade

### 2. Consulta SEFAZ
- Verificar se a NFe está autorizada na SEFAZ
- Consultar status da nota fiscal
- Verificar cancelamento/inutilização

### 3. Validação de Conteúdo
- Verificar consistência de valores
- Validar cálculos de impostos
- Verificar campos obrigatórios por tipo de operação

### 4. Status "Pendente"
- Implementar status intermediário para XMLs em validação assíncrona
- Útil para validações que dependem de APIs externas

### 5. Revalidação
- Permitir revalidar XMLs já importados
- Marcar como "invalido" XMLs que falharem em validações posteriores
- Histórico de validações

---

## Conclusão

**O campo status mostra se o XML foi validado com sucesso durante o upload.**

### Lógica Atual (Binária)
- ✅ Passou em todas as validações → `statusValidacao: "valido"` → Salvo no banco
- ❌ Falhou em alguma validação → Não é salvo → Aparece como erro no resultado do upload

### Limitação Atual
Não há mecanismo para:
- Marcar XMLs já importados como "invalido"
- Atualizar status após validações posteriores
- Criar XMLs com status "invalido" via interface (apenas por seed manual)

### Impacto
O campo `statusValidacao` é mais um **indicador de sucesso no upload** do que um sistema de validação contínua. XMLs inválidos simplesmente não entram no sistema.












