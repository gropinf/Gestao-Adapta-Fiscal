# 📝 Migração de console.log para Logger

Este documento lista os console.log/error que ainda precisam ser migrados para o novo sistema de logging.

## Arquivos que usam console.log/error:

### server/routes.ts
- ~90 ocorrências encontradas
- Algumas já foram migradas (login, registration, authMiddleware)
- Restantes: endpoints de empresas, XMLs, relatórios, etc.

### Outros arquivos:
- server/storage.ts
- server/xmlParser.ts
- server/xmlEventParser.ts
- server/emailService.ts
- server/emailMonitorService.ts
- server/danfeService.ts
- server/excelExport.ts
- server/receitaWS.ts
- server/utils/companyAutoCreate.ts
- server/middleware/authorization.ts

## Estratégia de Migração:

### Prioridade Alta (já migrado):
- ✅ auth.ts - authMiddleware
- ✅ routes.ts - login, registration, logout

### Prioridade Média:
- ⏳ routes.ts - error handlers de endpoints principais
- ⏳ storage.ts - operações críticas de banco

### Prioridade Baixa:
- ⏳ Outros arquivos - migrar gradualmente

## Como Migrar:

### Antes:
```typescript
console.error("Erro ao processar XML:", error);
```

### Depois:
```typescript
import { logger } from "./logger";

logger.error("Erro ao processar XML", error instanceof Error ? error : new Error(String(error)), {
  xmlId: xml.id,
  companyId: company.id,
});
```

## Benefícios:
- Logs estruturados em produção (JSON)
- Contexto adicional para debugging
- Controle de nível de log (debug não aparece em produção)
- Facilita integração com serviços de monitoramento

