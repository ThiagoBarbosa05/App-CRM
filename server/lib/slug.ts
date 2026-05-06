/**
 * Converte um texto em slug URL-amigável (ASCII, lowercase, sem acentos)
 * Ex: "Jantar & Harmonização Junho/2026" → "jantar-harmonizacao-junho-2026"
 */
export function generateSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // remove caracteres especiais
    .trim()
    .replace(/\s+/g, "-") // espaços → hífens
    .replace(/-+/g, "-") // múltiplos hífens → um
    .replace(/^-|-$/g, ""); // remove hífens nas bordas
}
