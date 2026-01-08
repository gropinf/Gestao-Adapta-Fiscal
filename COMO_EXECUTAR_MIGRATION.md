# Como Executar a Migration no Replit

## 🎯 Opção 1: Usando o Script Automático (Recomendado)

Execute no terminal do Replit:

```bash
npx tsx server/run-migration.ts 010_make_email_monitor_global.sql
```

Este script:
- ✅ Lê o arquivo SQL automaticamente
- ✅ Executa no banco de dados conectado
- ✅ Mostra o resultado da execução

---

## 🎯 Opção 2: Executar SQL Diretamente via Drizzle

Se você tem acesso ao console do banco ou quer executar manualmente:

### Passo 1: Conectar ao banco
No terminal do Replit, você pode usar o `psql` se disponível, ou criar um script temporário:

```bash
# Criar arquivo temporário
cat > temp-migration.js << 'EOF'
import { pool } from './server/db.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(join(process.cwd(), 'server', 'migrations', '010_make_email_monitor_global.sql'), 'utf-8');

pool.query(sql)
  .then(() => {
    console.log('✅ Migration executada!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
EOF

# Executar
node temp-migration.js
```

---

## 🎯 Opção 3: Executar SQL Manualmente (via psql ou cliente)

Se você tem acesso direto ao PostgreSQL:

```bash
# Conectar ao banco (ajuste a URL conforme necessário)
psql $DATABASE_URL

# Ou se usar variável de ambiente
psql "$DATABASE_URL"
```

Depois cole o conteúdo do arquivo `server/migrations/010_make_email_monitor_global.sql`:

```sql
-- Tornar company_id nullable e mudar ON DELETE para SET NULL
ALTER TABLE email_monitors 
  ALTER COLUMN company_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS email_monitors_company_id_fkey;

-- Recriar constraint com ON DELETE SET NULL
ALTER TABLE email_monitors 
  ADD CONSTRAINT email_monitors_company_id_fkey 
  FOREIGN KEY (company_id) 
  REFERENCES companies(id) 
  ON DELETE SET NULL;

-- Comentário atualizado
COMMENT ON COLUMN email_monitors.company_id IS 'ID da empresa (opcional) - Monitor é funcionalidade global que processa XMLs de todas as empresas';
```

---

## 🎯 Opção 4: Via Código TypeScript (Temporário)

Crie um arquivo temporário `migrate.ts` na raiz:

```typescript
import { pool } from './server/db.js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function run() {
  try {
    const sql = readFileSync(
      join(process.cwd(), 'server', 'migrations', '010_make_email_monitor_global.sql'),
      'utf-8'
    );
    
    console.log('Executando migration...');
    await pool.query(sql);
    console.log('✅ Migration executada com sucesso!');
    await pool.end();
  } catch (error) {
    console.error('❌ Erro:', error);
    await pool.end();
    process.exit(1);
  }
}

run();
```

Execute:
```bash
npx tsx migrate.ts
```

Depois delete o arquivo:
```bash
rm migrate.ts
```

---

## ✅ Verificar se Funcionou

Após executar a migration, verifique se o campo foi alterado:

```sql
-- Verificar estrutura da tabela
\d email_monitors

-- Ou via query
SELECT 
  column_name, 
  is_nullable, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'email_monitors' 
  AND column_name = 'company_id';
```

O resultado deve mostrar `is_nullable = 'YES'`.

---

## 🆘 Problemas Comuns

### Erro: "relation does not exist"
- Verifique se a tabela `email_monitors` existe
- Execute `\dt` no psql para listar tabelas

### Erro: "constraint does not exist"
- Isso é normal se a constraint já foi removida
- O `DROP CONSTRAINT IF EXISTS` deve evitar esse erro

### Erro de conexão
- Verifique se `DATABASE_URL` está configurada corretamente
- No Replit, verifique as Secrets/Environment Variables

---

## 📝 Nota Importante

⚠️ **Backup**: Antes de executar migrations em produção, sempre faça backup do banco de dados!

A migration é segura e não remove dados, apenas torna o campo `company_id` opcional.



