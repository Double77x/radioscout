import { Fragment, useId, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  id: T;
  label: ReactNode;
  /** Spoken name when the visible label is terse ("128+" → "128 kbps+"). */
  ariaLabel?: string;
}

/**
 * Sliding-pill radio group. Native inputs own the checked state (arrow keys
 * work out of the box); `--active-index` is set from React state so the
 * ::before pill glides with no DOM measuring. Styles live in
 * `src/styles/index.css` (`.scout-segmented`).
 */
export function SegmentedControl<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  density = "comfortable",
  optionClassName,
  className,
}: {
  /** Screen-reader group label. */
  label: string;
  /** Radio group name (auto-generated when omitted). */
  name?: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Compact pills match the older min-h-7 toggles. */
  density?: "comfortable" | "compact";
  /** Extra label classes (e.g. stacked icon-over-text options). */
  optionClassName?: string;
  className?: string;
}) {
  const autoId = useId();
  const group = name ?? `segmented-${autoId}`;
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );
  return (
    <fieldset
      className={cn("scout-segmented", className)}
      style={
        {
          "--active-index": activeIndex,
          "--segment-count": options.length,
          "--segment-height": density === "compact" ? "1.75rem" : "2.25rem",
        } as CSSProperties
      }>
      <legend className='sr-only'>{label}</legend>
      {options.map((option) => {
        const id = `${group}-${option.id}`;
        return (
          <Fragment key={option.id}>
            <input
              id={id}
              name={group}
              type='radio'
              aria-label={option.ariaLabel}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            <label htmlFor={id} className={optionClassName}>
              {option.label}
            </label>
          </Fragment>
        );
      })}
    </fieldset>
  );
}
