/**
 * Exemplo de como executar o job de envio de mensagens de aniversário
 * 
 * Este arquivo demonstra diferentes formas de executar o job:
 * 1. Execução manual (para testes)
 * 2. Execução agendada (com verificação de horário)
 * 3. Integração com cron job
 */

import { sendBirthdayMessages, sendBirthdayMessagesScheduled, shouldRunAutomation } from './send-birthday-mensage';

/**
 * Exemplo de execução manual do job
 * Use para testes durante desenvolvimento
 */
export async function runBirthdayJobManually() {
  console.log("=== EXECUÇÃO MANUAL DO JOB DE ANIVERSÁRIO ===");
  try {
    await sendBirthdayMessages();
    console.log("Job executado com sucesso!");
  } catch (error) {
    console.error("Erro na execução manual:", error);
  }
}

/**
 * Exemplo de execução agendada do job
 * Use para executar apenas no horário correto das automações
 */
export async function runBirthdayJobScheduled() {
  console.log("=== EXECUÇÃO AGENDADA DO JOB DE ANIVERSÁRIO ===");
  try {
    await sendBirthdayMessagesScheduled();
    console.log("Job agendado executado com sucesso!");
  } catch (error) {
    console.error("Erro na execução agendada:", error);
  }
}

/**
 * Exemplo de como integrar com um cron job
 * Execute este script a cada 5 minutos para verificar automações
 */
export async function cronJobExample() {
  console.log("=== CRON JOB - VERIFICAÇÃO A CADA 5 MINUTOS ===");
  
  try {
    // Executa apenas automações no horário correto
    await sendBirthdayMessagesScheduled();
  } catch (error) {
    console.error("Erro no cron job:", error);
    // Em ambiente de produção, você pode enviar alertas aqui
    // sendAlertToMonitoring(error);
  }
}

/**
 * Exemplo de execução com Node-Cron
 * Para usar, instale: npm install node-cron @types/node-cron
 */
export function setupCronJobs() {
  // Descomente as linhas abaixo após instalar node-cron
  
  // import * as cron from 'node-cron';
  
  // // Executa a cada 5 minutos durante horário comercial
  // cron.schedule('*/5 8-18 * * *', async () => {
  //   console.log('Executando verificação de automações de aniversário...');
  //   await cronJobExample();
  // }, {
  //   timezone: "America/Sao_Paulo"
  // });
  
  // // Executa uma vez por dia às 6h para verificação geral
  // cron.schedule('0 6 * * *', async () => {
  //   console.log('Execução diária do job de aniversário...');
  //   await sendBirthdayMessages();
  // }, {
  //   timezone: "America/Sao_Paulo"
  // });
  
  console.log("Cron jobs configurados (descomente o código para ativar)");
}

/**
 * Exemplo de teste para verificar se uma automação deve executar
 */
export function testAutomationTiming() {
  const testTimes = ["09:00", "14:30", "18:00"];
  
  console.log("=== TESTE DE HORÁRIOS DE AUTOMAÇÃO ===");
  
  testTimes.forEach(time => {
    const shouldRun = shouldRunAutomation(time);
    console.log(`Automação ${time}: ${shouldRun ? "DEVE EXECUTAR" : "não deve executar"}`);
  });
}

// Execução principal compatível com ES modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename || process.argv[1].endsWith('birthday-job-example.ts');

if (isMainModule) {
  console.log("Escolha uma opção:");
  console.log("1. Execução manual");
  console.log("2. Execução agendada");
  console.log("3. Teste de horários");
  
  const option = process.argv[2];
  
  switch (option) {
    case "1":
      runBirthdayJobManually();
      break;
    case "2":
      runBirthdayJobScheduled();
      break;
    case "3":
      testAutomationTiming();
      break;
    default:
      console.log("Use: node birthday-job-example.ts [1|2|3]");
      console.log("Exemplo: node birthday-job-example.ts 1");
  }
}