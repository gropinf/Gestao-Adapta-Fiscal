import { db } from "./db";
import { users, companies, companyUsers, accountants, accountantCompanies, xmls, alerts } from "@shared/schema";
import { hashPassword } from "./auth";
import { saveToValidated } from "./fileStorage";
import { saveXmlToContabo } from "./xmlStorageService";
import { eq } from "drizzle-orm";

/**
 * Seeds para popular o banco de dados com dados de teste
 */

export async function runSeeds() {
  console.log("\n🌱 Iniciando seeds...\n");

  try {
    // 1. Criar usuários
    console.log("1️⃣ Criando usuários...");
    
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@adaptafiscal.com.br"))
      .limit(1);

    let admin = adminUser;
    
    if (!admin) {
      const [newAdmin] = await db
        .insert(users)
        .values({
          email: "admin@adaptafiscal.com.br",
          passwordHash: await hashPassword("password123"),
          name: "Administrador",
          role: "admin",
          active: true, // Admin sempre ativo
        })
        .returning();
      admin = newAdmin;
      console.log("   ✅ Usuário admin criado");
    } else {
      console.log("   ℹ️  Usuário admin já existe");
      // Garantir que admin esteja ativo
      await db.update(users)
        .set({ active: true, role: "admin" })
        .where(eq(users.id, admin.id));
    }

    // Criar usuário cliente
    const [editorCheck] = await db
      .select()
      .from(users)
      .where(eq(users.email, "cliente@adaptafiscal.com.br"))
      .limit(1);

    let editor = editorCheck;

    if (!editor) {
      const [newEditor] = await db.insert(users).values({
        email: "cliente@adaptafiscal.com.br",
        passwordHash: await hashPassword("password123"),
        name: "Cliente Teste",
        role: "cliente",
        active: true, // Cliente ativo
      }).returning();
      editor = newEditor;
      console.log("   ✅ Usuário cliente criado");
    } else {
      console.log("   ℹ️  Usuário cliente já existe");
      // Garantir que cliente esteja ativo
      await db.update(users)
        .set({ active: true, role: "cliente" })
        .where(eq(users.id, editor.id));
    }

    // 2. Criar empresas
    console.log("\n2️⃣ Criando empresas...");
    
    const empresasData = [
      {
        cnpj: "12345678000190",
        razaoSocial: "Empresa Exemplo LTDA",
        nomeFantasia: "Exemplo Corp",
        inscricaoEstadual: "123456789012",
        rua: "Rua das Flores",
        numero: "100",
        bairro: "Centro",
        cidade: "São Paulo",
        uf: "SP",
        cep: "01310100",
      },
      {
        cnpj: "98765432000100",
        razaoSocial: "Tech Solutions SA",
        nomeFantasia: "Tech Solutions",
        inscricaoEstadual: "987654321098",
        rua: "Avenida Paulista",
        numero: "1500",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        uf: "SP",
        cep: "01310100",
      },
      {
        cnpj: "11222333000144",
        razaoSocial: "Comércio ABC Ltda",
        nomeFantasia: "ABC Store",
        inscricaoEstadual: "112223334445",
        rua: "Rua Comercial",
        numero: "250",
        bairro: "Vila Mariana",
        cidade: "São Paulo",
        uf: "SP",
        cep: "04101000",
      },
    ];

    const createdCompanies = [];

    for (const empresaData of empresasData) {
      const [existing] = await db
        .select()
        .from(companies)
        .where(eq(companies.cnpj, empresaData.cnpj))
        .limit(1);

      if (!existing) {
        const [company] = await db.insert(companies).values(empresaData).returning();
        createdCompanies.push(company);
        console.log(`   ✅ Empresa criada: ${company.razaoSocial}`);
      } else {
        createdCompanies.push(existing);
        console.log(`   ℹ️  Empresa já existe: ${existing.razaoSocial}`);
      }
    }

    // 3. Associar usuário às empresas
    console.log("\n3️⃣ Associando usuário às empresas...");
    
    for (const company of createdCompanies) {
      const [existing] = await db
        .select()
        .from(companyUsers)
        .where(eq(companyUsers.companyId, company.id))
        .limit(1);

      if (!existing) {
        await db.insert(companyUsers).values({
          userId: admin.id,
          companyId: company.id,
        });
        console.log(`   ✅ Usuário associado à ${company.razaoSocial}`);
      }
    }

    // 4. Criar contadores
    console.log("\n4️⃣ Criando contabilidades...");
    
    const contadoresData = [
      {
        nome: "Contabilidade Silva & Associados",
        emailContador: "contato@silvacontabil.com.br",
      },
      {
        nome: "Escritório Fiscal Premium",
        emailContador: "fiscal@premium.com.br",
      },
    ];

    const createdAccountants = [];

    for (const contadorData of contadoresData) {
      const [existing] = await db
        .select()
        .from(accountants)
        .where(eq(accountants.emailContador, contadorData.emailContador))
        .limit(1);

      if (!existing) {
        const [accountant] = await db.insert(accountants).values(contadorData).returning();
        createdAccountants.push(accountant);
        console.log(`   ✅ Contador criado: ${accountant.nome}`);
      } else {
        createdAccountants.push(existing);
        console.log(`   ℹ️  Contador já existe: ${existing.nome}`);
      }
    }

    // 5. Associar empresas aos contadores
    console.log("\n5️⃣ Associando empresas aos contadores...");
    
    if (createdAccountants[0] && createdCompanies[0]) {
      const [existing1] = await db
        .select()
        .from(accountantCompanies)
        .where(eq(accountantCompanies.accountantId, createdAccountants[0].id))
        .limit(1);

      if (!existing1) {
        await db.insert(accountantCompanies).values({
          accountantId: createdAccountants[0].id,
          companyId: createdCompanies[0].id,
        });
        await db.insert(accountantCompanies).values({
          accountantId: createdAccountants[0].id,
          companyId: createdCompanies[2].id,
        });
        console.log(`   ✅ ${createdAccountants[0].nome} → 2 empresas`);
      }
    }

    if (createdAccountants[1] && createdCompanies[1]) {
      const [existing2] = await db
        .select()
        .from(accountantCompanies)
        .where(eq(accountantCompanies.accountantId, createdAccountants[1].id))
        .limit(1);

      if (!existing2) {
        await db.insert(accountantCompanies).values({
          accountantId: createdAccountants[1].id,
          companyId: createdCompanies[1].id,
        });
        console.log(`   ✅ ${createdAccountants[1].nome} → 1 empresa`);
      }
    }

    // 6. Criar XMLs de exemplo
    console.log("\n6️⃣ Criando XMLs de exemplo...");
    
    const xmlsData = [
      {
        companyId: createdCompanies[0].id,
        chave: "35241112345678000190550010000000011234567801",
        tipoDoc: "NFe",
        dataEmissao: "2024-11-01",
        hora: "10:30:00",
        cnpjEmitente: "12345678000190",
        cnpjDestinatario: "98765432000100",
        razaoSocialDestinatario: "Cliente ABC LTDA",
        totalNota: "1500.00",
        totalImpostos: "270.00",
        categoria: "emitida",
        statusValidacao: "valido",
      },
      {
        companyId: createdCompanies[0].id,
        chave: "35241112345678000190550010000000021234567802",
        tipoDoc: "NFCe",
        dataEmissao: "2024-11-01",
        hora: "14:15:00",
        cnpjEmitente: "12345678000190",
        cnpjDestinatario: null,
        razaoSocialDestinatario: "Consumidor Final",
        totalNota: "89.90",
        totalImpostos: "13.49",
        categoria: "emitida",
        statusValidacao: "valido",
      },
      {
        companyId: createdCompanies[0].id,
        chave: "35241098765432000100550010000000031234567803",
        tipoDoc: "NFe",
        dataEmissao: "2024-10-31",
        hora: "09:20:00",
        cnpjEmitente: "98765432000100",
        cnpjDestinatario: "12345678000190",
        razaoSocialDestinatario: "Empresa Exemplo LTDA",
        totalNota: "3200.00",
        totalImpostos: "576.00",
        categoria: "recebida",
        statusValidacao: "valido",
      },
      {
        companyId: createdCompanies[1].id,
        chave: "35241098765432000100550010000000041234567804",
        tipoDoc: "NFe",
        dataEmissao: "2024-11-02",
        hora: "11:45:00",
        cnpjEmitente: "98765432000100",
        cnpjDestinatario: "11222333000144",
        razaoSocialDestinatario: "Comércio ABC Ltda",
        totalNota: "5600.00",
        totalImpostos: "1008.00",
        categoria: "emitida",
        statusValidacao: "valido",
      },
      {
        companyId: createdCompanies[2].id,
        chave: "35241011222333000144550010000000051234567805",
        tipoDoc: "NFe",
        dataEmissao: "2024-10-30",
        hora: "16:30:00",
        cnpjEmitente: "11222333000144",
        cnpjDestinatario: "12345678000190",
        razaoSocialDestinatario: "Empresa Exemplo LTDA",
        totalNota: "2100.00",
        totalImpostos: "378.00",
        categoria: "emitida",
        statusValidacao: "valido",
      },
      {
        companyId: createdCompanies[0].id,
        chave: "35241099887766000155550010000000061234567806",
        tipoDoc: "NFe",
        dataEmissao: "2024-10-29",
        hora: "13:00:00",
        cnpjEmitente: "99887766000155",
        cnpjDestinatario: "12345678000190",
        razaoSocialDestinatario: "Empresa Exemplo LTDA",
        totalNota: "890.00",
        totalImpostos: "160.20",
        categoria: "recebida",
        statusValidacao: "invalido", // Um XML inválido para testar alertas
      },
    ];

    let xmlsCreated = 0;
    
    for (const xmlData of xmlsData) {
      const [existing] = await db
        .select()
        .from(xmls)
        .where(eq(xmls.chave, xmlData.chave))
        .limit(1);

      if (!existing) {
        // Cria XML simples para storage
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe${xmlData.chave}">
      <ide>
        <dhEmi>${xmlData.dataEmissao}T${xmlData.hora}-03:00</dhEmi>
        <mod>${xmlData.tipoDoc === "NFe" ? "55" : "65"}</mod>
      </ide>
      <emit>
        <CNPJ>${xmlData.cnpjEmitente}</CNPJ>
      </emit>
      ${xmlData.cnpjDestinatario ? `
      <dest>
        <CNPJ>${xmlData.cnpjDestinatario}</CNPJ>
        <xNome>${xmlData.razaoSocialDestinatario}</xNome>
      </dest>
      ` : ''}
      <total>
        <ICMSTot>
          <vNF>${xmlData.totalNota}</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

        // Salva no Contabo Storage
        // Precisamos parsear o XML para obter os dados necessários
        try {
          const { parseXmlContent } = await import('./xmlParser');
          const parsedXml = await parseXmlContent(xmlContent);
          
          const saveResult = await saveXmlToContabo(xmlContent, parsedXml);
          
          if (saveResult.success) {
            // Salva no banco
            await db.insert(xmls).values({
              ...xmlData,
              filepath: saveResult.filepath || "",
            });
            xmlsCreated++;
            console.log(`   ✅ XML criado e salvo no Contabo: ${xmlData.chave.substring(0, 12)}... (${xmlData.categoria})`);
          } else {
            console.error(`   ❌ Erro ao salvar XML no Contabo: ${saveResult.error}`);
          }
        } catch (parseError) {
          console.error(`   ❌ Erro ao parsear XML para seed:`, parseError);
          // Fallback: salva no sistema local se falhar
          const saveResult = await saveToValidated(xmlContent, xmlData.chave);
          if (saveResult.success) {
            await db.insert(xmls).values({
              ...xmlData,
              filepath: saveResult.filepath || "",
            });
            xmlsCreated++;
            console.log(`   ⚠️  XML criado no sistema local (fallback): ${xmlData.chave.substring(0, 12)}...`);
          }
        }
      }
    }

    if (xmlsCreated === 0) {
      console.log("   ℹ️  XMLs já existem no banco");
    }

    // 7. Criar alertas de exemplo
    console.log("\n7️⃣ Criando alertas de exemplo...");
    
    const xmlInvalido = await db
      .select()
      .from(xmls)
      .where(eq(xmls.statusValidacao, "invalido"))
      .limit(1);

    if (xmlInvalido[0]) {
      const [existingAlert] = await db
        .select()
        .from(alerts)
        .where(eq(alerts.xmlId, xmlInvalido[0].id))
        .limit(1);

      if (!existingAlert) {
        await db.insert(alerts).values({
          companyId: xmlInvalido[0].companyId,
          xmlId: xmlInvalido[0].id,
          type: "xml_invalido",
          severity: "high",
          title: "XML com status inválido",
          message: `O XML ${xmlInvalido[0].chave.substring(0, 12)}... foi marcado como inválido e requer atenção.`,
          resolved: false,
        });
        console.log("   ✅ Alerta criado para XML inválido");
      }
    }

    // Alerta geral de exemplo
    const [generalAlertCheck] = await db
      .select()
      .from(alerts)
      .where(eq(alerts.type, "info_geral"))
      .limit(1);

    if (!generalAlertCheck && createdCompanies[0]) {
      await db.insert(alerts).values({
        companyId: createdCompanies[0].id,
        xmlId: null,
        type: "info_geral",
        severity: "low",
        title: "Bem-vindo ao Adapta Fiscal",
        message: "Sistema configurado e pronto para uso. Faça upload de XMLs para começar!",
        resolved: false,
      });
      console.log("   ✅ Alerta informativo criado");
    }

    // Resumo final
    console.log("\n📊 RESUMO DOS SEEDS:\n");
    
    const totalUsers = await db.select().from(users);
    const totalCompanies = await db.select().from(companies);
    const totalAccountants = await db.select().from(accountants);
    const totalXmls = await db.select().from(xmls);
    const totalAlerts = await db.select().from(alerts);

    console.log(`   👤 Usuários: ${totalUsers.length}`);
    console.log(`   🏢 Empresas: ${totalCompanies.length}`);
    console.log(`   📊 Contadores: ${totalAccountants.length}`);
    console.log(`   📄 XMLs: ${totalXmls.length}`);
    console.log(`   🚨 Alertas: ${totalAlerts.length}`);

    console.log("\n✅ Seeds completados com sucesso!\n");

  } catch (error) {
    console.error("\n❌ Erro ao executar seeds:", error);
    throw error;
  }
}

// Executa seeds se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeeds()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}



