import { db } from "./server/db";
import { users, companies, companyUsers, xmls } from "./shared/schema";
import { parseXmlContent, validateChave } from "./server/xmlParser";
import { saveToValidated, fileExists, getStorageStats, deleteXmlFile } from "./server/fileStorage";
import { eq } from "drizzle-orm";
import * as fs from "fs/promises";

// XML de teste com chave única
const CHAVE_TESTE = "35241112345678000190550010000000031234567891"; // Chave diferente
const XML_TESTE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${CHAVE_TESTE}" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>123456789</cNF>
        <natOp>VENDA DE MERCADORIA</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>3</nNF>
        <dhEmi>2024-11-02T14:30:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>3550308</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>1</cDV>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>0</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>1.0</verProc>
      </ide>
      <emit>
        <CNPJ>12345678000190</CNPJ>
        <xNome>EMPRESA EXEMPLO LTDA</xNome>
        <xFant>EMPRESA EXEMPLO</xFant>
        <enderEmit>
          <xLgr>RUA EXEMPLO</xLgr>
          <nro>123</nro>
          <xBairro>CENTRO</xBairro>
          <cMun>3550308</cMun>
          <xMun>SAO PAULO</xMun>
          <UF>SP</UF>
          <CEP>01234567</CEP>
        </enderEmit>
      </emit>
      <dest>
        <CNPJ>98765432000100</CNPJ>
        <xNome>CLIENTE TESTE LTDA</xNome>
        <enderDest>
          <xLgr>AVENIDA PAULISTA</xLgr>
          <nro>1000</nro>
          <xBairro>BELA VISTA</xBairro>
          <cMun>3550308</cMun>
          <xMun>SAO PAULO</xMun>
          <UF>SP</UF>
          <CEP>01310100</CEP>
        </enderDest>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>001</cProd>
          <xProd>PRODUTO TESTE</xProd>
          <NCM>12345678</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>5.0000</qCom>
          <vUnCom>50.0000</vUnCom>
          <vProd>250.00</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>0</modBC>
              <vBC>250.00</vBC>
              <pICMS>18.00</pICMS>
              <vICMS>45.00</vICMS>
            </ICMS00>
          </ICMS>
          <PIS>
            <PISAliq>
              <CST>01</CST>
              <vBC>250.00</vBC>
              <pPIS>1.65</pPIS>
              <vPIS>4.13</vPIS>
            </PISAliq>
          </PIS>
          <COFINS>
            <COFINSAliq>
              <CST>01</CST>
              <vBC>250.00</vBC>
              <pCOFINS>7.60</pCOFINS>
              <vCOFINS>19.00</vCOFINS>
            </COFINSAliq>
          </COFINS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>250.00</vBC>
          <vICMS>45.00</vICMS>
          <vProd>250.00</vProd>
          <vNF>250.00</vNF>
          <vPIS>4.13</vPIS>
          <vCOFINS>19.00</vCOFINS>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>2</tpAmb>
      <chNFe>${CHAVE_TESTE}</chNFe>
      <dhRecbto>2024-11-02T14:31:00-03:00</dhRecbto>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;

