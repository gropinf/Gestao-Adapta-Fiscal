import { db } from "./server/db";
import { users, companies, accountants, xmls, companyUsers, accountantCompanies, actions } from "./shared/schema";
import { sql } from "drizzle-orm";

async function checkDatabase() {
  console.log('\n=== VERIFICAÇÃO DO BANCO DE DADOS ===\n');
  
  try {
    const userCount = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    console.log('👤 Usuários:', userCount[0].count);
    
    const companyCount = await db.select({ count: sql<number>`count(*)::int` }).from(companies);
    console.log('🏢 Empresas:', companyCount[0].count);
    
    const accountantCount = await db.select({ count: sql<number>`count(*)::int` }).from(accountants);
    console.log('📊 Contadores:', accountantCount[0].count);
    
    const xmlCount = await db.select({ count: sql<number>`count(*)::int` }).from(xmls);
    console.log('📄 XMLs:', xmlCount[0].count);
    
    const companyUserCount = await db.select({ count: sql<number>`count(*)::int` }).from(companyUsers);
    console.log('🔗 Company-Users:', companyUserCount[0].count);
    
    const accountantCompanyCount = await db.select({ count: sql<number>`count(*)::int` }).from(accountantCompanies);
    console.log('🔗 Accountant-Companies:', accountantCompanyCount[0].count);
    
    const actionCount = await db.select({ count: sql<number>`count(*)::int` }).from(actions);
    console.log('📝 Actions (Audit):', actionCount[0].count);
    
    console.log('\n=== AMOSTRA DE DADOS ===\n');
    
    const userSample = await db.select().from(users).limit(3);
    console.log('Usuários:', userSample.map(u => ({ email: u.email, role: u.role })));
    
    const companySample = await db.select().from(companies).limit(3);
    console.log('\nEmpresas:', companySample.map(c => ({ cnpj: c.cnpj, razaoSocial: c.razaoSocial })));
    
    const xmlSample = await db.select().from(xmls).limit(3);
    console.log('\nXMLs:', xmlSample.map(x => ({ chave: x.chave, tipo: x.tipoDoc, categoria: x.categoria })));
    
  } catch (error) {
    console.error('Erro:', error);
  }
  
  process.exit(0);
}

checkDatabase();













