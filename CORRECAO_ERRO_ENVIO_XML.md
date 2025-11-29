# 🔧 Correção de Erro: Envio de XMLs por Email

**Data:** 06/11/2025  
**Status:** ✅ **RESOLVIDO**

---

## ❌ Erro Encontrado

```
Failed to resolve import "@/store/authStore" from "client/src/pages/envio-xml-email.tsx". 
Does the file exist?
```

---

## 🔍 Causa do Problema

1. **Import incorreto:** Estava usando `@/store/authStore` que não existe no projeto
2. **Estrutura incorreta:** Tentei usar `selectedCompany` diretamente do store, mas o store só tem `currentCompanyId`
3. **Padrão diferente:** Não segui o padrão usado em outros componentes do projeto

---

## ✅ Solução Aplicada

### Antes (❌ Incorreto)

```typescript
import { useAuthStore } from "@/store/authStore";

export default function EnvioXmlEmail() {
  const { selectedCompany } = useAuthStore();
  // ...
}
```

### Depois (✅ Correto)

```typescript
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { Company } from "@shared/schema";

export default function EnvioXmlEmail() {
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
  
  // Busca lista de empresas do usuário
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await fetch("/api/companies", {
        headers: getAuthHeader(),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar empresas");
      return response.json();
    },
  });

  // Empresa selecionada atualmente
  const selectedCompany = companies?.find((c) => c.id === currentCompanyId);
  
  // Agora usa currentCompanyId nas requisições
  const loadHistory = async () => {
    if (!currentCompanyId) return;
    const response = await fetch(
      `/api/xml-email/history?companyId=${currentCompanyId}`,
      { credentials: "include" }
    );
    // ...
  };
}
```

---

## 📚 Padrão do Projeto

### Estrutura de Autenticação

**Arquivo:** `client/src/lib/auth.tsx`

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  currentCompanyId: string | null;  // ← Armazena apenas o ID
  accessLogId: string | null;
  setAuth: (user: User, token: string, accessLogId?: string) => void;
  setCurrentCompany: (companyId: string) => void;
  setAccessLogId: (accessLogId: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      currentCompanyId: null,
      accessLogId: null,
      // ... métodos
    }),
    { name: 'auth-storage' }
  )
);
```

### Como Buscar Empresa Atual

**Padrão usado em:** `dashboard.tsx`, `xmls.tsx`, `relatorios.tsx`, etc.

```typescript
// 1. Pegar currentCompanyId do store
const currentCompanyId = useAuthStore((state) => state.currentCompanyId);

// 2. Buscar lista de empresas
const { data: companies } = useQuery<Company[]>({
  queryKey: ["/api/companies"],
  queryFn: async () => {
    const response = await fetch("/api/companies", {
      headers: getAuthHeader(),
      credentials: "include",
    });
    if (!response.ok) throw new Error("Erro ao buscar empresas");
    return response.json();
  },
});

// 3. Filtrar empresa selecionada
const selectedCompany = companies?.find((c) => c.id === currentCompanyId);
```

### Endpoints Disponíveis

| Endpoint | Método | Retorno |
|----------|--------|---------|
| `/api/companies` | GET | Array de empresas do usuário |
| ❌ `/api/companies/:id` | GET | **NÃO EXISTE** |

---

## 🔄 Alterações Realizadas

### Arquivo: `client/src/pages/envio-xml-email.tsx`

**Imports corrigidos:**
```diff
- import { useAuthStore } from "@/store/authStore";
+ import { useAuthStore, getAuthHeader } from "@/lib/auth";
+ import { useQuery } from "@tanstack/react-query";
+ import type { Company } from "@shared/schema";
```

**State management corrigido:**
```diff
- const { selectedCompany } = useAuthStore();
+ const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
+ 
+ const { data: companies } = useQuery<Company[]>({
+   queryKey: ["/api/companies"],
+   queryFn: async () => {
+     const response = await fetch("/api/companies", {
+       headers: getAuthHeader(),
+       credentials: "include",
+     });
+     if (!response.ok) throw new Error("Erro ao buscar empresas");
+     return response.json();
+   },
+ });
+ 
+ const selectedCompany = companies?.find((c) => c.id === currentCompanyId);
```

**Uso nas funções corrigido:**
```diff
- `/api/xml-email/history?companyId=${selectedCompany.id}`
+ `/api/xml-email/history?companyId=${currentCompanyId}`

- companyId: selectedCompany.id
+ companyId: currentCompanyId
```

---

## ✅ Verificações Finais

- [x] Import correto: `@/lib/auth`
- [x] useQuery configurado para buscar empresas
- [x] selectedCompany derivado de currentCompanyId
- [x] Todas requisições usam currentCompanyId
- [x] Linter sem erros
- [x] Compilação bem-sucedida
- [x] Padrão consistente com outros componentes

---

## 📝 Lições Aprendidas

1. **Sempre verificar o padrão do projeto antes de implementar**
   - Outros arquivos já usam o mesmo padrão
   - Exemplo: `dashboard.tsx`, `xmls.tsx`, `relatorios.tsx`

2. **O auth store não guarda o objeto completo da empresa**
   - Apenas `currentCompanyId` (string)
   - Dados completos vêm do endpoint `/api/companies`

3. **Não existe endpoint GET /api/companies/:id**
   - Sempre buscar lista e filtrar localmente
   - React Query faz cache automático

4. **Import paths são cruciais**
   - `@/lib/auth` ✅ Correto
   - `@/store/authStore` ❌ Não existe

---

## 🚀 Status Final

✅ **Problema resolvido completamente!**

A página de envio de XMLs por email agora:
- Importa corretamente do `@/lib/auth`
- Usa `currentCompanyId` do store
- Busca dados da empresa via React Query
- Segue o padrão do projeto
- Compila sem erros
- Pronta para uso!

---

**Próximos passos:** Testar a funcionalidade no navegador! 🎉






