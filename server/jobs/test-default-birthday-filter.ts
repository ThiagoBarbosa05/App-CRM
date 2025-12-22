/**
 * Teste para validar que clientes com data padrão 2000-01-01 não recebem mensagens
 */

import { storage } from "../storage";

async function testDefaultBirthdayFilter() {
  console.log("=== TESTE: Filtro de Data Padrão 2000-01-01 ===\n");
  
  try {
    // Teste 1: Verificar se 1º de janeiro filtra corretamente
    console.log("📅 Teste 1: Buscar aniversariantes de 1º de janeiro");
    const jan1st = new Date(2025, 0, 1); // 1º de janeiro
    const jan1stClients = await storage.getClientsByBirthdayDate(jan1st);
    
    console.log(`✅ Encontrados ${jan1stClients.length} cliente(s) para 01/01`);
    
    // Verificar se algum cliente tem data 2000-01-01
    const hasDefaultDate = jan1stClients.some(client => client.birthday === '2000-01-01');
    
    if (hasDefaultDate) {
      console.log("❌ ERRO: Cliente(s) com data padrão 2000-01-01 foi(ram) incluído(s)!");
      jan1stClients.forEach(client => {
        if (client.birthday === '2000-01-01') {
          console.log(`   - ${client.name} (${client.birthday})`);
        }
      });
    } else {
      console.log("✅ SUCESSO: Nenhum cliente com data padrão 2000-01-01 foi incluído");
    }
    
    // Listar clientes válidos encontrados
    if (jan1stClients.length > 0) {
      console.log("\n📋 Clientes válidos encontrados:");
      jan1stClients.forEach(client => {
        console.log(`   - ${client.name} (${client.birthday})`);
      });
    }
    
    console.log("\n" + "=".repeat(60) + "\n");
    
    // Teste 2: Verificar função getUpcomingBirthdays
    console.log("📅 Teste 2: Buscar aniversários próximos (7 dias)");
    const upcomingBirthdays = await storage.getUpcomingBirthdays(7);
    
    console.log(`✅ Encontrados ${upcomingBirthdays.length} aniversariante(s) nos próximos 7 dias`);
    
    // Verificar se algum tem data padrão
    const hasDefaultInUpcoming = upcomingBirthdays.some(client => client.birthday === '2000-01-01');
    
    if (hasDefaultInUpcoming) {
      console.log("❌ ERRO: Cliente(s) com data padrão 2000-01-01 foi(ram) incluído(s)!");
      upcomingBirthdays.forEach(client => {
        if (client.birthday === '2000-01-01') {
          console.log(`   - ${client.name} (${client.birthday})`);
        }
      });
    } else {
      console.log("✅ SUCESSO: Nenhum cliente com data padrão 2000-01-01 foi incluído");
    }
    
    // Listar próximos aniversariantes (máximo 5)
    if (upcomingBirthdays.length > 0) {
      console.log("\n📋 Próximos aniversariantes (primeiros 5):");
      upcomingBirthdays.slice(0, 5).forEach(client => {
        const nextBirthday = client.nextBirthday ? 
          new Date(client.nextBirthday).toLocaleDateString('pt-BR') : 
          'N/A';
        console.log(`   - ${client.name} (${client.birthday}) - Próximo: ${nextBirthday}`);
      });
    }
    
    console.log("\n" + "=".repeat(60) + "\n");
    console.log("🎉 TESTE CONCLUÍDO\n");
    
    // Resumo final
    console.log("📊 RESUMO:");
    console.log(`   - Clientes 01/01: ${jan1stClients.length}`);
    console.log(`   - Aniversariantes próximos: ${upcomingBirthdays.length}`);
    console.log(`   - Data padrão filtrada: ${!hasDefaultDate && !hasDefaultInUpcoming ? '✅ SIM' : '❌ NÃO'}`);
    
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

// Executar teste
testDefaultBirthdayFilter()
  .then(() => {
    console.log("\n✅ Teste finalizado com sucesso");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro ao executar teste:", error);
    process.exit(1);
  });
