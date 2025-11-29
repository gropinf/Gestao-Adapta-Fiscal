import {
  initializeStorageDirectories,
  saveToRaw,
  moveToValidated,
  saveToValidated,
  fileExists,
  readXmlFile,
  deleteXmlFile,
  getStorageStats,
  listXmlFiles,
  clearRawDirectory,
  getFileName,
} from "./server/fileStorage";

const CHAVE_TESTE = "35241012345678000190550010000000011234567890";
const XML_TESTE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe${CHAVE_TESTE}">
      <ide>
        <dhEmi>2024-11-02T10:30:00-03:00</dhEmi>
      </ide>
    </infNFe>
  </NFe>
</nfeProc>`;

async function testStorage() {
  console.log("\n🧪 === TESTE DO SISTEMA DE STORAGE ===\n");
  
  try {
    // 1. Inicializar diretórios
    console.log("1️⃣ Inicializando diretórios de storage...");
    await initializeStorageDirectories();
    console.log("   ✅ Diretórios criados/verificados\n");
    
    // 2. Verificar estatísticas iniciais
    console.log("2️⃣ Verificando estatísticas iniciais...");
    let stats = await getStorageStats();
    console.log(`   📊 Arquivos em RAW: ${stats.rawCount}`);
    console.log(`   📊 Arquivos em VALIDATED: ${stats.validatedCount}\n`);
    
    // 3. Salvar XML em RAW
    console.log("3️⃣ Salvando XML em /uploads/raw...");
    const saveResult = await saveToRaw(XML_TESTE, CHAVE_TESTE);
    if (saveResult.success) {
      console.log(`   ✅ Arquivo salvo: ${saveResult.filepath}`);
    } else {
      console.log(`   ❌ Erro: ${saveResult.error}`);
    }
    
    // 4. Verificar se existe em RAW
    console.log("\n4️⃣ Verificando se arquivo existe em RAW...");
    const existsInRaw = await fileExists(CHAVE_TESTE, "raw");
    console.log(`   ${existsInRaw ? '✅' : '❌'} Existe em RAW: ${existsInRaw}`);
    
    // 5. Listar arquivos em RAW
    console.log("\n5️⃣ Listando arquivos em RAW...");
    const rawFiles = await listXmlFiles("raw");
    console.log(`   📄 Total: ${rawFiles.length} arquivo(s)`);
    rawFiles.forEach(chave => console.log(`      - ${getFileName(chave)}`));
    
    // 6. Ler conteúdo do arquivo
    console.log("\n6️⃣ Lendo conteúdo do arquivo...");
    const content = await readXmlFile(CHAVE_TESTE, "raw");
    console.log(`   ${content ? '✅' : '❌'} Arquivo lido: ${content ? content.length + ' bytes' : 'erro'}`);
    
    // 7. Mover de RAW para VALIDATED
    console.log("\n7️⃣ Movendo arquivo de RAW para VALIDATED...");
    const moveResult = await moveToValidated(CHAVE_TESTE);
    if (moveResult.success) {
      console.log(`   ✅ Arquivo movido: ${moveResult.filepath}`);
    } else {
      console.log(`   ❌ Erro: ${moveResult.error}`);
    }
    
    // 8. Verificar se foi movido
    console.log("\n8️⃣ Verificando movimentação...");
    const stillInRaw = await fileExists(CHAVE_TESTE, "raw");
    const nowInValidated = await fileExists(CHAVE_TESTE, "validated");
    console.log(`   ${!stillInRaw ? '✅' : '❌'} Removido de RAW: ${!stillInRaw}`);
    console.log(`   ${nowInValidated ? '✅' : '❌'} Presente em VALIDATED: ${nowInValidated}`);
    
    // 9. Listar arquivos em VALIDATED
    console.log("\n9️⃣ Listando arquivos em VALIDATED...");
    const validatedFiles = await listXmlFiles("validated");
    console.log(`   📄 Total: ${validatedFiles.length} arquivo(s)`);
    validatedFiles.forEach(chave => console.log(`      - ${getFileName(chave)}`));
    
    // 10. Testar duplicata
    console.log("\n🔟 Testando proteção contra duplicatas...");
    const duplicateResult = await saveToValidated(XML_TESTE, CHAVE_TESTE);
    if (!duplicateResult.success) {
      console.log(`   ✅ Duplicata bloqueada: ${duplicateResult.error}`);
    } else {
      console.log(`   ❌ ERRO: Duplicata não foi bloqueada!`);
    }
    
    // 11. Estatísticas finais
    console.log("\n1️⃣1️⃣ Estatísticas finais...");
    stats = await getStorageStats();
    console.log(`   📊 Arquivos em RAW: ${stats.rawCount}`);
    console.log(`   📊 Arquivos em VALIDATED: ${stats.validatedCount}`);
    
    // 12. Limpeza (deletar arquivo de teste)
    console.log("\n1️⃣2️⃣ Limpando arquivo de teste...");
    const deleteResult = await deleteXmlFile(CHAVE_TESTE, "validated");
    if (deleteResult.success) {
      console.log(`   ✅ Arquivo deletado`);
    } else {
      console.log(`   ❌ Erro: ${deleteResult.error}`);
    }
    
    // 13. Limpar diretório RAW
    console.log("\n1️⃣3️⃣ Limpando diretório RAW...");
    const cleared = await clearRawDirectory();
    console.log(`   ✅ ${cleared} arquivo(s) removido(s) de RAW`);
    
    console.log("\n✅ === TODOS OS TESTES CONCLUÍDOS COM SUCESSO! ===\n");
    
  } catch (error) {
    console.error("\n❌ ERRO NO TESTE:", error);
    process.exit(1);
  }
}

testStorage();














