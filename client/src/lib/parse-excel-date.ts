import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

/**
 * Converte valor de data do Excel para string no formato ISO "YYYY-MM-DD"
 */
export function parseExcelDateToISO(
  value: string | number | Date | undefined,
): string {
  if (!value) return "1990-01-01"; // Valor padrão

  // Caso seja número (serial do Excel)
  if (typeof value === "number") {
    const excelEpoch = dayjs.utc("1899-12-30");
    const date = excelEpoch.add(value, "day");
    return date.format("YYYY-MM-DD");
  }

  // Caso já seja Date
  if (value instanceof Date) {
    return dayjs.utc(value).format("YYYY-MM-DD");
  }

  // Caso seja string
  if (typeof value === "string") {
    const parsed = dayjs.utc(
      value,
      ["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"],
      true,
    );
    if (parsed.isValid()) {
      return parsed.format("YYYY-MM-DD");
    } else {
      return value.trim(); // caso venha algo inesperado
    }
  }

  return "1990-01-01";
}
