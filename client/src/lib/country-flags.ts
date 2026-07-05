const COUNTRY_FLAGS: Record<string, string> = {
  CHILE: "🇨🇱",
  ARGENTINA: "🇦🇷",
  URUGUAI: "🇺🇾",
  BRASIL: "🇧🇷",
  EUA: "🇺🇸",
  FRANÇA: "🇫🇷",
  ITÁLIA: "🇮🇹",
  PORTUGAL: "🇵🇹",
  ESPANHA: "🇪🇸",
  ALEMANHA: "🇩🇪",
  OUTROS: "🌍",
};

const COUNTRY_ISO: Record<string, string> = {
  CHILE: "cl",
  ARGENTINA: "ar",
  URUGUAI: "uy",
  BRASIL: "br",
  EUA: "us",
  FRANÇA: "fr",
  ITÁLIA: "it",
  PORTUGAL: "pt",
  ESPANHA: "es",
  ALEMANHA: "de",
  "ÁFRICA DO SUL": "za",
  AUSTRÁLIA: "au",
  ÁUSTRIA: "at",
  HUNGRIA: "hu",
  GRÉCIA: "gr",
  NOVA: "nz",
  "NOVA ZELÂNDIA": "nz",
  GEÓRGIA: "ge",
};

export function getCountryFlag(country?: string | null): string {
  return COUNTRY_FLAGS[(country ?? "").trim().toUpperCase()] ?? "🌍";
}

export function getCountryIso(country?: string | null): string | null {
  return COUNTRY_ISO[(country ?? "").trim().toUpperCase()] ?? null;
}

export function getCountryFlagUrl(country?: string | null, size: number = 20): string | null {
  const iso = getCountryIso(country);
  if (!iso) return null;
  return `https://flagcdn.com/w${size}/${iso}.png`;
}
