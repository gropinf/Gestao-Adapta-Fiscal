/**
 * Script para executar migrations SQL manualmente
 * Uso: npx tsx server/run-migration.ts <nome-do-arquivo>
 * Exemplo: npx tsx server/run-migration.ts 010_make_email_monitor_global.sql
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './db';

async function runMigration(filename: string) {
  try {
    console.log(`\n📄 Executando migration: ${filename}\n`);
    
    // Ler arquivo SQL
    const migrationPath = join(process.cwd(), 'server', 'migrations', filename);
    const sqlContent = readFileSync(migrationPath, 'utf-8');
    
    console.log('📝 SQL a executar:');
    console.log('─'.repeat(60));
    console.log(sqlContent);
    console.log('─'.repeat(60));
    console.log('\n⏳ Executando...\n');
    
    // Executar SQL completo
    const result = await pool.query(sqlContent);
    
    console.log('✅ Migration executada com sucesso!');
    console.log(`📊 Resultado:`, result);
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error);
    if (error instanceof Error) {
      console.error('Mensagem:', error.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Obter nome do arquivo dos argumentos
const filename = process.argv[2];

if (!filename) {
  console.error('❌ Erro: Nome do arquivo de migration é obrigatório');
  console.log('\n📖 Uso:');
  console.log('   npx tsx server/run-migration.ts <nome-do-arquivo>');
  console.log('\n📝 Exemplo:');
  console.log('   npx tsx server/run-migration.ts 010_make_email_monitor_global.sql');
  process.exit(1);
}

runMigration(filename);