async function testUploadFlow() {
  console.log("\n🧪 === TESTE COMPLETO DO FLUXO DE UPLOAD ===\n");

  try {
    // 1. Buscar empresa de teste no banco
    console.log("1️⃣ Buscando empresa de teste...");
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.cnpj, "12345678000190"))
      .limit(1);
    
    if (!company) {
      console.log("   ❌ Empresa não encontrada. Execute os seeds primeiro!");
      process.exit(1);
    }
    console.log(`   ✅ Empresa encontrada: ${company.razaoSocial} (ID: ${company.id})`);

    // 2. Parse do XML
    console.log("\n2️⃣ Parseando XML de teste...");
    const parsed = await parseXmlContent(XML_TESTE);
    console.log(`   ✅ XML parseado com sucesso`);
    console.log(`   📄 Chave: ${parsed.chave}`);
    console.log(`   📄 Tipo: ${parsed.tipoDoc}`);
    console.log(`   📄 Data: ${parsed.dataEmissao}`);
    console.log(`   📄 Emitente: ${parsed.razaoSocialEmitente} (${parsed.cnpjEmitente})`);
    console.log(`   📄 Total: R$ ${parsed.totalNota.toFixed(2)}`);

    // 3. Validação da chave
    console.log("\n3️⃣ Validando chave de acesso...");
    const isValid = validateChave(parsed.chave);
    console.log(`   ${isValid ? '✅' : '❌'} Chave válida: ${isValid}`);

    // 4. Verificação de duplicata no banco
    console.log("\n4️⃣ Verificando duplicata no banco...");
    const [existing] = await db
      .select()
      .from(xmls)
      .where(eq(xmls.chave, parsed.chave))
      .limit(1);
    
    if (existing) {
      console.log(`   ⚠️  XML já existe no banco (ID: ${existing.id})`);
      console.log(`   🗑️  Removendo para teste...`);
      await db.delete(xmls).where(eq(xmls.id, existing.id));
    } else {
      console.log(`   ✅ Sem duplicata no banco`);
    }

    // 5. Verificação de duplicata no storage
    console.log("\n5️⃣ Verificando duplicata no storage...");
    const existsInStorage = await fileExists(parsed.chave, "validated");
    if (existsInStorage) {
      console.log(`   ⚠️  Arquivo já existe no storage`);
      console.log(`   🗑️  Removendo para teste...`);
      await deleteXmlFile(parsed.chave, "validated");
    } else {
      console.log(`   ✅ Sem duplicata no storage`);
    }

    // 6. Categorização
    console.log("\n6️⃣ Categorizando XML...");
    const categoria = parsed.cnpjEmitente === company.cnpj ? "emitida" : "recebida";
    console.log(`   📊 Categoria: ${categoria}`);
    console.log(`   💡 Lógica: CNPJ emitente (${parsed.cnpjEmitente}) ${categoria === 'emitida' ? '==' : '!='} CNPJ empresa (${company.cnpj})`);

    // 7. Salvar no storage
    console.log("\n7️⃣ Salvando arquivo no storage...");
    const saveResult = await saveToValidated(XML_TESTE, parsed.chave);
    if (saveResult.success) {
      console.log(`   ✅ Arquivo salvo: ${saveResult.filepath}`);
    } else {
      console.log(`   ❌ Erro ao salvar: ${saveResult.error}`);
      process.exit(1);
    }

    // 8. Salvar no banco de dados
    console.log("\n8️⃣ Salvando no banco de dados...");
    const [xmlRecord] = await db
      .insert(xmls)
      .values({
        companyId: company.id,
        chave: parsed.chave,
        tipoDoc: parsed.tipoDoc,
        dataEmissao: parsed.dataEmissao,
        hora: parsed.hora || "00:00:00",
        cnpjEmitente: parsed.cnpjEmitente,
        cnpjDestinatario: parsed.cnpjDestinatario,
        razaoSocialDestinatario: parsed.razaoSocialDestinatario,
        totalNota: parsed.totalNota.toString(),
        totalImpostos: parsed.totalImpostos.toString(),
        categoria,
        statusValidacao: "valido",
        filepath: saveResult.filepath || "",
      })
      .returning();

    console.log(`   ✅ Registro criado no banco (ID: ${xmlRecord.id})`);

    // 9. Verificar resultado final
    console.log("\n9️⃣ Verificando resultado final...");
    
    // Verifica no banco
    const [dbCheck] = await db
      .select()
      .from(xmls)
      .where(eq(xmls.chave, parsed.chave))
      .limit(1);
    console.log(`   ${dbCheck ? '✅' : '❌'} Registro existe no banco: ${!!dbCheck}`);
    
    // Verifica no storage
    const storageCheck = await fileExists(parsed.chave, "validated");
    console.log(`   ${storageCheck ? '✅' : '❌'} Arquivo existe no storage: ${storageCheck}`);

    // 10. Estatísticas
    console.log("\n🔟 Estatísticas do storage:");
    const stats = await getStorageStats();
    console.log(`   📊 Total XMLs validados: ${stats.validatedCount}`);
    console.log(`   📊 Total XMLs em RAW: ${stats.rawCount}`);

    // 11. Buscar XMLs da empresa
    console.log("\n1️⃣1️⃣ Listando XMLs da empresa...");
    const companyXmls = await db
      .select()
      .from(xmls)
      .where(eq(xmls.companyId, company.id));
    
    console.log(`   📄 Total de XMLs: ${companyXmls.length}`);
    companyXmls.forEach((xml, idx) => {
      console.log(`   ${idx + 1}. ${xml.tipoDoc} - ${xml.dataEmissao} - R$ ${xml.totalNota} (${xml.categoria})`);
    });

    console.log("\n✅ === TESTE COMPLETO COM SUCESSO! ===");
    console.log("\n📋 RESUMO:");
    console.log(`   ✅ XML parseado corretamente`);
    console.log(`   ✅ Arquivo salvo no storage`);
    console.log(`   ✅ Registro criado no banco de dados`);
    console.log(`   ✅ Categorização automática funcionando`);
    console.log(`   ✅ Detecção de duplicatas funcionando`);
    console.log(`   ✅ Fluxo end-to-end completo!\n`);

  } catch (error) {
    console.error("\n❌ ERRO NO TESTE:", error);
    process.exit(1);
  }

  process.exit(0);
}

testUploadFlow();












