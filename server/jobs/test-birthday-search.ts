/**
 * Script de teste para verificar a função de busca de clientes aniversariantes
 * Execute este script para testar se a nova implementação está funcionando
 */

import { storage } from '../storage';

async function testBirthdayClientSearch() {
  console.log("=== TESTE: Busca de Clientes Aniversariantes ===\n");
  
  try {
    // Teste 1: Buscar clientes aniversariantes para hoje
    console.log("1. Testando busca para hoje:");
    const today = new Date();
    const todayClients = await storage.getClientsByBirthdayDate(today);
    console.log(`   - Encontrados ${todayClients.length} cliente(s) aniversariante(s) hoje`);
    
    if (todayClients.length > 0) {
      console.log("   - Clientes encontrados:");
      todayClients.forEach(client => {
        console.log(`     * ${client.name} (${client.phone}) - Aniversário: ${client.birthday}`);
      });
    }
    
    // Teste 2: Buscar clientes aniversariantes para amanhã
    console.log("\n2. Testando busca para amanhã:");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowClients = await storage.getClientsByBirthdayDate(tomorrow);
    console.log(`   - Encontrados ${tomorrowClients.length} cliente(s) aniversariante(s) amanhã`);
    
    if (tomorrowClients.length > 0) {
      console.log("   - Clientes encontrados:");
      tomorrowClients.forEach(client => {
        console.log(`     * ${client.name} (${client.phone}) - Aniversário: ${client.birthday}`);
      });
    }
    
    // Teste 3: Buscar clientes aniversariantes para uma data específica (25 de dezembro)
    console.log("\n3. Testando busca para 25 de dezembro:");
    const christmas = new Date();
    christmas.setMonth(11, 25); // Dezembro = 11, dia 25
    const christmasClients = await storage.getClientsByBirthdayDate(christmas);
    console.log(`   - Encontrados ${christmasClients.length} cliente(s) aniversariante(s) no dia 25/12`);
    
    if (christmasClients.length > 0) {
      console.log("   - Clientes encontrados:");
      christmasClients.forEach(client => {
        console.log(`     * ${client.name} (${client.phone}) - Aniversário: ${client.birthday}`);
      });
    }
    
    // Teste 4: Comparar com método antigo (todos os clientes)
    console.log("\n4. Comparando com busca de todos os clientes:");
    const startTime = Date.now();
    const todayClientsNew = await storage.getClientsByBirthdayDate(today);
    const newMethodTime = Date.now() - startTime;
    
    const startTimeOld = Date.now();
    const allClients = await storage.getClients();
    const oldMethodTime = Date.now() - startTimeOld;
    
    console.log(`   - Novo método (busca direta): ${newMethodTime}ms - ${todayClientsNew.length} clientes`);
    console.log(`   - Método antigo (todos + filtro): ${oldMethodTime}ms - ${allClients.length} clientes total`);
    console.log(`   - Melhoria de performance: ${((oldMethodTime - newMethodTime) / oldMethodTime * 100).toFixed(1)}%`);
    
    console.log("\n=== TESTE CONCLUÍDO COM SUCESSO ===");
    
  } catch (error) {
    console.error("Erro durante o teste:", error);
    console.log("\n=== TESTE FALHOU ===");
  }
}

// Função para testar formatos de data específicos
async function testDateFormats() {
  console.log("\n=== TESTE: Formatos de Data ===\n");
  
  try {
    // Buscar alguns clientes para verificar formatos
    const allClients = await storage.getClients();
    const clientsWithBirthday = allClients.filter(client => client.birthday);
    
    console.log("Formatos de data encontrados no banco:");
    const formats = new Set();
    
    clientsWithBirthday.slice(0, 10).forEach(client => {
      if (client.birthday) {
        const format = detectDateFormat(client.birthday);
        formats.add(format);
        console.log(`   - ${client.name}: ${client.birthday} (${format})`);
      }
    });
    
    console.log(`\nFormatos únicos encontrados: ${Array.from(formats).join(', ')}`);
    
  } catch (error) {
    console.error("Erro ao testar formatos:", error);
  }
}

function detectDateFormat(dateString: string): string {
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return "YYYY-MM-DD";
  } else if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    return "DD/MM/YYYY";
  } else {
    return "FORMATO_DESCONHECIDO";
  }
}

// Executar testes se chamado diretamente
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename || process.argv[1].endsWith('test-birthday-search.ts');

if (isMainModule) {
  console.log("Iniciando testes da função de busca de clientes aniversariantes...\n");
  
  testBirthdayClientSearch()
    .then(() => testDateFormats())
    .then(() => {
      console.log("\nTodos os testes concluídos!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Erro nos testes:", error);
      process.exit(1);
    });
}

export { testBirthdayClientSearch, testDateFormats };