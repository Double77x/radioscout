# Scout Coding Standards & Guidelines

This document outlines the strict technical standards and best practices for the Scout project. All code contributions must adhere to these principles to ensure scalability, maintainability, and performance.

## 1. Core Philosophy

- **Type Safety:** Strict TypeScript is non-negotiable. No `any`. No implicit returns. Define interfaces for all data structures.
- **Functional & Immutable:** Prefer pure functions. Avoid side effects outside of `useEffect` or event handlers.
- **Composition:** Build small, focused components and compose them to create complex UIs.

## 2. Component Acquisition Strategy

When a feature requires a new UI element (e.g., Progress Bar, Command Menu, etc.):

1. **Check Internal:** First, verify if the component already exists in `src/components/ui`.
2. **Pull from Shadcn:** If not found locally, check the [Shadcn UI library](https://ui.shadcn.com/). Pull the latest implementation into the project rather than reinventing the wheel.
3. **Modify:** Customize the downloaded Shadcn component to fit our design system and project-specific needs.
4. **Custom Implementation:** Only create niche components from scratch if no established pattern or accessible primitive exists in the community.

> **Primitive Layer (Base UI):** This project uses **Base UI (`@base-ui/react`)** as the primitive layer for all Shadcn components — not Radix UI. When pulling a new Shadcn component, rewire its primitives to the equivalent Base UI component (e.g. `@base-ui/react/accordion`, `/tabs`, `/select`). Prefer Base UI's native `render` polymorphism over the `Slot`/`asChild` pattern. Never introduce new `@radix-ui/*` dependencies.

## 3. React Architecture & State Management

### A. Server State (Data Fetching)

- **Tool:** **TanStack Query (React Query)**.
- **Rule:** NEVER use `useEffect` to fetch data.
- **Pattern:** Create custom hooks for queries (e.g., `useProjects`, `useUser`).
- **Cache Control:** Configure `staleTime` and `gcTime` appropriate for the data frequency.

### B. URL State (Source of Truth)

- **Tool:** **TanStack Router**.
- **Rule:** If a piece of state should persist on reload or be shareable (filters, search queries, active tabs, sort order), it **MUST** be stored in the URL search params.
- **Avoid:** Syncing local `useState` with URL manually. Use the router's search param validation and hooks.

### C. Derived State

- **Rule:** **Avoid `useEffect` for state synchronization.**
- **Pattern:** Calculate derived values directly in the render body or use `useMemo` if expensive.

  ```tsx
  // BAD
  const [fullName, setFullName] = useState("");
  useEffect(() => {
    setFullName(`${first} ${last}`);
  }, [first, last]);

  // GOOD
  const fullName = `${first} ${last}`;
  ```

### D. Component State

- **Tool:** `useState`, `useReducer`.
- **Scope:** Keep state collocated with where it is used. Lift state up only when necessary.

### E. Effects (Last Resort)

- **Rule:** Treat `useEffect` as a **last resort**. Before reaching for it, exhaust the modern, declarative alternatives:
  - **Document metadata / head tags** (`<title>`, `<meta>`, `<link rel="preload">`, `<link rel="stylesheet">`, canonical, Open Graph): render them in a component and let **React 19 native head hoisting** place them in `<head>`. Never duplicate them in `index.html`, and never use `useEffect` to reconcile head tags — make the runtime component the single source of truth so no duplicate exists.
  - **Data fetching:** use **TanStack Query** (never `useEffect`).
  - **URL state:** use **TanStack Router** search params.
  - **Derived values / state synchronization:** compute in the render body or use `useMemo`/`useReducer` (see C above).
- **When it is acceptable:** only for genuinely imperative, browser-integration work with no declarative API — e.g. imperative DOM/scroll/library integrations, subscriptions, or event listeners — and even then keep it minimal, scoped, and side-effect-only.

## 4. Logic Isolation & structure

### A. Directory Structure

- `src/components/ui`: Dumb, presentational components (Shadcn).
- `src/components/{feature}`: Feature-specific components.
- `src/pages`: Master page components (the entry points for routes).
- `src/data`: Static datasets, JSON files, or TS constants (e.g., FAQ data, Pricing).
- `src/hooks`: Shared logic logic that uses other hooks.
- `src/lib`: Pure utility functions (no React dependencies).
- `src/routes`: Route definitions (TanStack Router).

### B. Separation of Concerns

- **Component Isolation:** Reusable UI elements (like Breadcrumbs, Page Headers, or Cards) **MUST** be extracted into standalone components in `src/components/ui` or `src/components/{feature}`. **Do not** inline complex UI logic directly into Layouts or Pages.
- **Static Data (`src/data`):** If a component is populated by static data (FAQs, Pricing, Feature lists) that exceeds a few lines, move that data into a dedicated `.ts` or `.json` file in `src/data`. Pull this data into the component via imports. This keeps components focused on UI logic and simplifies content updates.
- **Presentational Components:** Receive data via props. No data fetching logic.
- **Container Components:** Feature-specific wrappers that handle internal state.
- **Master Pages (`src/pages`):** The top-level components for each route. They compose layouts and components.
- **Routes (`src/routes`):** **MUST** remain clean and minimal. They should only define the path and import the component from `src/pages`.
- **Lazy Loading:** All routes except the homepage (index) **MUST** use the `.lazy.tsx` pattern for automatic code splitting and performance.
- **Custom Hooks:** Encapsulate complex business logic or reusable stateful behavior.
- **Utils (`src/lib`):** Pure functions for data transformation, formatting, or validation. **Unit test these heavily.**

## 5. Routing & Navigation

- **Link Integrity:** If you modify a route path (e.g., move `/terms` to `/legal/terms`), you **MUST** immediately search the entire codebase for references to the old path (Navbars, Footers, internal links) and update them.
- **Dead Links:** Leaving dead links after a refactor is a critical failure.
- **Type-Safe Linking:** Leverage TanStack Router's type-safe `Link` component whenever possible to catch broken paths at compile time.

## 6. SEO & Metadata

- **Tool:** **React 19 Native Hoisting** (declared in `src/routes/__root.tsx` `head()`, not a static file — TanStack Start has no `index.html`).
- **Hybrid Strategy:**
  - **Static Defaults (`__root.tsx` head):** MUST contain baseline "fail-safe" metadata (brand title, fallback description, viewport + `viewport-fit=cover`, theme-colors, and PWA tags).
  - **Dynamic Overrides (`SEO` Component):** Every page MUST use the `<SEO />` component to provide route-specific overrides. React 19 automatically hoists `<title>`, `<meta>`, and `<link>` tags to the `<head>`.
- **Requirement:** Every page (including "legal" pages) **MUST** have a dedicated `<SEO />` block.
- **Specifics:** Do not rely on default values for everything. Provide page-specific:
  - `title`: Unique title for the page.
  - `description`: Custom meta description relevant to the page content.
  - `keywords`: Targeted keywords for that specific topic.
- **JSON-LD:** Ensure the main SEO component handles structured data generation correctly for search engines.

## 7. Performance Optimization

- **Memoization:**
  - Use `useMemo` for expensive calculations (filtering large lists, transforming complex datasets).
  - Use `React.memo` for components that render often with the same props (e.g., items in a large grid/list).
  - Use `useCallback` for functions passed as props to memoized children.
- **Code Splitting:**
  - Leverage Lazy Loading for routes (already implemented via `.lazy.tsx` pattern).
  - Defer loading of heavy non-critical components. Anything above the fold on the homepage shouldn't be lazy loaded for user experience.
- **Compression:**
  - **Do NOT pre-compress** assets with `.gz`/`.br` files. This project deploys to Cloudflare (Pages/Workers), which applies gzip/brotli compression automatically at the edge. Pre-compressed files are redundant and add build output noise.
- **Virtualization (`@tanstack/react-virtual`):**
  - **When to use:** only for genuinely large, uniform lists where naive rendering of all rows is measurably slow — data grids with hundreds/thousands of rows, or dropdowns with hundreds/thousands of options. Do **not** virtualize small lists or layouts that rely on all children being mounted; the DOM is fine up to ~1,000 simple nodes.
  - **Base UI Select vs Combobox:** **`Select` cannot be safely virtualized** with `@tanstack/react-virtual` — keyboard navigation breaks past the virtual window because Base UI Select builds its options array from rendered children (see mui/base-ui#2282). Use the plain Select for small lists.
  - **CLS / shift safety contract** (fixed row heights + `estimateSize`, total-height spacer, stable keys, shared grid tracks between sticky headers and rows):
    - **Fixed row heights + `estimateSize`** — never `measureElement`; measured sizes cause scroll jitter as rows stream in.
    - **Total-height spacer** (`getTotalSize()`) so the scrollbar extent never collapses/expands while scrolling.
    - **Stable item keys by index** (`getItemKey: (i) => i`) so typing into a virtualized cell doesn't remount/lose focus.
    - **Header/rows share identical grid tracks** — use a CSS-grid layout with the same `grid-template-columns` between a `sticky top-0` header and virtual rows. **Never** put virtualized absolutely-positioned `<tr>` rows inside an HTML `<table>`: column widths drift away from a sticky header.
    - **Only opt in above a threshold** — below it, render everything in normal flow (identical to non-virtualized behaviour).

## 8. Error Handling

- **No Bare Excepts:** NEVER write an empty `catch` block.
- **Handling:**
  - **API Errors:** Handle gracefully in UI (toast notifications, error states).
  - **Critical Errors:** Use Error Boundaries to prevent full app crashes.
  - **Logging:** Log errors to console (or monitoring service) with context.

## 9. Testing Strategy

- **Tool:** **Vitest**.
- **Focus:**
  - **Unit Tests:** Critical for `src/lib` utilities and complex `src/hooks`. logic.
  - **Integration Tests:** Test critical user flows (e.g., "User can upload image and generate SVG").
- **Components:** Test for accessibility and interaction, not implementation details.

## 10. Styling (Tailwind + Shadcn)

- **Tailwind V4 Standards:** As this project uses Tailwind V4, always use **canonical equivalents** if a standard utility exists within the design system.
- **Tokens:** Use Shadcn CSS variables (`bg-primary`, `text-muted-foreground`) for all styling to ensure theme compatibility (Light/Dark mode).
- **Consistency:** Avoid arbitrary values (e.g., `w-[123px]`). Use standard Tailwind spacing scale and design system tokens.
- **ClassName Merging:** Always use `cn()` utility to allow prop overrides.

## 11. Responsive Design & Layout

- **Mobile-First Approach:** Always start with base classes for mobile devices. Use responsive prefixes (`md:`, `lg:`, etc.) to enhance the layout for larger screens.
- **Fluidity & Flexbox/Grid:** Favor `flex` and `grid` over fixed positioning or hardcoded widths. Use `w-full` with `max-w-` constraints to ensure components look good on ultra-wide monitors and small phones alike.
- **Multi-Device Target:**
  - **Tablets:** Pay special attention to the `md` (768px) and `lg` (1024px) breakpoints. Small tablets (iPad Mini) and large tablets (iPad Pro) often fall between standard desktop and mobile layouts.
  - **Small Laptops:** Ensure toolbars and sidebars don't feel cramped on 13" screens (typically around 1280px).
- **Breakpoint Awareness:**
  - Use `hidden md:block` or `flex-col lg:flex-row` patterns to manage complexity on smaller viewports.
  - If a component feels "broken" at a specific width, consider using a more granular Tailwind breakpoint or a custom fluid utility.
- **No Horizontal Scrolling:** Ensure that content never forces a horizontal scrollbar on the main viewport. Use `overflow-x-auto` strictly for targeted elements like data tables or code blocks.

## 12. Semantic Tokenization

- **Canonical Utilities:** Prioritize native Tailwind V4 features and theme tokens over custom utilities or magic components.
- **Avoid Hardcoded Colors:** Never use hex codes like `#3b82f6` in Tailwind classes. Use semantic tokens like `text-primary`, `bg-muted`, or `border-border`.
- **Token Creation:** If a specific color or pattern is reused frequently (e.g., a "Glow" effect), add a new CSS variable to `src/styles/index.css`. A new token needs a value on `:root`, a value on `.dark`, and a pair of selectors for every flavour, or it will render with whatever the previous theme left behind. `tests/unit/theme-tokens.test.ts` names the one you missed.
- **Utility Classes:** Prefer standard Tailwind utilities. Only create "magic" classes in `@layer components` for extremely complex patterns.

## 13. Iconography

- **Standard:** Use **Lucide React** exclusively.
- **Consistency:** Maintain consistent stroke widths (`strokeWidth={2}`) and sizes (`w-4 h-4` for inline, `w-5 h-5` for standard buttons).

## 14. Data Integrity & Validation

- **Tool:** **Zod**.
- **Rule:** Any data entering the system from an untrusted source (User Input, URL Params, File Uploads) **MUST** be validated with a Zod schema.

## 15. AI Agent Protocol

- **Context First:** Read every file in `docs/standards/` before any task — `CODING_STANDARDS.md` (this file), `STYLE_GUIDE.md`, `TECH_STACK.md` and `ARCHITECTURE.md`. `AGENTS.md` lists them and `scripts/check-doc-pointers.js` fails the build if a standard is added without appearing there. The rest of `docs/` is on demand: `docs/README.md` is the map, a module's own file header points at its contract, and `docs/lineage.md` answers *why* something is the way it is.
- **Adherence:** Strictly follow the standards defined in `CODING_STANDARDS.md`.
- **Memory:** Update `ROADMAP.md` or `ARCHITECTURE.md` if you make significant structural changes.

### Standing prohibitions

In force now, not history. Each exists because breaking it causes damage that is hard to notice afterwards. Every one of these was buried in a dated `AGENTS.md` entry, which is why they live here.

- **Never run `git sparse-checkout` in this app checkout.** It hides tracked files behind skip-worktree while `git status` still looks clean, so the damage survives into the next command. Clone fdroidserver separately. (`docs/plans/FDROID_PLAN.md`)
- **Never enable `includePrereleases` on the Obtainium config.** `fdroid-reference.yml` marks its reference APK `prerelease: true`, so the default `includePrereleases: false` is the only thing keeping that flavor from reaching a sideload user. (`docs/plans/OBTAINIUM_PLAN.md` §4.2, and the comment at the `--prerelease` line in `scripts/publish-ota.mjs`)
- **Never gate the `isDdgPlaceholder` test on `stage`.** A cached instant decode resolves before React registers its listeners, and an HTTP-cache hit can serve the decoded placeholder to the wsrv attempt without any event firing, so a `stage` guard passes while the row still shows the placeholder. (`docs/lineage.md`, 2026-10-04)
- **Do not let the native playlist read gate the web play chain.** IndexedDB stalls under the mocked timers the unit tests use, so building the playlist inline breaks the web path. (`docs/lineage.md`, 2026-10-02)

### Verification traps

Signals that look conclusive and are not. Each has already produced a wrong conclusion once.

- **`url_resolved` cannot prove TLS.** It carries the same `http://` the browser later upgrades, so the column says nothing about whether https works. Load a candidate's https variant directly before adding its exact host to `HTTPS_UPGRADE_HOSTS`. (`docs/lineage.md`, 2026-09-23)
- **A 200 is not enough to allowlist a host — check the playlist body.** `HTTPS_UPGRADE_HOSTS` entries must serve a *media* playlist whose segment lines are **relative**, so the upgrade carries to the segments. A host serving a *master* playlist whose variants are absolute `http://` URLs must stay out: the upgrade stops at the master, the demuxer follows its body to http variants, and every variant and segment logs a mixed-content warning. `a.files.bbci.co.uk` is that shape (BBC Afrique, BBC Arabic Radio). (`docs/lineage.md`, 2026-10-06)
- **Check the deployed `_headers`, not `public/_headers`.** `public/_headers` is the source, but `scripts/apply-header-policy.js` post-processes the copy in `dist/client`, and a build whose `publicDir` copy is served from cache can leave the previous build's file in place. A CSP edit can therefore build cleanly, show up in git, and never reach the artifact. After changing `_headers`, read `dist/client/_headers`. (`docs/lineage.md`, 2026-10-06)
- **`connect-src https:` does not cover `wss:`.** CSP scheme matching widens `http:` to `https:` and `ws:` to `wss:`, never `https:` to `wss:` — a WebSocket needs its own scheme source, and `CODING_STANDARDS.md` §21 applies to sockets as much as fetches. (`docs/lineage.md`, 2026-10-06)
- **Never pair `aria-hidden` with `inert` on one subtree.** React commits both in the same pass, so `aria-hidden` lands while the panel's own control still holds focus and the browser refuses the attribute (the element stays exposed and Chrome logs a warning). `inert` alone already removes the subtree from the a11y tree. Focus still has to be moved off the panel before it goes `inert` or a keyboard user lands on `<body>`. (`docs/lineage.md`, 2026-10-06)
- **`Cache-Control` alone does not prove an edge cache hit.** Pages Function responses are not edge-cached by that header on its own, and a deterministic error body reads the same whether it was re-probed or served from cache. Compare full bodies (identical `at` field) plus MISS/HIT timings. (`docs/lineage.md`, 2026-10-01)
- **Regenerating icons churns the committed favicon and PNGs.** The committed assets predate `scripts/generate-icons.mjs`, so a regen produces a large unrelated diff. Run `node scripts/generate-icons.mjs`, then `pnpm cap:assets`, then revert the favicon/PNG churn. (`docs/lineage.md`, 2026-09-20)
- **Set `npm_config_manage_package_manager_versions=false` for local pnpm invocations.** `packageManager` pins 12.8.1, which is newer than `minimumReleaseAge` (10080 minutes), so a bare `pnpm` self-installs a different version. (`docs/lineage.md`, 2026-09-30)

## 16. Tool & MCP Usage

- **Leverage Resources:** Actively check for and use available MCP servers and Skills (`<available_skills>`) if they can assist with the current task (e.g., retrieving documentation, linting, or checking best practices).
- **Graceful Failure:**
  - If a tool call hangs for an extended period, **cancel it** to preserve context window and time.
  - **Timeout Policy:** If a specific tool times out or fails repeatedly, **do not use it again** for the remainder of the session. Fall back to manual methods or alternative tools.

## 17. Verification & Quality Control

- **Small Changes (Components/Logic):**
  - Perform a targeted lint check on all modified files using `lint-files`.
- **Large Features or Overhauls:**
  - **Linting:** Run a full project lint using `pnpm run lint` or `npx oxlint .`.
  - **Type Checking:** Run a full type check using `npx tsc -b`.
  - **Build Check:** Run `pnpm run build` to ensure the Vite build completes without errors.
  - **Dead Code & Health:** Run `npx fallow audit --format json --quiet` (or `fallow dead-code`/`fallow health`) to identify dead code, duplication, and complexity hotspots. For agents/scripts, handle exit codes: `0` = clean, `1` = findings (success), `2` = real error (JSON envelope on stdout). Always use `2>/dev/null` (or `2>$null` on pwsh) to silence progress on stderr.
  - **Tests:** Run `pnpm run test:unit` (vitest) and `pnpm test` (playwright) as appropriate.
- **Fail First:** If any verification step fails, the task is not considered complete until the issue is resolved.

## 18. Accessibility (A11y)

- **Semantic HTML:** Use correct HTML elements for their intended purpose (e.g., `<button>` for actions, `<a>` for navigation).
- **ARIA Labels:**
  - Any element without a clear text label (e.g., icon-only buttons) **MUST** have an `aria-label` or `title`.
  - Use `aria-describedby` for supplementary information or error messages.
- **Forms & Inputs:**
  - All form fields must be associated with a `<label>`.
  - Use `aria-invalid` and `aria-required` where appropriate.
- **Keyboard Navigation:** Ensure all interactive elements are focusable and have a visible focus state.
- **Color Contrast:** Ensure text meets WCAG AA standards against its background.

## 19. Dead Code, Duplication & Architecture Hygiene (Fallow)

- **Standard Tool:** Use **Fallow** (`npx fallow dead-code`, `npx fallow dupes`, `npx fallow health`, `npx fallow audit --format json --quiet`) to maintain a clean codebase. Config lives in `fallow.toml` (migrated from `knip.ts`).
- **False Positive Awareness:**
  - **BE CAREFUL:** Fallow (like knip) can report false positives for dependencies used strictly in CSS (`tailwindcss-animate` via `@import` in `src/styles/index.css`), config-only plugins (`react-doctor`/`eslint-plugin-react-doctor` via `.oxlintrc.json` `jsPlugins`), or dynamically generated routes.
  - **Verification:** Before deleting any file or dependency flagged by Fallow, **manually search the codebase** for references (especially in `*.css`, `tailwind.config.*`, `vite.config.ts`, or `oxlint` configs) and use `fallow dead-code --trace <file>:<export>` or `--trace-dependency <name>` to verify.
    - **Ignore List:** If a tool/dependency is confirmed as necessary but flagged, add it to `ignoreDependencies` or `ignorePatterns` in `fallow.toml` (e.g., `tailwindcss-animate`, `@tanstack/react-query` kept for future use, `tailwindcss` build-time via `@tailwindcss/vite`, `react-doctor` via oxlint). See `fallow.toml:6` for current ignores and https://docs.fallow.tools/migration/from-knip.
  - **Agentic Workflow:** For AI agents and scripts, run `npx fallow audit --format json --quiet 2>/dev/null` and treat exit `0`/`1` as success (`1` = findings), `2` as real error (JSON envelope on stdout). Use `fallow` as the tidy gate before commit/PR (`fallow audit`), for refactoring prioritization (`fallow health --hotspots`), and for guard checks (`fallow guard <files>`).
  - **Regression Baseline:** CI uses embedded `regression.baseline` in `fallow.toml` (populated via `npx fallow --save-regression-baseline`). Run with `--fail-on-regression` to block count increases. Keep Fallow as part of the agentic process to keep the codebase tidy — run `audit` after each feature, and `dead-code --trace` before deleting any flagged export/file.

## 20. Layout Abstraction
  - **DRY Layouts:** If multiple pages share the same structural pattern (e.g., Header + Sidebar + Content), do not rebuild the layout in each page.
  - **Master Layouts:** Build a master layout component in the `src/components/layout` folder.
  - **Implementation:** Master layouts should use React props (like `children` or specific slots) to allow pages to inject their own content while keeping the container logic centralized.
  - **Example:** Refer to `LegalLayout.tsx` for the established standard on how to abstract complex, shared UI structures in this project.

## 21. Security & CSP Headers

- **CSP Maintenance:** Always maintain a robust Content Security Policy (CSP) to prevent XSS and data injection attacks.
- **Balance:** Strike a balance between strict security and production stability. Avoid over-restrictive policies that break critical third-party integrations (e.g., Google Fonts, analytics, or CDN-hosted assets).
- **Header Location:** CSP headers and other security policies are managed in `public/_headers` (for platforms like Cloudflare/Netlify).
- **Conflict Resolution:**
  - When adding a new feature that requires external resources (e.g., a new analytics tool or external API), you **MUST** audit and update the `public/_headers` file.
  - Resolve conflicts by adding the necessary domain to the relevant directive (e.g., `connect-src` or `img-src`) rather than using broad wildcards.
- **Verification:** Before deploying CSP changes, ensure:
  - Inline scripts (like the theme toggle script in `index.html`) are properly allowed via hashes or nonces.
  - `style-src` is compatible with our theme-switching mechanism and any external font CDNs.

## 22. Font Self-Hosting & Preloading

- **Self-Hosting Required:** All fonts used in the project **MUST** be self-hosted. Do not link to external font CDNs (like Google Fonts) in production.
- **Benefits:** This improves LCP (Largest Contentful Paint), removes critical request chains, and ensures full GDPR compliance by not leaking user IP addresses to third-party CDNs.
- **Directory:** Font files (WOFF2 preferred) should be stored in `public/fonts/`.
- **Implementation:**
  - `@font-face` rules live in `src/styles/fonts.css`, weights 300 to 700, each with `font-display: swap`.
  - A metric-matched fallback follows them (`Poppins Fallback` on `local("Arial")`, `size-adjust: 98.5%`, `ascent-override: 105%`, `descent-override: 35%`, `line-gap-override: 0%`). Without those overrides the swap reflows the page.
  - Both stylesheets are imported in `src/routes/__root.tsx` with `?url` and passed to `Route.head` as stylesheet links. A side-effect `import "@/styles/index.css"` is treated as an async client chunk rather than a render-blocking resource, which costs a flash of unstyled text.
- **Preloading:** Critical font weights (e.g., Regular 400 and Bold 700) **MUST** be preloaded via `Route.head` `<link rel="preload">` to prevent FOUT (Flash of Unstyled Text).

## 23. Import Conventions

- **Path Aliases:** Always use the path aliases defined in the project configuration (`tsconfig.json` and `vite.config.ts`).
- **Standard Alias:** Use the `@/` prefix to refer to the `src` directory (e.g., `import { Button } from "@/components/ui/button"`).
- **Benefits:** This avoids deep relative paths (`../../../../`) and makes refactoring significantly easier.
- **Consistency:** Use the alias for all imports that are not in the same directory.

## 24. Comments and Documentation

- **A comment states a constraint, not a history.** Keep it if deleting it would make a competent agent choose wrongly: an ordering requirement, an invariant, a platform split, the reason the obvious approach does not work here. Drop it if it only explains how the code arrived at its current shape.
- **No archaeology in code.** No dates, no "before this worked", no incident write-ups, no measurements of the bug that prompted the line. Present tense only. A comment that needs a past tense belongs in a plan.
- **One home per why.** State a verdict in exactly one place and point at it from everywhere else. Duplication is what lets documentation end up contradicting itself, which is the only failure mode worth designing against here.
- **Long prose does not live in a docblock.** A module-level block much over ten lines is a document, so it belongs in `docs/modules/` with a pointer left in the header. A docblock that annotates no declaration is a module map in the wrong format; move it.
- **Where each kind of writing goes:**
  - **TSDoc on an export** is the contract for its caller. Short, present tense, and it never restates the module doc.
  - **`docs/modules/`** holds per-module contracts in present tense. The path mirrors `src/`, so `src/lib/player/engine.ts` is documented by `modules/player/engine.md`. A module doc that starts needing a History section is telling you the content belongs in `plans/`, so link out.
  - **`docs/plans/`** holds dated decision records. These are append-only: add entries, never edit them. That is exactly what makes them safe, because a record nobody rewrites cannot end up contradicting the code it describes.
  - **`AGENTS.md`** is the one-line index into all of the above.
- **Pointers must resolve.** Every path a source file names has to exist, every module doc has to be reachable from a source header or from `docs/README.md`, and every document has to be named by the index. `scripts/check-doc-pointers.js` runs all three in the build chain, so a moved doc fails the build instead of quietly rotting.

### When you change code

The rules above cover what to write. This covers what to update, which is the half that goes stale.

| Your change | Also do this |
| :---- | :---- |
| Behaviour a module doc describes | Update that doc in the same change. A doc that outlives its code is worse than none |
| A decision — a trade-off made, an approach rejected | Append a `docs/lineage.md` entry and an index line in `AGENTS.md` |
| A constraint future work must respect | Promote it to §15. If it can damage the repo, it does not belong in history |
| A dependency or its version | `standards/TECH_STACK.md` |
| A design token or layout rule | `standards/STYLE_GUIDE.md` |
| A subsystem boundary or the shape of the app | `standards/ARCHITECTURE.md` |
| None of the above | Nothing. Most changes touch no document |

- **The module doc is authoritative for current behaviour; `lineage.md` is authoritative for what was decided and when.** When they disagree, the code is right, the module doc wins, and lineage gets a correction.
- **Never edit a lineage entry.** Append a correction that names the date it supersedes and says which part was wrong. That is the only thing that makes an append-only log worth trusting.
- **A decision that constrains future work is a rule, not a record.** Standing prohibitions and verification traps live in §15 precisely so they cannot be lost by not opening `lineage.md`.
- **If you find a document that is already wrong and your change did not cause it, fix it or say so.** Do not leave it for the next reader to trip over.

The gates are structural: they check that pointers resolve, that documents are indexed and that sizes stay bounded. None of them can tell that prose has stopped matching the code. Accuracy here is procedural, which is the point of writing it down.
