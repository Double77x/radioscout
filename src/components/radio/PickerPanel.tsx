import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface PickerPanelProps<Row> {
  open: boolean;
  panelId: string;
  searchId: string;
  query: string;
  onQuery: (value: string) => void;
  searchLabel: string;
  placeholder: string;
  legend: string;
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  rowName: (row: Row) => string;
  selected: ReadonlySet<string>;
  onToggle: (name: string) => void;
  renderRow: (row: Row, active: boolean) => ReactNode;
  footer: ReactNode;
}

/**
 * Search field plus one virtualized multiselect list, shared by the language
 * and country filters. The panel is in flow (never floating) so the settings
 * popover cannot clip it, and it only renders while open.
 */
export function PickerPanel<Row>({
  open,
  panelId,
  searchId,
  query,
  onQuery,
  searchLabel,
  placeholder,
  legend,
  rows,
  rowKey,
  rowName,
  selected,
  onToggle,
  renderRow,
  footer,
}: PickerPanelProps<Row>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 8,
  });

  if (!open) return null;

  return (
    <div id={panelId} className='mt-2 animate-dropdown-in rounded-2xl border border-border bg-card p-2'>
      <div className='relative'>
        <Search
          aria-hidden='true'
          className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground'
        />
        <label htmlFor={searchId} className='sr-only'>
          {searchLabel}
        </label>
        <input
          id={searchId}
          type='search'
          autoComplete='off'
          value={query}
          onChange={(event) => {
            onQuery(event.target.value);
          }}
          placeholder={placeholder}
          className='h-10 w-full rounded-full border border-border bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden'
        />
      </div>

      <fieldset className='m-0 mt-1 min-w-0 border-0 p-0'>
        <legend className='sr-only'>{legend}</legend>
        <div ref={scrollRef} className='h-60 overflow-y-auto overscroll-contain rounded-xl'>
          {rows.length === 0 ? (
            <p className='p-3 text-xs text-muted-foreground'>Nothing matches that.</p>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
              {virtualizer.getVirtualItems().map((item) => {
                const row = rows[item.index];
                if (!row) return null;
                const name = rowName(row);
                const active = selected.has(name);
                return (
                  <button
                    key={rowKey(row)}
                    type='button'
                    aria-pressed={active}
                    onClick={() => {
                      onToggle(name);
                    }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: item.size,
                      transform: `translateY(${item.start}px)`,
                    }}
                    className={cn(
                      "flex items-center gap-2 px-2 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
                      active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}>
                    {renderRow(row, active)}
                    {active ? <Check className='size-3.5 shrink-0' /> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </fieldset>
      <p className='px-2 pt-1.5 text-xs text-muted-foreground' aria-live='polite'>
        {footer}
      </p>
    </div>
  );
}
