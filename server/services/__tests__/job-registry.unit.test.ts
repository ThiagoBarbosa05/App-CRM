import { describe, expect, it } from "vitest";
import cron from "node-cron";
import { JOB_GROUPS, findJobGroup } from "../../jobs/registry";

/**
 * O registry é a única fonte das expressões cron: o que está aqui precisa
 * bater com os Scheduled Deployments configurados no Replit. Um nome errado só
 * apareceria em produção como um grupo que nunca roda — e sem erro nenhum,
 * porque o container sai com código 1 num log que ninguém lê.
 */
describe("registry de jobs de background", () => {
  it("não tem nomes de grupo duplicados", () => {
    const names = JOB_GROUPS.map((group) => group.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("resolve todo grupo declarado por findJobGroup", () => {
    for (const group of JOB_GROUPS) {
      expect(findJobGroup(group.name)).toBe(group);
    }
  });

  it("retorna undefined para grupo inexistente", () => {
    expect(findJobGroup("nao-existe")).toBeUndefined();
  });

  it("declara expressões cron válidas nos grupos agendados", () => {
    const scheduled = JOB_GROUPS.filter((group) => group.cron !== "");
    expect(scheduled.length).toBeGreaterThan(0);
    for (const group of scheduled) {
      expect(cron.validate(group.cron), `${group.name}: "${group.cron}"`).toBe(true);
    }
  });

  it("mantém bootstrap fora do agendamento automático", () => {
    // Seed e migrações rodavam no boot do processo web. Com scale-to-zero isso
    // repetiria a cada wake-up do Autoscale — o grupo existe, mas sob demanda.
    expect(findJobGroup("bootstrap")?.cron).toBe("");
  });

  it("usa America/Sao_Paulo em todos os grupos", () => {
    for (const group of JOB_GROUPS) {
      expect(group.timezone, group.name).toBe("America/Sao_Paulo");
    }
  });

  it("descreve cada grupo, já que a descrição é a ajuda da CLI", () => {
    for (const group of JOB_GROUPS) {
      expect(group.description.length, group.name).toBeGreaterThan(0);
    }
  });
});
