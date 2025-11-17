import {
  birthdaysRepository,
  UpcomingBirthdayClient,
} from "../repositories/birthdays.repository";

/**
 * Service responsável pela lógica de negócio relacionada a aniversários
 */
class BirthdaysService {
  /**
   * Busca clientes com aniversários próximos nos próximos N dias
   *
   * @param days - Número de dias para buscar aniversários (padrão: 7)
   * @param responsibleId - ID do responsável para filtrar (opcional)
   * @returns Lista de clientes com aniversários próximos, ordenados por data
   *
   * @example
   * // Buscar aniversários dos próximos 7 dias
   * const upcoming = await service.getUpcomingBirthdays(7);
   *
   * // Buscar aniversários dos próximos 30 dias de um vendedor
   * const vendorBirthdays = await service.getUpcomingBirthdays(30, "vendor-id");
   *
   * @notes
   * - Aceita formatos de data: YYYY-MM-DD e DD/MM/YYYY
   * - Calcula próximo aniversário automaticamente (considera ano atual ou próximo)
   * - Ignora datas inválidas com log de erro
   * - Retorna lista ordenada por proximidade do aniversário
   * - Se aniversário já passou este ano, considera o do próximo ano
   */
  async getUpcomingBirthdays(
    days: number = 7,
    responsibleId?: string
  ): Promise<UpcomingBirthdayClient[]> {
    const today = new Date();
    const upcomingClients: UpcomingBirthdayClient[] = [];

    const allClients = await birthdaysRepository.getClientsWithBirthday(
      responsibleId
    );

    console.log(
      `Buscando ${
        responsibleId
          ? "clientes do responsável " + responsibleId
          : "todos os clientes"
      } com data de aniversário cadastrada: ${allClients.length} encontrados.`
    );

    for (const client of allClients) {
      if (client.birthday) {
        let birthday: Date;

        // Parse different date formats
        if (client.birthday.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Format: YYYY-MM-DD
          birthday = new Date(client.birthday);
        } else if (client.birthday.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          // Format: DD/MM/YYYY
          const [day, month, year] = client.birthday.split("/");
          birthday = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day)
          );
        } else {
          console.log(
            `Formato de data inválido para cliente ${client.name}: ${client.birthday}`
          );
          continue;
        }

        if (isNaN(birthday.getTime())) {
          console.log(
            `Data inválida para cliente ${client.name}: ${client.birthday}`
          );
          continue;
        }

        const thisYearBirthday = new Date(
          today.getFullYear(),
          birthday.getMonth(),
          birthday.getDate()
        );

        // Se o aniversário já passou este ano, considere o do próximo ano
        if (thisYearBirthday < today) {
          thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }

        upcomingClients.push({
          ...client,
          nextBirthday: thisYearBirthday,
        });
      }
    }

    return upcomingClients.sort(
      (a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime()
    );
  }
}

export const birthdaysService = new BirthdaysService();
