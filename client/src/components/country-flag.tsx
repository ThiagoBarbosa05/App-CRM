import { getCountryFlagUrl, getCountryFlag } from "@/lib/country-flags";

interface CountryFlagProps {
  country?: string | null;
  size?: number;
  className?: string;
}

export function CountryFlag({ country, size = 20, className = "" }: CountryFlagProps) {
  const url = getCountryFlagUrl(country, size);
  const emoji = getCountryFlag(country);

  if (!url) {
    return <span className={`text-base leading-none ${className}`}>{emoji}</span>;
  }

  return (
    <img
      src={url}
      alt={country ?? ""}
      width={size}
      height={Math.round(size * 0.75)}
      className={`inline-block rounded-sm object-cover shadow-sm ${className}`}
      onError={(e) => {
        const target = e.currentTarget;
        target.style.display = "none";
        const span = document.createElement("span");
        span.textContent = emoji;
        span.className = "text-base leading-none";
        target.parentNode?.insertBefore(span, target);
      }}
    />
  );
}
