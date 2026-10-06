# Scout style guide

RadioScout is a mobile-first radio browser. Phones get a centred 430px column; wider viewports let it grow. Everything visual is a token in `src/styles/index.css` — that file is the source of truth, and this guide describes it.

## 1. Typography

- **One family.** Poppins 300 to 700, self-hosted in `public/fonts/`, declared in `src/styles/fonts.css` with `font-display: swap`. `--font-sans` (`index.css:8`) is the only font token; there is no serif or mono token, so introducing one is a deliberate act.
- **Metric-matched fallback.** `"Poppins Fallback"` sits on `local("Arial")` with `size-adjust: 98.5%`, `ascent-override: 105%`, `descent-override: 35%`, `line-gap-override: 0%`. Without those the swap reflows the page. Keep them in step with any weight change.
- **Heading tracking is global.** The base layer puts `letter-spacing: -0.02em` on `h1` to `h4`, so don't stack `tracking-tight` on a heading.
- **Scale.** Page titles use `text-scout-title` (1.75rem). Row titles are `text-sm font-semibold`; meta lines under them are `text-xs text-muted-foreground`. Counts that must not jitter use `tabular-nums`.

## 2. Colour

- **Never hardcode a hex.** Every colour resolves through `@theme` to a variable defined on `:root`.
- **shadcn set.** `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, each with its `-foreground` pair. `destructive` always ships paired with `destructive-foreground`.
- **Flavour and scheme are orthogonal.** `<html data-flavor="…">` picks the palette; the `dark` class picks the scheme; any combination works. Four flavours ship: `gruvbox`, `nord`, `sunset`, `catppuccin`. `default` has no block of its own — it *is* the base `:root`, so a new flavour only needs its own two selectors.
- **A flavour overrides shadcn tokens only.** The `--scout-*` brand and pastel tints stay fixed across all of them, so brand art never shifts under a palette swap.
- **Surface tiers.** `surface-1`, `surface-2`, `surface-3` get darker as you go deeper in light mode and lighter in dark. Reach for these before inventing an alpha value.
- **`logo-tile` is always dark.** The Logo mark is silver, so the tile holds a dark field in every scheme and flavour. Don't reach for `bg-neutral-900`; that's what the token replaced.
- **Fixed pairs.** `scout-coal` and `scout-cream` are a dark/light pair for text on tinted surfaces and work in both modes. `scout-pine` is the readable green for text and accents; `scout-moss-deep` is the focus-ring green on tint.

## 3. Layout

- **`AppShell` is the frame.** Fog backdrop (`bg-scout-fog`) with the column on top: `max-w-107.5` (430px), widening to `lg:max-w-2xl xl:max-w-4xl`, with `sm:border-x sm:border-border`.
- **Insets are environment-driven.** The shell carries `pt-[env(safe-area-inset-top)]` and `PlayerDock` carries the bottom inset. Never hardcode a status-bar height.
- **Height is `min-h-dvh`**, not `min-h-screen`, so mobile browser chrome doesn't clip the dock.
- **`.section-container`** (`mx-auto max-w-7xl` with responsive padding) is for the wide legal and landing pages only. In-app screens stay inside the column.
- **Touch targets** are `min-h-16` (64px) for rows and `size-10` (40px) for controls.

## 4. Components

- **PascalCase filenames.** Named exports throughout; a few older components still default-export, so match the file you are editing rather than normalising on the way past.
- **`interface XProps`** for every component's props, always.
- **Conditional classes go through `cn()`** from `@/lib/utils`. Never concatenate class strings.
- **Row anatomy** (`StationCard` is the reference): an `<li>` at `min-h-16`, `rounded-3xl`, `border border-border bg-card`, with circular `size-10` controls and `size-9 rounded-xl` artwork over a `size-4` icon fallback.
- **Row targets are siblings, not an overlay.** The text column is a real `<button>` at `flex-1 min-w-0`; play and favourite sit beside it as their own buttons. Interactive elements never nest, and there's no z-index juggling to keep a large hit area.
- **Icon-only controls need `aria-label`.** Toggles additionally need `aria-pressed`.
- **`data-testid`** goes on rows and transport controls (`station-row`, `station-play`) for the Playwright specs.
- **Reorderable rows pass `animate={false}`.** A DOM move replays the mount animation, so dragged rows land plain instead of flashing.

## 5. Motion

- **Every keyframe lives in `@theme` as an `--animate-*` token**, and every one carries `animation-fill-mode: both` so a staggered delay holds its 0% state instead of popping in late.
- **`animate-scout-pop`** is the state twirl for save, vote and play icons. Transform and opacity only, so it stays on the compositor. It replays only when the icon remounts, which means a state-derived `key`: `key={favourited ? "saved" : "save"}`.
- **`animate-scout-enter`** is the mount rise for cards and rows.
- **`animate-ticker`** scrolls the dock subtitle over two identical copies, so `-50%` lands exactly one copy along. Long titles only, and only on compact widths.
- **`animate-dropdown-in`** and `animate-fade-in`** cover panels and menus.
- **Reduced motion is a list you have to join.** The `prefers-reduced-motion: reduce` block switches off `scout-enter`, `scout-pop`, `ticker`, `dropdown-in`, `.bar-swap` and `.popover-animated`. A new animation that isn't added there ships to users who asked for none.
- **`.popover-animated`** exists because Base UI keeps the popup mounted through its ending frame, so both open and close glide.

## 6. Icons

- **lucide-react**, nothing else.
- **`fill='currentColor'`** on transport and save glyphs so the active state reads as solid.
- **Sizes:** `size-4` inline in a button, `size-5` on a `size-10` control, `size-6` in empty states.
- **There is no `src/icons` directory.** Bespoke art is a decision to make, not a default to assume.

## 7. Known dead surface

Present in the stylesheet, referenced nowhere in `src`. Don't build on these; they're deletion candidates.

- `animate-pulse-glow`, the `pulseGlow` keyframe, and `--color-glow`
- `animate-draw-circle`, `animate-draw-check`, and the `draw-stroke` keyframe
- `rounded-scout-hero`, `text-scout-eyebrow`, `divider-hairline`
- The whole grid-guide layer: `.grid-zone`, `.grid-guides-layer`, `.grid-plus`, `--grid-*` (about 50 lines)

`fallow.toml` runs `css-token-drift` and `css-dead-surface` as `off`, so nothing catches this list drifting further out of date. Turning them on is a separate piece of work.

## 8. Token hygiene

- A token added to `@theme` needs a value on `:root`, a value on `.dark`, and a pair of selectors for every flavour. `tests/unit/theme-tokens.test.ts` checks the flavour blocks against the full token list and will name the one you forgot.
- Keep brand tints out of flavour blocks. They are the one thing that must not move when the palette does.