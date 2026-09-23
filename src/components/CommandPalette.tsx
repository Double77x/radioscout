import { useState, useCallback, useMemo, useRef, useEffect, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useTheme } from "next-themes";
import { Search, Command, ArrowRight, type LucideIcon } from "lucide-react";
import Fuse from "fuse.js";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { COMMAND_ACTION_THEME, COMMAND_STATIC_ITEMS } from "@/data/navigation";

interface CommandItem {
  id: string;
  title: string;
  category: "Sections" | "Legal" | "Actions" | "Links";
  to?: string;
  href?: string;
  action?: () => void;
  icon: LucideIcon;
  synonyms: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. TanStack Hotkeys registrations
  useHotkey("Mod+K", (event) => {
    event.preventDefault();
    setOpen((prev) => !prev);
  });

  // The bare "/" shortcut is intentionally not bound: Scout home owns a real
  // search field and the key must keep typing there. Mod+K stays global.

  useHotkey(
    "Escape",
    (event) => {
      event.preventDefault();
      setOpen(false);
    },
    { enabled: open },
  );

  // 2. Define searchable items — single source in data/navigation.ts
  const ALL_ITEMS: CommandItem[] = useMemo(() => {
    return [
      ...COMMAND_STATIC_ITEMS,
      {
        ...COMMAND_ACTION_THEME,
        action: () => setTheme(theme === "dark" ? "light" : "dark"),
      } as CommandItem,
    ];
  }, [theme, setTheme]);

