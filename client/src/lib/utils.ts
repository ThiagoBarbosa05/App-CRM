import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const baseS3Url = "https://pub-2430b33535154e839fd64049d300b4a4.r2.dev/";

export function formatCpf(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, "");
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatPhone(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if ((d.length === 13 || d.length === 12) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone;
}

export function formatDate(dateString: string): string {
  // Para aniversários no formato YYYY-MM-DD, fazer split manual para evitar problemas de timezone
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  }

  // Para datas de eventos (timestamps), usar formatação brasileira com timezone ajustado
  const date = new Date(dateString);

  // Verificar se é uma data válida
  if (isNaN(date.getTime())) {
    return dateString; // Retorna string original se não conseguir parsear
  }

  // Formatação completa para eventos (incluindo hora)
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "R$ 0,00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "R$ 0,00";
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function parseCurrency(value: string): string {
  // Remove R$, spaces, and dots (thousands separator)
  // Replace comma (decimal separator) with dot
  const cleaned = value.replace(/[R$\s.]/g, "").replace(",", ".");
  return cleaned;
}

export function formatCurrencyInput(value: string | number): string {
  if (value === undefined || value === null || value === "") return "";

  // Convert to string and keep only digits
  let cleanValue = value.toString().replace(/\D/g, "");

  // If empty or only zeros, return "0,00"
  if (!cleanValue || parseInt(cleanValue) === 0) return "0,00";

  // Pad with leading zeros if needed
  while (cleanValue.length < 3) {
    cleanValue = "0" + cleanValue;
  }

  // Insert decimal comma before the last two digits
  const integerPart = cleanValue.slice(0, -2);
  const decimalPart = cleanValue.slice(-2);

  // Format integer part with thousands separator
  const formattedInteger = Number(integerPart).toLocaleString("pt-BR");

  return `${formattedInteger},${decimalPart}`;
}

export function formatEventDate(dateString: string): string {
  const date = new Date(dateString);

  // Verificar se é uma data válida
  if (isNaN(date.getTime())) {
    return dateString;
  }

  // Formatação apenas com data para eventos (sem hora)
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatEventDateTime(dateString: string): string {
  const date = new Date(dateString);

  // Verificar se é uma data válida
  if (isNaN(date.getTime())) {
    return dateString;
  }

  // Formatação completa com data e hora para eventos
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Função para converter data UTC para datetime-local brasileiro
export function convertUTCToLocalDatetime(dateString: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return "";
  }

  // Converter para fuso brasileiro usando Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;

  // Formato datetime-local: YYYY-MM-DDTHH:MM
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

// Função para converter datetime-local brasileiro para string com timezone
export function convertLocalDatetimeToUTC(datetimeLocal: string): string {
  if (!datetimeLocal) return "";

  // O input datetime-local retorna no formato YYYY-MM-DDTHH:MM
  // Precisamos interpretar isso como horário de Brasília
  return datetimeLocal + ":00-03:00";
}

export function validateCpf(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");

  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;

  return true;
}
