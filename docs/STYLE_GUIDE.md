# Scout Style Guide

Mobile-first home inventory: a centred 430px column (`AppShell`), pastel field cards, bottom tab bar. This guide keeps visuals and structure consistent.

## 1. Typography

- **Primary Font:** Self-hosted Poppins with metric-matched `Poppins Fallback` (no layout shift).
- **Headings:** `tracking-tight`, semibold — page titles use `text-scout-title`.
- **Eyebrows/labels:** `text-scout-eyebrow`, semibold, uppercase, wide tracking, often `text-muted-foreground`.

## 2. Color System (Semantic Tokens)

Themed via Tailwind v4 `@theme` in `src/styles/index.css`. **Never use hardcoded hex values in components** — use tokens.

| Token | Usage |
| :---- | :---- |
| `primary` | Mint primary actions (`--scout-mint` family). |
| `scout-pine` / `scout-moss` | Readable green text / accents; `scout-moss-deep` for focus rings on tint. |
| `scout-coal` / `scout-cream` | Fixed dark/light pair for text on tinted surfaces, both modes. |
| `scout-butter/mint/sky/lilac/blush/sage` | Pastel space tints — kept light in dark mode for contrast. |
| `secondary` | Badges, subtle fills. |
| `muted` / `muted-foreground` | Secondary text, tracks, decorative surfaces. |
| `destructive` / `destructive-foreground` | Errors, delete actions — always pair bg + foreground token (AA-safe pair). |
| `background` / `foreground` / `card` | App, text, and card surfaces. |
| `border` | Hairline borders; `border-hairline` utilities use shadow-based hairlines. |
| `ring` | `:focus-visible` rings (always paired with `focus-visible:outline-none`). |
| `glow` | Animated pulse effects. |

## 3. Standard Layouts

- **App column:** `AppShell` centres a max-430px column; pages pad `px-4`, sections stack with `mt-6`. Shell carries `pt-[env(safe-area-inset-top)]` (Android edge-to-edge, iOS notch; self-zeroes elsewhere) and `BottomNav` carries the bottom inset — never hardcode status-bar heights.
- **Cards:** `rounded-scout-card` + `border-border` + `bg-card` + `p-4`; heroes use `rounded-scout-hero`.
- **Rows:** `rounded-xl`/`rounded-2xl` list rows, `min-h-14`–`min-h-16` touch targets, text left with counts right (`tabular-nums`).
- **Bars:** Label row on top, tinted track + solid fill (`BarFill`) beneath — text never sits on two backgrounds (contrast).

## 4. Components & Naming

- **File Naming:** PascalCase for components (`SpaceCard.tsx`).
- **Exporting:** Named exports for UI components, default exports for Pages/Routes.
- **Props:** Always define an `interface` for component props.
- **Overlay pattern:** A whole row/card is one target via an absolute inset overlay link/button plus sibling action buttons (`relative z-10`) — interactive elements never nest.
- **Required fields:** `RequiredMark` (`src/components/scout/RequiredMark.tsx`) — asterisk plus sr-only "(required)".

## 5. Animation Patterns

Keyframes live in `@theme` (`--animate-*`, `animation-fill-mode: both`):

- **Entrance:** `animate-scout-enter` (rise + settle) for cards, `animate-fade-in` for panels.
- **Success draw:** `animate-draw-circle` + `animate-draw-check` (ring-then-tick stroke draw, e.g. the shopping buy button).
- **Accordion:** `.accordion-panel` height + fade (Base UI panels).
- **Press/hover:** `transition` + `hover:bg-*` fills; `cursor-grab` on swipe rows.
- **State morphs:** crossfading stacked icons (`transition-all duration-200`, rotate + scale + opacity, e.g. quick-add `+` → cart) — no animation library; both states stay real buttons with accurate `aria-label`s.
- **Sheets:** bottom sheets (`AddItemSheet`, `AddManualSheet`) share the handle + title + description header and `rounded-t-3xl` popup; open via `openAddItem()`/`openAddManual()` events, never props.

## 6. Iconography

- **Library:** Lucide React; isometric duotone set (`src/icons/isometric/`) for space cards via `SpaceGlyph` (`currentColor`, `?raw` inline).
- **Stroke Width:** 2px (default).
- **Sizes:** Inline buttons `size-4`, feature tiles `size-5`, empty states `size-6`, card glyphs `h-28 w-32`.
