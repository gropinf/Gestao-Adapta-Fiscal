import { parseXmlContent, validateChave, extractUfFromChave, isValidNFeXml } from "./server/xmlParser";
import * as fs from "fs/promises";

async function testParser() {
  console.log('\n🧪 === TESTE DO PARSER XML NFe === \n');
  
  try {
    // Lê o XML de exemplo
    const xmlContent = await fs.readFile('./test-xml-sample.xml', 'utf-8');
    
    // Testa validação de XML
    console.log('1️⃣ Validando se é XML NFe válido...');
    const isValid = isValidNFeXml(xmlContent);
    console.log(`   ✅ É XML NFe válido: ${isValid}\n`);
    
    if (!isValid) {
      console.log('   ❌ XML inválido! Abortando testes.');
      process.exit(1);
    }
    
    // Parse do XML
    console.log('2️⃣ Parseando XML...');
    const parsed = await parseXmlContent(xmlContent);
    
    console.log('\n📋 === DADOS EXTRAÍDOS ===\n');
    
    // Chave
    console.log('🔑 CHAVE DE ACESSO:');
    console.log(`   Chave: ${parsed.chave}`);
    console.log(`   Válida: ${validateChave(parsed.chave)}`);
    console.log(`   UF: ${extractUfFromChave(parsed.chave)}`);
    
    // Identificação
    console.log('\n📌 IDENTIFICAÇÃO:');
    console.log(`   Tipo: ${parsed.tipoDoc}`);
    console.log(`   Data Emissão: ${parsed.dataEmissao}`);
    console.log(`   Hora: ${parsed.hora}`);
    
    // Emitente
    console.log('\n🏭 EMITENTE:');
    console.log(`   CNPJ: ${parsed.cnpjEmitente}`);
    console.log(`   Razão Social: ${parsed.razaoSocialEmitente}`);
    console.log(`   Endereço: ${parsed.enderecoEmitente.rua}, ${parsed.enderecoEmitente.numero}`);
    console.log(`   Bairro: ${parsed.enderecoEmitente.bairro}`);
    console.log(`   Cidade: ${parsed.enderecoEmitente.cidade}/${parsed.enderecoEmitente.uf}`);
    console.log(`   CEP: ${parsed.enderecoEmitente.cep}`);
    
    // Destinatário
    console.log('\n🏢 DESTINATÁRIO:');
    console.log(`   CNPJ: ${parsed.cnpjDestinatario}`);
    console.log(`   Razão Social: ${parsed.razaoSocialDestinatario}`);
    if (parsed.enderecoDestinatario) {
      console.log(`   Endereço: ${parsed.enderecoDestinatario.rua}, ${parsed.enderecoDestinatario.numero}`);
      console.log(`   Cidade: ${parsed.enderecoDestinatario.cidade}/${parsed.enderecoDestinatario.uf}`);
    }
    
    // Produtos
    console.log('\n📦 PRODUTOS:');
    console.log(`   Total de itens: ${parsed.produtos.length}`);
    parsed.produtos.forEach((prod, idx) => {
      console.log(`\n   Item ${idx + 1}:`);
      console.log(`     Código: ${prod.codigo}`);
      console.log(`     Descrição: ${prod.descricao}`);
      console.log(`     NCM: ${prod.ncm}`);
      console.log(`     CFOP: ${prod.cfop}`);
      console.log(`     Quantidade: ${prod.quantidade} ${prod.unidade}`);
      console.log(`     Valor Unitário: R$ ${prod.valorUnitario.toFixed(2)}`);
      console.log(`     Valor Total: R$ ${prod.valorTotal.toFixed(2)}`);
    });
    
    // Impostos
    console.log('\n💰 IMPOSTOS:');
    console.log(`   ICMS: R$ ${parsed.impostos.icms.toFixed(2)}`);
    console.log(`   IPI: R$ ${parsed.impostos.ipi.toFixed(2)}`);
    console.log(`   PIS: R$ ${parsed.impostos.pis.toFixed(2)}`);
    console.log(`   COFINS: R$ ${parsed.impostos.cofins.toFixed(2)}`);
    console.log(`   Total Impostos: R$ ${parsed.impostos.total.toFixed(2)}`);
    
    // Totais
    console.log('\n🧮 TOTAIS:');
    console.log(`   Total da Nota: R$ ${parsed.totalNota.toFixed(2)}`);
    console.log(`   Total Impostos: R$ ${parsed.totalImpostos.toFixed(2)}`);
    
    console.log('\n✅ === TESTE CONCLUÍDO COM SUCESSO! ===\n');
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error);
    process.exit(1);
  }
}

testParser();












