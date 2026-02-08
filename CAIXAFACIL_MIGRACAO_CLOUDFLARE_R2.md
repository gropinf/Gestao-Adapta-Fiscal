# CaixaFacil – migração Contabo ➜ Cloudflare R2

Este documento descreve o que o projeto **CaixaFacil** precisa para usar **Cloudflare R2** com as **mesmas variáveis de ambiente** deste projeto e deixar de usar o Contabo.

## Objetivo

- Padronizar as variáveis de ambiente no CaixaFacil para o mesmo formato usado aqui.
- Desativar o Contabo (sem fallback).

## Variáveis de ambiente (obrigatórias)

Configure no Replit (Secrets) ou no `.env`:

```env
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_PUBLIC_ENDPOINT=https://<public-domain-ou-endpoint>
R2_REGION=auto
R2_BUCKET=<nome-do-bucket>
R2_ACCESS_KEY=<access-key>
R2_SECRET_KEY=<secret-key>
R2_FALLBACK_DISABLED=true
```

Notas:
- `R2_PUBLIC_ENDPOINT` deve ser o endpoint público do seu bucket (ou o domínio custom).
- `R2_FALLBACK_DISABLED=true` garante que **não** haja fallback para Contabo.

## O que remover do Contabo

As variáveis abaixo **não devem** existir no CaixaFacil se a migração for total:

```env
CONTABO_STORAGE_ENDPOINT=
CONTABO_STORAGE_REGION=
CONTABO_STORAGE_BUCKET=
CONTABO_STORAGE_ACCESS_KEY=
CONTABO_STORAGE_SECRET_KEY=
CONTABO_STORAGE_PUBLIC_PREFIX=
```

## Ajustes de código no CaixaFacil

No projeto CaixaFacil, alinhe os módulos de storage para usar **apenas** R2:

1. Substituir qualquer uso de variáveis `CONTABO_*` por `R2_*`.
2. Remover fluxos que chamam Contabo (listagem, download, upload, delete).
3. Garantir que URLs públicas sejam geradas via `R2_PUBLIC_ENDPOINT` e `R2_BUCKET`.

## Checklist de validação

- Upload de XML funciona e retorna URL em R2.
- Download de XML funciona via URL pública.
- Listagem de objetos aponta para R2.
- Exclusão remove apenas no R2.
- Não há chamadas para Contabo no código (nem fallback).

## Observação sobre migração de dados

Se existirem arquivos no Contabo que precisam ir para o R2, execute a migração antes de desligar o Contabo. A migração pode ser feita via script/rotina dedicada ou via tela de migração que criamos neste projeto.
