/**
 * Script para migrar XMLs do sistema de arquivos local para o Contabo Storage
 * 
 * Uso:
 *   npx tsx server/migrate-xmls-to-contabo.ts                    # Migra todos os XMLs locais
 *   npx tsx server/migrate-xmls-to-contabo.ts --include-urls     # Migra XMLs locais E de produção (URLs)
 *   npx tsx server/migrate-xmls-to-contabo.ts --dry-run           # Simula migração (não faz alterações)
 *   npx tsx server/migrate-xmls-to-contabo.ts --limit 100       # Migra apenas os primeiros 100
 *   npx tsx server/migrate-xmls-to-contabo.ts --batch-size 10     # Processa em lotes de 10
 * 
 * IMPORTANTE: Certifique-se de que as variáveis de ambiente do Contabo estão configuradas!
 */

/**
 * Script para migrar XMLs do sistema de arquivos local para o Contabo Storage
 * 
 * NOTA: As variáveis de ambiente devem estar configuradas no sistema (Replit Secrets ou .env)
 */

import {
  getXmlsToMigrate,
  countXmlsToMigrate,
  migrateXmlsBatch,
  type BatchMigrationResult,
} from './xmlMigrationService';

async function main() {
  console.log('\n🚀 Iniciando migração de XMLs para Contabo Storage...\n');

  // Verificar variáveis de ambiente do Contabo (se não for dry-run)
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  if (!dryRun) {
    const requiredVars = [
      'CONTABO_STORAGE_ENDPOINT',
      'CONTABO_STORAGE_BUCKET',
      'CONTABO_STORAGE_ACCESS_KEY',
      'CONTABO_STORAGE_SECRET_KEY',
    ];
    
    const missingVars = requiredVars.filter(v => !process.env[v]);
    
    if (missingVars.length > 0) {
      console.error('❌ ERRO: Variáveis de ambiente do Contabo não configuradas!\n');
      console.error('Variáveis faltando:');
      missingVars.forEach(v => console.error(`   - ${v}`));
      console.error('\n💡 Como configurar:');
      console.error('   1. No Replit: Use Secrets (ícone 🔒 na barra lateral)');
      console.error('   2. Ou crie arquivo .env na raiz do projeto');
      console.error('   3. Veja COMO_CONFIGURAR_VARIAVEIS_CONTABO.md para mais detalhes\n');
      console.error('📝 Variáveis necessárias:');
      console.error('   - CONTABO_STORAGE_ENDPOINT (ex: https://usc1.contabostorage.com)');
      console.error('   - CONTABO_STORAGE_REGION (ex: usc1)');
      console.error('   - CONTABO_STORAGE_BUCKET (ex: caixafacil)');
      console.error('   - CONTABO_STORAGE_ACCESS_KEY');
      console.error('   - CONTABO_STORAGE_SECRET_KEY\n');
      process.exit(1);
    }
    
    console.log('✅ Variáveis de ambiente do Contabo configuradas\n');
  }

  // Parse argumentos
  const includeUrls = args.includes('--include-urls');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
  const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 50;

  if (dryRun) {
    console.log('⚠️  MODO DRY-RUN: Nenhuma alteração será feita\n');
  }

  if (includeUrls) {
    console.log('🌐 Modo PRODUÇÃO: Incluindo XMLs de URLs (produção)\n');
  }

  try {
    // 1. Contar XMLs para migração
    console.log('📊 Verificando XMLs para migração...');
    const totalToMigrate = await countXmlsToMigrate(includeUrls);
    
    if (totalToMigrate === 0) {
      console.log('✅ Nenhum XML precisa ser migrado. Todos já estão no Contabo Storage!\n');
      process.exit(0);
    }

    console.log(`📦 Total de XMLs para migrar: ${totalToMigrate}\n`);

    // 2. Buscar XMLs
    let xmlsToMigrate = await getXmlsToMigrate(includeUrls);
    
    if (limit && limit > 0) {
      xmlsToMigrate = xmlsToMigrate.slice(0, limit);
      console.log(`🔢 Limitando migração aos primeiros ${limit} XMLs\n`);
    }

    if (xmlsToMigrate.length === 0) {
      console.log('✅ Nenhum XML encontrado para migração\n');
      process.exit(0);
    }

    // 3. Confirmar antes de executar (se não for dry-run)
    if (!dryRun) {
      console.log('⚠️  ATENÇÃO: Esta operação irá:');
      console.log('   1. Fazer upload dos XMLs para o Contabo Storage');
      if (includeUrls) {
        console.log('   2. Baixar XMLs de URLs (produção) antes de fazer upload');
      }
      console.log(`   ${includeUrls ? '3' : '2'}. Atualizar os filepaths no banco de dados`);
      if (!includeUrls) {
        console.log('   3. DELETAR os arquivos locais após migração bem-sucedida');
      } else {
        console.log('   4. Arquivos de produção (URLs) não serão deletados (apenas migrados)');
      }
      console.log('');
      
      // Em ambiente não-interativo, prossegue automaticamente
      // Em ambiente interativo, você pode adicionar uma confirmação aqui
    }

    // 4. Processar em batches
    const batches: typeof xmlsToMigrate[] = [];
    for (let i = 0; i < xmlsToMigrate.length; i += batchSize) {
      batches.push(xmlsToMigrate.slice(i, i + batchSize));
    }

    console.log(`📦 Processando em ${batches.length} lote(s) de até ${batchSize} XMLs cada\n`);

    let totalSuccess = 0;
    let totalFailed = 0;
    const allResults: any[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n📦 Lote ${batchIndex + 1}/${batches.length} (${batch.length} XMLs)`);
      console.log('─'.repeat(60));

      const result = await migrateXmlsBatch(batch, {
        dryRun,
        onProgress: (current, total, migrationResult) => {
          const status = migrationResult.success ? '✅' : '❌';
          const progress = `[${current}/${total}]`;
          console.log(`${status} ${progress} ${migrationResult.chave} - ${migrationResult.success ? 'OK' : migrationResult.error}`);
        },
      });

      totalSuccess += result.success;
      totalFailed += result.failed;
      allResults.push(...result.results);

      console.log(`\n📊 Lote ${batchIndex + 1} concluído: ${result.success} sucesso, ${result.failed} falhas`);
    }

    // 5. Resumo final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DA MIGRAÇÃO');
    console.log('='.repeat(60));
    console.log(`Total processado: ${allResults.length}`);
    console.log(`✅ Sucesso: ${totalSuccess}`);
    console.log(`❌ Falhas: ${totalFailed}`);
    console.log(`📈 Taxa de sucesso: ${((totalSuccess / allResults.length) * 100).toFixed(2)}%`);

    // 6. Listar falhas (se houver)
    const failures = allResults.filter(r => !r.success);
    if (failures.length > 0) {
      console.log('\n❌ XMLs com falha na migração:');
      failures.forEach((failure, index) => {
        console.log(`\n${index + 1}. Chave: ${failure.chave}`);
        console.log(`   Erro: ${failure.error}`);
        console.log(`   Filepath antigo: ${failure.oldFilepath}`);
      });
    }

    // 7. Verificar se ainda há XMLs para migrar
    const remaining = await countXmlsToMigrate();
    if (remaining > 0 && !limit) {
      console.log(`\n⚠️  Ainda há ${remaining} XML(s) para migrar. Execute o script novamente.`);
    } else if (remaining === 0) {
      console.log('\n✅ Todos os XMLs foram migrados com sucesso!');
    }

    console.log('\n');

    process.exit(totalFailed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Erro fatal na migração:', error);
    if (error instanceof Error) {
      console.error('Mensagem:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Importar tipo Xml
import type { Xml } from '@shared/schema';

main();
