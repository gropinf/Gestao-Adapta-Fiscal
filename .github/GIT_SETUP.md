# 🔐 Configuração de Autenticação Git

## Status Atual

✅ **Credential Helper configurado**: O Git está configurado para armazenar credenciais automaticamente.

## Como Funciona

O token do GitHub está armazenado de forma segura no sistema através do `credential.helper = store`.

### Próximos Pushes

Você não precisará inserir o token novamente. Basta executar:

```bash
git push
```

## Se Precisar Reconfigurar

Se o token expirar ou precisar ser atualizado:

1. **Gerar novo token no GitHub:**
   - Acesse: https://github.com/settings/tokens
   - Gere um novo token com permissão `repo`

2. **Usar o token:**
   ```bash
   git push -u https://SEU_TOKEN@github.com/gropinf/Gestao-Adapta-Fiscal.git main
   ```

3. **O credential helper salvará automaticamente**

## ⚠️ Segurança

- **NUNCA** commite tokens em arquivos do projeto
- Tokens expiram - verifique periodicamente
- Se um token for exposto, revogue imediatamente no GitHub

## Comandos Úteis

```bash
# Verificar remote configurado
git remote -v

# Verificar credential helper
git config --global credential.helper

# Limpar credenciais salvas (se necessário)
rm ~/.git-credentials
```

