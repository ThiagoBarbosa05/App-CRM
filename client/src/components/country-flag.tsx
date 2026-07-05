import { getCountryIso, getCountryFlag } from "@/lib/country-flags";

interface CountryFlagProps {
  country?: string | null;
  size?: number;
  className?: string;
}

export function CountryFlag({ country, size = 20, className = "" }: CountryFlagProps) {
  const iso = getCountryIso(country);
  const emoji = getCountryFlag(country);

  if (!iso) {
    return null;
  }

  // flagcdn.com only supports specific widths: 20, 40, 80, 160, 320
  // Always fetch w20 and scale via CSS
  const url = `https://flagcdn.com/w20/${iso}.png`;
  const height = Math.round(size * 0.75);

  return (
    <img
      src={url}
      alt={country ?? ""}
      width={size}
      height={height}
      className={`inline-block rounded-sm object-cover shadow-sm flex-shrink-0 ${className}`}
      style={{ width: size, height }}
      onError={(e) => {
        const target = e.currentTarget;
        target.style.display = "none";
      }}
    />
  );
}
