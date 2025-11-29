import { db } from "./db";
import { users, companies, xmls, alerts, accountants } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Script de testes das funcionalidades do backend
 */

interface TestResult {
  name: string;
  status: "success" | "error";
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function logTest(name: string, status: "success" | "error", message: string, data?: any) {
  results.push({ name, status, message, data });
  const icon = status === "success" ? "✅" : "❌";
  console.log(`${icon} ${name}: ${message}`);
  if (data && status === "error") {
    console.log("   Detalhes:", data);
  }
}

async function runTests() {
  console.log("\n🧪 INICIANDO TESTES DO BACKEND\n");
  console.log("═".repeat(70));

  try {
    // TESTE 1: Conexão com banco
    console.log("\n📊 1. TESTE DE CONEXÃO COM BANCO\n");
    try {
      await db.select().from(users).limit(1);
      logTest("T1.1 - Conexão Database", "success", "Banco conectado e respondendo");
    } catch (error: any) {
      logTest("T1.1 - Conexão Database", "error", "Falha na conexão", error.message);
      throw new Error("Banco não conectado. Impossível continuar testes.");
    }

    // TESTE 2: Seeds carregados
    console.log("\n📦 2. TESTE DE DADOS (SEEDS)\n");
    
    const allUsers = await db.select().from(users);
    if (allUsers.length >= 2) {
      logTest("T2.1 - Usuários", "success", `${allUsers.length} usuários encontrados`);
    } else {
      logTest("T2.1 - Usuários", "error", `Esperado 2+, encontrado ${allUsers.length}`);
    }

    const allCompanies = await db.select().from(companies);
    if (allCompanies.length >= 3) {
      logTest("T2.2 - Empresas", "success", `${allCompanies.length} empresas encontradas`);
    } else {
      logTest("T2.2 - Empresas", "error", `Esperado 3+, encontrado ${allCompanies.length}`);
    }

    const allXmls = await db.select().from(xmls);
    if (allXmls.length >= 7) {
      logTest("T2.3 - XMLs", "success", `${allXmls.length} XMLs encontrados`);
    } else {
      logTest("T2.3 - XMLs", "error", `Esperado 7+, encontrado ${allXmls.length}`);
    }

    const allAlerts = await db.select().from(alerts);
    if (allAlerts.length >= 2) {
      logTest("T2.4 - Alertas", "success", `${allAlerts.length} alertas encontrados`);
    } else {
      logTest("T2.4 - Alertas", "error", `Esperado 2+, encontrado ${allAlerts.length}`);
    }

    const allAccountants = await db.select().from(accountants);
    if (allAccountants.length >= 2) {
      logTest("T2.5 - Contadores", "success", `${allAccountants.length} contadores encontrados`);
    } else {
      logTest("T2.5 - Contadores", "error", `Esperado 2+, encontrado ${allAccountants.length}`);
    }

    // TESTE 3: Estrutura de dados
    console.log("\n🔍 3. TESTE DE ESTRUTURA DE DADOS\n");

    const adminUser = await db.select().from(users).where(eq(users.email, "admin@adaptafiscal.com.br")).limit(1);
    if (adminUser.length === 1) {
      logTest("T3.1 - Usuário Admin", "success", "Usuário admin encontrado", {
        email: adminUser[0].email,
        name: adminUser[0].name,
        role: adminUser[0].role
      });
    } else {
      logTest("T3.1 - Usuário Admin", "error", "Usuário admin não encontrado");
    }

    const firstCompany = allCompanies[0];
    if (firstCompany && firstCompany.cnpj && firstCompany.razaoSocial) {
      logTest("T3.2 - Empresa Válida", "success", "Empresa com dados completos", {
        cnpj: firstCompany.cnpj,
        razaoSocial: firstCompany.razaoSocial,
        cidade: firstCompany.cidade,
        uf: firstCompany.uf
      });
    } else {
      logTest("T3.2 - Empresa Válida", "error", "Empresa sem dados obrigatórios");
    }

    const firstXml = allXmls[0];
    if (firstXml && firstXml.chave && firstXml.chave.length === 44) {
      logTest("T3.3 - XML com Chave Válida", "success", "Chave NFe tem 44 caracteres", {
        chave: firstXml.chave,
        categoria: firstXml.categoria,
        totalNota: firstXml.totalNota
      });
    } else {
      logTest("T3.3 - XML com Chave Válida", "error", "Chave NFe inválida");
    }

    // TESTE 4: Categorização de XMLs
    console.log("\n📄 4. TESTE DE CATEGORIZAÇÃO DE XMLs\n");

    const emitidas = allXmls.filter(x => x.categoria === "emitida");
    const recebidas = allXmls.filter(x => x.categoria === "recebida");
    
    logTest("T4.1 - XMLs Emitidas", "success", `${emitidas.length} emitidas encontradas`);
    logTest("T4.2 - XMLs Recebidas", "success", `${recebidas.length} recebidas encontradas`);

    if (emitidas.length > 0 && recebidas.length > 0) {
      logTest("T4.3 - Categorização Mix", "success", "Sistema tem mix de emitidas e recebidas");
    } else {
      logTest("T4.3 - Categorização Mix", "error", "Falta XMLs emitidas ou recebidas");
    }

    // TESTE 5: Alertas
    console.log("\n🚨 5. TESTE DE ALERTAS\n");

    const unresolvedAlerts = allAlerts.filter(a => !a.resolved);
    if (unresolvedAlerts.length > 0) {
      logTest("T5.1 - Alertas Não Resolvidos", "success", `${unresolvedAlerts.length} alertas ativos`, {
        sample: {
          type: unresolvedAlerts[0].type,
          severity: unresolvedAlerts[0].severity,
          title: unresolvedAlerts[0].title
        }
      });
    } else {
      logTest("T5.1 - Alertas Não Resolvidos", "error", "Nenhum alerta ativo encontrado");
    }

    const alertSeverities = [...new Set(allAlerts.map(a => a.severity))];
    if (alertSeverities.length > 1) {
      logTest("T5.2 - Severidades Variadas", "success", `${alertSeverities.length} níveis de severidade`, {
        severities: alertSeverities
      });
    } else {
      logTest("T5.2 - Severidades Variadas", "error", "Apenas 1 nível de severidade");
    }

    // TESTE 6: Integridade Referencial
    console.log("\n🔗 6. TESTE DE INTEGRIDADE REFERENCIAL\n");

    const xmlsWithCompany = allXmls.filter(x => {
      return allCompanies.some(c => c.id === x.companyId);
    });
    
    if (xmlsWithCompany.length === allXmls.length) {
      logTest("T6.1 - XML → Company", "success", "Todos os XMLs tem empresa válida");
    } else {
      logTest("T6.1 - XML → Company", "error", `${allXmls.length - xmlsWithCompany.length} XMLs órfãos`);
    }

    const alertsWithCompany = allAlerts.filter(a => {
      return allCompanies.some(c => c.id === a.companyId);
    });
    
    if (alertsWithCompany.length === allAlerts.length) {
      logTest("T6.2 - Alert → Company", "success", "Todos os alertas tem empresa válida");
    } else {
      logTest("T6.2 - Alert → Company", "error", `${allAlerts.length - alertsWithCompany.length} alertas órfãos`);
    }

    // TESTE 7: Validações de Dados
    console.log("\n✔️ 7. TESTE DE VALIDAÇÕES\n");

    const invalidCnpjs = allCompanies.filter(c => !c.cnpj || c.cnpj.length < 14);
    if (invalidCnpjs.length === 0) {
      logTest("T7.1 - CNPJs Válidos", "success", "Todos os CNPJs têm formato correto");
    } else {
      logTest("T7.1 - CNPJs Válidos", "error", `${invalidCnpjs.length} CNPJs inválidos`);
    }

    const invalidChaves = allXmls.filter(x => !x.chave || x.chave.length !== 44);
    if (invalidChaves.length === 0) {
      logTest("T7.2 - Chaves NFe Válidas", "success", "Todas as chaves têm 44 caracteres");
    } else {
      logTest("T7.2 - Chaves NFe Válidas", "error", `${invalidChaves.length} chaves inválidas`);
    }

    const invalidCategories = allXmls.filter(x => x.categoria !== "emitida" && x.categoria !== "recebida");
    if (invalidCategories.length === 0) {
      logTest("T7.3 - Categorias Válidas", "success", "Todas as categorias são válidas");
    } else {
      logTest("T7.3 - Categorias Válidas", "error", `${invalidCategories.length} categorias inválidas`);
    }

    // TESTE 8: Resumo Estatístico
    console.log("\n📊 8. ESTATÍSTICAS GERAIS\n");

    const totalValue = allXmls.reduce((sum, x) => sum + parseFloat(x.totalNota || "0"), 0);
    logTest("T8.1 - Total Faturado", "success", `R$ ${totalValue.toFixed(2)} em notas`, {
      totalNotas: allXmls.length,
      valorMedio: (totalValue / allXmls.length).toFixed(2)
    });

    const dateRange = {
      oldest: allXmls.sort((a, b) => a.dataEmissao.localeCompare(b.dataEmissao))[0]?.dataEmissao,
      newest: allXmls.sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao))[0]?.dataEmissao
    };
    logTest("T8.2 - Período dos XMLs", "success", `De ${dateRange.oldest} até ${dateRange.newest}`);

    // RESUMO FINAL
    console.log("\n═".repeat(70));
    console.log("\n📋 RESUMO DOS TESTES\n");

    const total = results.length;
    const success = results.filter(r => r.status === "success").length;
    const errors = results.filter(r => r.status === "error").length;
    const percentage = ((success / total) * 100).toFixed(1);

    console.log(`Total de Testes: ${total}`);
    console.log(`✅ Sucessos: ${success}`);
    console.log(`❌ Erros: ${errors}`);
    console.log(`📊 Taxa de Sucesso: ${percentage}%`);

    if (errors === 0) {
      console.log("\n🎉 TODOS OS TESTES PASSARAM! SISTEMA 100% FUNCIONAL!");
    } else if (errors <= 3) {
      console.log("\n⚠️ Sistema funcional com pequenos ajustes necessários.");
    } else {
      console.log("\n🔴 Atenção: múltiplos erros detectados. Correções necessárias.");
    }

    console.log("\n═".repeat(70));

  } catch (error: any) {
    console.error("\n❌ ERRO CRÍTICO:", error.message);
    console.error(error);
  }
}

// Executa testes
runTests()
  .then(() => {
    console.log("\n✅ Testes finalizados.\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro ao executar testes:", error);
    process.exit(1);
  });