  // 3. Initialize Fuse.js fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(ALL_ITEMS, {
        keys: [
          { name: "title", weight: 1 },
          { name: "category", weight: 0.6 },
          { name: "synonyms", weight: 0.4 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [ALL_ITEMS],
  );

  // 4. Filtered Results
  const filteredItems = useMemo(() => {
    if (!query.trim()) return ALL_ITEMS.slice(0, 7);
    const results = fuse.search(query.trim());
    return results.map((r) => r.item).slice(0, 7);
  }, [query, ALL_ITEMS, fuse]);

  // 5. Item Execution Handler
  const handleSelect = useCallback(
    (item: CommandItem) => {
      if (item.action) {
        item.action();
      } else if (item.href) {
        globalThis.open(item.href, "_blank", "noopener,noreferrer");
      } else if (item.to) {
        if (item.to.startsWith("/#")) {
          navigate({ to: "/" });
          setTimeout(() => {
            const el = document.querySelector(item.to?.replace("/", "") || "");
            el?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        } else {
          navigate({ to: item.to });
        }
      }
      setOpen(false);
      setQuery("");
    },
    [navigate],
  );

  // 6. Autocomplete Ghost Suggestion
  const suggestion = useMemo(() => {
    if (query.length < 2 || filteredItems.length === 0) return "";
    const bestMatch = filteredItems[0]?.title ?? "";
    if (bestMatch.toLowerCase().startsWith(query.toLowerCase())) {
      return bestMatch.slice(query.length);
    }
    return "";
  }, [query, filteredItems]);

  // 7. Scoped keyboard handling. onKeyDown on the popup replaces a global
  // document listener: focus is trapped in the dialog while open, so every
  // keystroke bubbles through here with no subscription to manage.
  const onPopupKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (filteredItems.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = (selectedIndex + 1) % filteredItems.length;
      setSelectedIndex(next);
      itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = (selectedIndex - 1 + filteredItems.length) % filteredItems.length;
      setSelectedIndex(next);
      itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = filteredItems[selectedIndex];
      if (item) handleSelect(item);
    } else if (event.key === "Tab" && suggestion && filteredItems[0]) {
      event.preventDefault();
      setQuery(filteredItems[0].title);
      setSelectedIndex(0);
    }
  };

  // 8. Focus the search field on open. Imperative by necessity: the dialog
  // focus trap settles after mount, so the timer (not autoFocus) wins the race.
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  // 9. Custom global event listener for navbar search button
  useEffect(() => {
    const onExternalOpen = () => setOpen(true);
    globalThis.addEventListener("open-command-palette", onExternalOpen);
    return () => {
      globalThis.removeEventListener("open-command-palette", onExternalOpen);
    };
  }, []);

  return (
    <BaseDialog.Root open={open} onOpenChange={setOpen}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className='fixed inset-0 z-200 bg-background/80 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in data-ending-style:opacity-0 data-starting-style:opacity-0' />
        <BaseDialog.Popup
          onKeyDown={onPopupKeyDown}
          className='fixed left-1/2 z-300 max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl transition duration-200 animate-in slide-in-from-top-4 zoom-in-95 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0'
          style={{ top: "15%", width: "calc(100% - 2rem)" }}>
          <BaseDialog.Title className='sr-only'>Quick Find Command Palette</BaseDialog.Title>
          <BaseDialog.Description className='sr-only'>
            Search Scout for spaces, pages, settings, and actions.
          </BaseDialog.Description>

          {/* Search Header */}
          <div className='flex items-center gap-3 border-b border-border bg-surface-1 px-4 py-3.5'>
            <Search className='size-5 text-muted-foreground' />
            <div className='relative flex-1'>
              <Input
                ref={inputRef}
                id='command-palette-search'
                className='relative z-10 h-auto w-full border-0 bg-transparent px-3 text-base font-medium tracking-tight outline-none placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-0'
                placeholder='Type a command or search...'
                aria-label='Search Scout'
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
              />
              {suggestion && (
                <div className='pointer-events-none absolute inset-0 z-0 hidden items-center overflow-hidden whitespace-nowrap md:flex'>
                  <span className='text-base font-medium tracking-tight whitespace-pre text-transparent'>{query}</span>
                  <span className='text-base font-medium tracking-tight text-muted-foreground/40'>{suggestion}</span>
                </div>
              )}
            </div>
            <kbd className='hidden rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground sm:inline-block'>
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <div className='max-h-80 overflow-y-auto p-2'>
            {filteredItems.length > 0 ? (
              <div className='flex flex-col gap-1'>
                {filteredItems.map((item, index) => {
                  const Icon = item.icon;
                  const isSelected = selectedIndex === index;
                  return (
                    <button
                      key={item.id}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      type='button'
                      data-selected={isSelected}
                      onClick={() => handleSelect(item)}
                      onMouseMove={() => {
                        if (selectedIndex !== index) setSelectedIndex(index);
                      }}
                      className={cn(
                        "group flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        isSelected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                      )}>
                      <div className='flex items-center gap-3'>
                        <div
                          className={cn(
                            "flex size-8 items-center justify-center rounded-md border transition-colors",
                            isSelected
                              ? "border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground"
                              : "border-border bg-surface-2 text-muted-foreground group-hover:text-foreground",
                          )}>
                          <Icon className='size-4' />
                        </div>
                        <div>
                          <div className='font-medium leading-none'>{item.title}</div>
                          <div
                            className={cn(
                              "mt-1 text-xs",
                              isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
                            )}>
                            {item.category}
                          </div>
                        </div>
                      </div>
                      <ArrowRight
                        className={cn(
                          "size-4 transition-transform",
                          isSelected ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0 group-hover:opacity-100",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className='py-12 text-center text-sm text-muted-foreground'>
                No matching results found for &ldquo;<span className='font-semibold text-foreground'>{query}</span>
                &rdquo;
              </div>
            )}
          </div>

          {/* Footer Navigation Hints */}
          <div className='flex items-center justify-between border-t border-border bg-surface-1 px-4 py-2.5 text-xs text-muted-foreground'>
            <div className='flex items-center gap-3'>
              <span className='flex items-center gap-1 font-mono text-xs'>
                <kbd className='rounded border border-border bg-muted px-1.5 py-0.5 font-sans'>↑</kbd>
                <kbd className='rounded border border-border bg-muted px-1.5 py-0.5 font-sans'>↓</kbd>
                Navigate
              </span>
              <span className='flex items-center gap-1 font-mono text-xs'>
                <kbd className='rounded border border-border bg-muted px-1.5 py-0.5 font-sans'>↵</kbd>
                Select
              </span>
              {suggestion && (
                <span className='hidden items-center gap-1 font-mono text-xs sm:flex'>
                  <kbd className='rounded border border-border bg-muted px-1.5 py-0.5 font-sans'>Tab</kbd>
                  Autocomplete
                </span>
              )}
            </div>
            <div className='flex items-center gap-1.5'>
              <Command className='size-3.5' />
              <span className='font-mono text-xs font-semibold tracking-wider'>SCOUT</span>
            </div>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
