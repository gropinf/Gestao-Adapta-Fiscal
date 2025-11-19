
import { db } from "./server/db";
import { users, companyUsers } from "./shared/schema";
import { hashPassword } from "./server/auth";
import { eq } from "drizzle-orm";

async function createSupportUser() {
  console.log("🔧 Criando usuário de suporte...\n");

  try {
    // 1. Hash da senha
    const passwordHash = await hashPassword("123456");

    // 2. Criar ou atualizar usuário
    const [supportUser] = await db
      .insert(users)
      .values({
        email: "suporte@groppoinformatica.com.br",
        passwordHash,
        name: "Suporte Groppo Informática",
        role: "admin",
        active: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          passwordHash,
          name: "Suporte Groppo Informática",
          role: "admin",
          active: true,
        },
      })
      .returning();

    console.log("✅ Usuário criado:", supportUser.email);

    // 3. Buscar admin
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@adaptafiscal.com.br"))
      .limit(1);

    if (!adminUser) {
      console.log("⚠️  Admin não encontrado. Pulando vínculo de empresas.");
      return;
    }

    // 4. Buscar empresas do admin
    const adminCompanies = await db
      .select()
      .from(companyUsers)
      .where(eq(companyUsers.userId, adminUser.id));

    console.log(`\n📊 Admin possui ${adminCompanies.length} empresas vinculadas`);

    // 5. Vincular suporte às mesmas empresas
    let vinculosAdicionados = 0;
    for (const link of adminCompanies) {
      // Verificar se já existe vínculo
      const [existing] = await db
        .select()
        .from(companyUsers)
        .where(eq(companyUsers.userId, supportUser.id))
        .where(eq(companyUsers.companyId, link.companyId))
        .limit(1);

      if (!existing) {
        await db.insert(companyUsers).values({
          userId: supportUser.id,
          companyId: link.companyId,
        });
        vinculosAdicionados++;
      }
    }

    console.log(`✅ ${vinculosAdicionados} vínculos criados`);

    // 6. Verificação final
    const supportCompanies = await db
      .select()
      .from(companyUsers)
      .where(eq(companyUsers.userId, supportUser.id));

    console.log(`\n✅ Usuário suporte agora possui ${supportCompanies.length} empresas vinculadas`);
    console.log("\n🎉 Processo concluído com sucesso!\n");
    console.log("📧 Email: suporte@groppoinformatica.com.br");
    console.log("🔑 Senha: 123456");
    console.log("👤 Role: admin");
    console.log("✅ Status: ativo\n");

  } catch (error) {
    console.error("❌ Erro ao criar usuário:", error);
    throw error;
  }
}

// Executar
createSupportUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
