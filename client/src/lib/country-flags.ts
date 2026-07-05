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

export function getCountryFlag(country?: string | null): string {
  return COUNTRY_FLAGS[country ?? ""] ?? "🌍";
}
