/**
 * Script para testar conexão com Contabo Storage
 * Uso: npx tsx server/test-contabo-connection.ts
 */

/**
 * Script para testar conexão com Contabo Storage
 * 
 * NOTA: As variáveis de ambiente devem estar configuradas no sistema (Replit Secrets ou .env)
 */

import { testStorageConnection } from './contaboStorage';

async function main() {
  console.log('\n🔍 Testando conexão com Contabo Storage...\n');

  try {
    const result = await testStorageConnection();

    if (result.success) {
      console.log('✅ Conexão com Contabo Storage OK!');
      console.log('\n📋 Detalhes:');
      console.log(`   Bucket: ${result.details?.bucket}`);
      console.log(`   Endpoint: ${result.details?.endpoint}`);
      console.log(`   Region: ${result.details?.region}`);
      console.log('\n✅ Pronto para fazer uploads!\n');
      process.exit(0);
    } else {
      console.error('❌ Erro na conexão:', result.error);
      console.log('\n💡 Verifique:');
      console.log('   1. Variáveis de ambiente configuradas (.env ou .env.local)');
      console.log('   2. CONTABO_STORAGE_ENDPOINT');
      console.log('   3. CONTABO_STORAGE_REGION');
      console.log('   4. CONTABO_STORAGE_BUCKET');
      console.log('   5. CONTABO_STORAGE_ACCESS_KEY');
      console.log('   6. CONTABO_STORAGE_SECRET_KEY\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erro ao testar conexão:', error);
    if (error instanceof Error) {
      console.error('Mensagem:', error.message);
    }
    process.exit(1);
  }
}

main();
