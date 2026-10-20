import { CountryFlag, hasCountryFlag } from "@/components/radio/CountryFlag";
import { displayCountryName } from "@/lib/radio/countries";
import { POPULAR_COUNTRIES } from "@/lib/radio/country-popular";

/** Exact directory name → bundled-flag ISO (selections outside the popular list show their name). */
const POPULAR_ISO_BY_NAME = new Map(POPULAR_COUNTRIES.map((country) => [country.name, country.iso] as const));

/** Selected countries as flag icons (display name text when no flag ships). */
function CountryFilterFlags({ countries }: { countries: string[] }) {
  return (
    <span className='flex shrink-0 items-center gap-1'>
      {countries.map((name) => {
        const iso = POPULAR_ISO_BY_NAME.get(name) ?? "";
        return iso !== "" && hasCountryFlag(iso) ? (
          <CountryFlag key={name} code={iso} name={displayCountryName(name)} />
        ) : (
          <span key={name} className='whitespace-nowrap'>
            {displayCountryName(name)}
          </span>
        );
      })}
    </span>
  );
}

interface HomeFilterSummaryProps {
  languageLabel: string;
  countries: string[];
  qualitySetting: string;
}

/** Active language / country / quality filters, or nothing when unfiltered. */
export function HomeFilterSummary({ languageLabel, countries, qualitySetting }: HomeFilterSummaryProps) {
  if (!languageLabel && countries.length === 0 && !qualitySetting) return null;
  return (
    <span className='flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-muted-foreground'>
      {languageLabel ? <span className='min-w-0 truncate'>{languageLabel}</span> : null}
      {countries.length > 0 ? <CountryFilterFlags countries={countries} /> : null}
      {qualitySetting ? <span className='shrink-0'>{qualitySetting}</span> : null}
    </span>
  );
}
