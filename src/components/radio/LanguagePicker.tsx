import { useId, useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { CountryFlag } from "@/components/radio/CountryFlag";
import { PickerPanel } from "@/components/radio/PickerPanel";
import { useIsClient } from "@/hooks/use-is-client";
import { usePersistentStrings } from "@/hooks/use-persistent-state";
import { LANGUAGES_KEY } from "@/lib/radio/languages";
import { POPULAR_LANGUAGES } from "@/lib/radio/language-popular";
import type { DirectoryLanguage } from "@/lib/radio/language-all";
import { cn } from "@/lib/utils";

/** Full directory lazy-loads on first open — never in the initial bundle. */
const loadDirectory = () => import("@/lib/radio/language-all");
/** Query client stays out of the initial bundle — loaded on demand. */
const loadQueryClient = () => import("@/lib/query-client");

/** Stable fallback for the persisted hook (referential stability matters). */
const WORLDWIDE: string[] = [];

/** Curated flag per language name; selections outside the popular 40 show name-only. */
const FLAG_BY_LANGUAGE = new Map(POPULAR_LANGUAGES.map((lang) => [lang.name, lang.flag] as const));

interface LanguageRow {
  name: string;
  code: string;
  /** flag-icons country code; "" renders a code pill. */
  flag: string;
}

function toggleMembership(current: string[], name: string): string[] {
  return current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name];
}

function matchesQuery(name: string, code: string, query: string): boolean {
  return name.includes(query) || (code !== "" && code.startsWith(query));
}

/** Flag inside a selected chip — curated languages only, never guessed. */
function SelectedFlag({ name }: { name: string }) {
  const flag = FLAG_BY_LANGUAGE.get(name);
  if (!flag) return null;
  return <CountryFlag code={flag} name={name} />;
}

/** Flag for curated rows, code pill otherwise (never guess flags from ISO 639). */
function LangBadge({ flag, code, name }: { flag: string; code: string; name: string }) {
  if (flag !== "") return <CountryFlag code={flag} name={name} />;
  if (code === "") return null;
  return (
    <span
      aria-hidden='true'
      className='inline-block shrink-0 rounded-sm bg-muted px-1 py-px text-xs font-bold tracking-wide text-muted-foreground uppercase'>
      {code}
    </span>
  );
}

/**
 * Language filter dropdown for Settings. Collapsed trigger with the current
 * selection; expanding reveals search + one virtualized multiselect list
 * (popular 40 pinned first, full 624-row directory behind). In-flow rather
 * than floating so the settings popover never clips it. Client-gated: the
 * virtualizer measures DOM and must never run during SSG prerender.
 */
export function LanguagePicker() {
  const isClient = useIsClient();
  const [languages, setLanguages] = usePersistentStrings(LANGUAGES_KEY, WORLDWIDE);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [directory, setDirectory] = useState<DirectoryLanguage[] | null>(null);
  const searchId = useId();
  const panelId = useId();

  const select = (next: string[]) => {
    setLanguages(next);
    // Keys already carry the languages, but favour instant consistency.
    void loadQueryClient().then(({ queryClient }) => queryClient.invalidateQueries({ queryKey: ["radio"] }));
  };

  const ensureDirectory = () => {
    if (directory !== null) return;
    void loadDirectory().then((mod) => {
      setDirectory(mod.DIRECTORY_LANGUAGES);
    });
  };

  const toggleOpen = () => {
    setOpen((prev) => {
      if (prev) setQuery("");
      return !prev;
    });
  };

  // Typing searches the whole directory — pull it in on first keystroke.
  // Idle shows the popular 40 only; the 624-row chunk never loads otherwise.
  const onQuery = (value: string) => {
    setQuery(value);
    if (value.trim() !== "") ensureDirectory();
  };

  const trimmed = query.trim().toLowerCase();
  const selected = useMemo(() => new Set(languages), [languages]);
  const popularNames = useMemo(() => new Set(POPULAR_LANGUAGES.map((lang) => lang.name)), []);
  const rows = useMemo<LanguageRow[]>(() => {
    const popular: LanguageRow[] = POPULAR_LANGUAGES.filter(
      (lang) => trimmed === "" || matchesQuery(lang.name, lang.code, trimmed),
    );
    // Idle: popular 40 only. The full directory joins in for searches.
    if (trimmed === "" || directory === null) return popular;
    const rest: LanguageRow[] = directory.flatMap((lang) =>
      popularNames.has(lang.name) || !matchesQuery(lang.name, lang.code, trimmed)
        ? []
        : [{ name: lang.name, code: lang.code, flag: "" }],
    );
    return [...popular, ...rest];
  }, [directory, popularNames, trimmed]);

  if (!isClient) {
    return <div aria-hidden='true' className='h-24 animate-pulse rounded-2xl bg-muted' />;
  }

  const summary =
    languages.length === 0
      ? "Worldwide — all languages"
      : languages.length === 1
        ? (languages[0] ?? "")
        : `${languages[0]} +${languages.length - 1}`;

  return (
    <div>
      {languages.length > 0 ? (
        <ul aria-label='Selected languages' className='flex flex-wrap gap-1.5'>
          {languages.map((name) => (
            <li key={name}>
              <button
                type='button'
                aria-label={`Remove ${name}`}
                onClick={() => {
                  select(toggleMembership(languages, name));
                }}
                className='flex min-h-9 items-center gap-1.5 rounded-full bg-scout-ink pr-2.5 pl-3 text-xs font-semibold text-scout-paper transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                <SelectedFlag name={name} />
                <span className='capitalize'>{name}</span>
                <X className='size-3.5' />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type='button'
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          languages.length > 0 ? "mt-2 w-full" : "w-full",
        )}>
        <span className='min-w-0 flex-1 truncate text-left font-medium capitalize'>
          {languages.length === 0 ? "Worldwide — all languages" : summary}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      <PickerPanel
        open={open}
        panelId={panelId}
        searchId={searchId}
        query={query}
        onQuery={onQuery}
        searchLabel='Search languages'
        placeholder='Search 600+ languages…'
        legend='Choose languages'
        rows={rows}
        rowKey={(lang) => lang.name}
        rowName={(lang) => lang.name}
        selected={selected}
        onToggle={(name) => {
          select(toggleMembership(languages, name));
        }}
        renderRow={(lang) => (
          <>
            <LangBadge flag={lang.flag} code={lang.code} name={lang.name} />
            <span className='min-w-0 flex-1 truncate capitalize'>{lang.name}</span>
          </>
        )}
        footer={
          trimmed === ""
            ? "Top 40 — type to search 600+ languages"
            : directory === null
              ? "Searching the full directory…"
              : `${rows.length} match${rows.length === 1 ? "" : "es"}`
        }
      />
    </div>
  );
}
