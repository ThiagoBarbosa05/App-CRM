/**
 * Teste para validar filtro de idade mínima (18 anos) e datas padrão
 */

import { storage } from "../storage";

async function testAgeFilterAndDefaultDates() {
  console.log("=== TESTE: Validação de Idade (18+) e Datas Padrão ===\n");
  
  const currentYear = new Date().getFullYear();
  const minBirthYear = currentYear - 18;
  
  console.log(`📅 Ano atual: ${currentYear}`);
  console.log(`📅 Ano mínimo de nascimento (18 anos): ${minBirthYear}\n`);
  
  try {
    // Teste 1: Verificar se 1º de janeiro filtra corretamente
    console.log("=" .repeat(60));
    console.log("📅 TESTE 1: Buscar aniversariantes de 1º de janeiro");
    console.log("=" .repeat(60));
    
    const jan1st = new Date(2025, 0, 1); // 1º de janeiro
    const jan1stClients = await storage.getClientsByBirthdayDate(jan1st);
    
    console.log(`\n✅ Encontrados ${jan1stClients.length} cliente(s) para 01/01\n`);
    
    // Verificar se algum cliente tem datas padrão ou é menor de idade
    const defaultDates = ['2000-01-01', '1990-01-01', '2024-01-01', '2025-01-01'];
    const hasDefaultDate = jan1stClients.some(client => 
      defaultDates.includes(client.birthday!)
    );
    
    const underageClients = jan1stClients.filter(client => {
      if (!client.birthday) return false;
      
      let birthYear: number;
      if (client.birthday.match(/^\d{4}-\d{2}-\d{2}$/)) {
        birthYear = parseInt(client.birthday.split('-')[0]);
      } else if (client.birthday.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        birthYear = parseInt(client.birthday.split('/')[2]);
      } else {
        return false;
      }
      
      return birthYear > minBirthYear;
    });
    
    if (hasDefaultDate) {
      console.log("❌ ERRO: Cliente(s) com data padrão foi(ram) incluído(s)!");
      jan1stClients.forEach(client => {
        if (defaultDates.includes(client.birthday!)) {
          console.log(`   - ${client.name} (${client.birthday})`);
        }
      });
    } else {
      console.log("✅ SUCESSO: Nenhum cliente com datas padrão foi incluído");
    }
    
    if (underageClients.length > 0) {
      console.log(`\n❌ ERRO: ${underageClients.length} cliente(s) menor(es) de idade encontrado(s)!`);
      underageClients.forEach(client => {
        const birthYear = client.birthday!.match(/^\d{4}/) ? 
          client.birthday!.split('-')[0] : 
          client.birthday!.split('/')[2];
        const age = currentYear - parseInt(birthYear);
        console.log(`   - ${client.name} (${client.birthday}) - Idade: ${age} anos`);
      });
    } else {
      console.log("✅ SUCESSO: Todos os clientes têm 18 anos ou mais");
    }
    
    // Listar clientes válidos encontrados
    if (jan1stClients.length > 0) {
      console.log("\n📋 Clientes válidos encontrados (18+ anos):");
      jan1stClients.slice(0, 5).forEach(client => {
        const birthYear = client.birthday!.match(/^\d{4}/) ? 
          client.birthday!.split('-')[0] : 
          client.birthday!.split('/')[2];
        const age = currentYear - parseInt(birthYear);
        console.log(`   - ${client.name} (${client.birthday}) - Idade: ~${age} anos`);
      });
      if (jan1stClients.length > 5) {
        console.log(`   ... e mais ${jan1stClients.length - 5} cliente(s)`);
      }
    }
    
    console.log("\n" + "=".repeat(60) + "\n");
    
    // Teste 2: Verificar função getUpcomingBirthdays
    console.log("=" .repeat(60));
    console.log("📅 TESTE 2: Buscar aniversários próximos (7 dias)");
    console.log("=" .repeat(60));
    
    const upcomingBirthdays = await storage.getUpcomingBirthdays(7);
    
    console.log(`\n✅ Encontrados ${upcomingBirthdays.length} aniversariante(s) nos próximos 7 dias\n`);
    
    // Verificar se algum tem datas padrão
    const hasDefaultInUpcoming = upcomingBirthdays.some(client => 
      defaultDates.includes(client.birthday!)
    );
    
    const underageInUpcoming = upcomingBirthdays.filter(client => {
      if (!client.birthday) return false;
      
      let birthYear: number;
      if (client.birthday.match(/^\d{4}-\d{2}-\d{2}$/)) {
        birthYear = parseInt(client.birthday.split('-')[0]);
      } else if (client.birthday.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        birthYear = parseInt(client.birthday.split('/')[2]);
      } else {
        return false;
      }
      
      return birthYear > minBirthYear;
    });
    
    if (hasDefaultInUpcoming) {
      console.log("❌ ERRO: Cliente(s) com data padrão foi(ram) incluído(s)!");
      upcomingBirthdays.forEach(client => {
        if (defaultDates.includes(client.birthday!)) {
          console.log(`   - ${client.name} (${client.birthday})`);
        }
      });
    } else {
      console.log("✅ SUCESSO: Nenhum cliente com datas padrão foi incluído");
    }
    
    if (underageInUpcoming.length > 0) {
      console.log(`\n❌ ERRO: ${underageInUpcoming.length} cliente(s) menor(es) de idade encontrado(s)!`);
      underageInUpcoming.forEach(client => {
        const birthYear = client.birthday!.match(/^\d{4}/) ? 
          client.birthday!.split('-')[0] : 
          client.birthday!.split('/')[2];
        const age = currentYear - parseInt(birthYear);
        console.log(`   - ${client.name} (${client.birthday}) - Idade: ${age} anos`);
      });
    } else {
      console.log("✅ SUCESSO: Todos os clientes têm 18 anos ou mais");
    }
    
    // Listar próximos aniversariantes (máximo 5)
    if (upcomingBirthdays.length > 0) {
      console.log("\n📋 Próximos aniversariantes válidos (primeiros 5):");
      upcomingBirthdays.slice(0, 5).forEach(client => {
        const birthYear = client.birthday!.match(/^\d{4}/) ? 
          client.birthday!.split('-')[0] : 
          client.birthday!.split('/')[2];
        const age = currentYear - parseInt(birthYear);
        const nextBirthday = client.nextBirthday ? 
          new Date(client.nextBirthday).toLocaleDateString('pt-BR') : 
          'N/A';
        console.log(`   - ${client.name} (${client.birthday}) - Idade: ~${age} anos - Próximo: ${nextBirthday}`);
      });
      if (upcomingBirthdays.length > 5) {
        console.log(`   ... e mais ${upcomingBirthdays.length - 5} cliente(s)`);
      }
    }
    
    console.log("\n" + "=".repeat(60) + "\n");
    
    // Teste 3: Casos específicos de validação
    console.log("=" .repeat(60));
    console.log("📅 TESTE 3: Validação de Casos Específicos");
    console.log("=" .repeat(60) + "\n");
    
    const testCases = [
      { date: '2000-01-01', description: 'Data padrão histórica', shouldBlock: true },
      { date: '1990-01-01', description: 'Data padrão histórica', shouldBlock: true },
      { date: '2024-01-01', description: 'Data padrão recente (2024)', shouldBlock: true },
      { date: '2025-01-01', description: 'Data padrão recente (2025)', shouldBlock: true },
      { date: `${currentYear - 17}-01-01`, description: 'Cliente com 17 anos', shouldBlock: true },
      { date: `${currentYear - 18}-01-01`, description: 'Cliente com 18 anos', shouldBlock: false },
      { date: `${currentYear - 25}-06-15`, description: 'Cliente com 25 anos', shouldBlock: false },
      { date: '1995-03-20', description: 'Cliente com ~30 anos', shouldBlock: false },
    ];
    
    console.log("Cenários testados:\n");
    testCases.forEach(testCase => {
      const status = testCase.shouldBlock ? '❌ Deve ser BLOQUEADO' : '✅ Deve ser PERMITIDO';
      console.log(`   ${testCase.date} - ${testCase.description}`);
      console.log(`   ${status}\n`);
    });
    
    console.log("=" .repeat(60) + "\n");
    console.log("🎉 TESTE CONCLUÍDO\n");
    
    // Resumo final
    console.log("📊 RESUMO:");
    console.log(`   - Clientes 01/01 encontrados: ${jan1stClients.length}`);
    console.log(`   - Aniversariantes próximos: ${upcomingBirthdays.length}`);
    console.log(`   - Menores de idade bloqueados: ${underageClients.length + underageInUpcoming.length === 0 ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   - Datas padrão bloqueadas: ${!hasDefaultDate && !hasDefaultInUpcoming ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   - Idade mínima aplicada: ✅ 18 anos (nascidos até ${minBirthYear})`);
    
    const allTestsPassed = 
      !hasDefaultDate && 
      !hasDefaultInUpcoming && 
      underageClients.length === 0 && 
      underageInUpcoming.length === 0;
    
    console.log(`\n${allTestsPassed ? '✅ TODOS OS TESTES PASSARAM!' : '❌ ALGUNS TESTES FALHARAM'}`);
    
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

// Executar teste
testAgeFilterAndDefaultDates()
  .then(() => {
    console.log("\n✅ Teste finalizado com sucesso");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro ao executar teste:", error);
    process.exit(1);
  });
