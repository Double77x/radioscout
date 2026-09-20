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

## 7. Testing Strategy

- **Tool:** **Vitest**.
- **Focus:**
  - **Unit Tests:** Critical for `src/lib` utilities and complex `src/hooks`. logic.
  - **Integration Tests:** Test critical user flows (e.g., "User can upload image and generate SVG").
- **Components:** Test for accessibility and interaction, not implementation details.

## 8. Styling (Tailwind + Shadcn)

- **Tailwind V4 Standards:** As this project uses Tailwind V4, always use **canonical equivalents** if a standard utility exists within the design system.
- **Tokens:** Use Shadcn CSS variables (`bg-primary`, `text-muted-foreground`) for all styling to ensure theme compatibility (Light/Dark mode).
- **Consistency:** Avoid arbitrary values (e.g., `w-[123px]`). Use standard Tailwind spacing scale and design system tokens.
- **ClassName Merging:** Always use `cn()` utility to allow prop overrides.

## 9. Responsive Design & Layout

- **Mobile-First Approach:** Always start with base classes for mobile devices. Use responsive prefixes (`md:`, `lg:`, etc.) to enhance the layout for larger screens.
- **Fluidity & Flexbox/Grid:** Favor `flex` and `grid` over fixed positioning or hardcoded widths. Use `w-full` with `max-w-` constraints to ensure components look good on ultra-wide monitors and small phones alike.
- **Multi-Device Target:**
  - **Tablets:** Pay special attention to the `md` (768px) and `lg` (1024px) breakpoints. Small tablets (iPad Mini) and large tablets (iPad Pro) often fall between standard desktop and mobile layouts.
  - **Small Laptops:** Ensure toolbars and sidebars don't feel cramped on 13" screens (typically around 1280px).
- **Breakpoint Awareness:**
  - Use `hidden md:block` or `flex-col lg:flex-row` patterns to manage complexity on smaller viewports.
  - If a component feels "broken" at a specific width, consider using a more granular Tailwind breakpoint or a custom fluid utility.
- **No Horizontal Scrolling:** Ensure that content never forces a horizontal scrollbar on the main viewport. Use `overflow-x-auto` strictly for targeted elements like data tables or code blocks.

## 10. Semantic Tokenization

- **Canonical Utilities:** Prioritize native Tailwind V4 features and theme tokens over custom utilities or magic components.
- **Avoid Hardcoded Colors:** Never use hex codes like `#3b82f6` in Tailwind classes. Use semantic tokens like `text-primary`, `bg-muted`, or `border-border`.
- **Token Creation:** If a specific color or pattern is reused frequently (e.g., a "Glow" effect), add a new CSS variable to `src/index.css`.
- **Utility Classes:** Prefer standard Tailwind utilities. Only create "magic" classes in `@layer components` for extremely complex patterns.

## 11. Iconography

- **Standard:** Use **Lucide React** exclusively.
- **Consistency:** Maintain consistent stroke widths (`strokeWidth={2}`) and sizes (`w-4 h-4` for inline, `w-5 h-5` for standard buttons).

## 12. Data Integrity & Validation

- **Tool:** **Zod**.
- **Rule:** Any data entering the system from an untrusted source (User Input, URL Params, File Uploads) **MUST** be validated with a Zod schema.

## 13. AI Agent Protocol

- **Context First:** Before starting any task, read all files in the `docs/` folder.
- **Adherence:** Strictly follow the standards defined in `CODING_STANDARDS.md`.
- **Memory:** Update `ROADMAP.md` or `ARCHITECTURE.md` if you make significant structural changes.

## 14. Tool & MCP Usage

- **Leverage Resources:** Actively check for and use available MCP servers and Skills (`<available_skills>`) if they can assist with the current task (e.g., retrieving documentation, linting, or checking best practices).
- **Graceful Failure:**
  - If a tool call hangs for an extended period, **cancel it** to preserve context window and time.
  - **Timeout Policy:** If a specific tool times out or fails repeatedly, **do not use it again** for the remainder of the session. Fall back to manual methods or alternative tools.

## 15. Verification & Quality Control

- **Small Changes (Components/Logic):**
  - Perform a targeted lint check on all modified files using `lint-files`.
- **Large Features or Overhauls:**
  - **Linting:** Run a full project lint using `pnpm run lint` or `npx oxlint .`.
  - **Type Checking:** Run a full type check using `npx tsc -b`.
  - **Build Check:** Run `pnpm run build` to ensure the Vite build completes without errors.
  - **Dead Code & Health:** Run `npx fallow audit --format json --quiet` (or `fallow dead-code`/`fallow health`) to identify dead code, duplication, and complexity hotspots. For agents/scripts, handle exit codes: `0` = clean, `1` = findings (success), `2` = real error (JSON envelope on stdout). Always use `2>/dev/null` (or `2>$null` on pwsh) to silence progress on stderr.
  - **Tests:** Run `pnpm run test:unit` (vitest) and `pnpm test` (playwright) as appropriate.
- **Fail First:** If any verification step fails, the task is not considered complete until the issue is resolved.

## 16. Accessibility (A11y)

- **Semantic HTML:** Use correct HTML elements for their intended purpose (e.g., `<button>` for actions, `<a>` for navigation).
- **ARIA Labels:**
  - Any element without a clear text label (e.g., icon-only buttons) **MUST** have an `aria-label` or `title`.
  - Use `aria-describedby` for supplementary information or error messages.
- **Forms & Inputs:**
  - All form fields must be associated with a `<label>`.
  - Use `aria-invalid` and `aria-required` where appropriate.
- **Keyboard Navigation:** Ensure all interactive elements are focusable and have a visible focus state.
- **Color Contrast:** Ensure text meets WCAG AA standards against its background.

## 17. Dead Code, Duplication & Architecture Hygiene (Fallow)

- **Standard Tool:** Use **Fallow** (`npx fallow dead-code`, `npx fallow dupes`, `npx fallow health`, `npx fallow audit --format json --quiet`) to maintain a clean codebase. Config lives in `fallow.toml` (migrated from `knip.ts`).
- **False Positive Awareness:**
  - **BE CAREFUL:** Fallow (like knip) can report false positives for dependencies used strictly in CSS (`tailwindcss-animate` via `@import` in `src/styles/index.css`), config-only plugins (`react-doctor`/`eslint-plugin-react-doctor` via `.oxlintrc.json` `jsPlugins`), or dynamically generated routes.
  - **Verification:** Before deleting any file or dependency flagged by Fallow, **manually search the codebase** for references (especially in `*.css`, `tailwind.config.*`, `vite.config.ts`, or `oxlint` configs) and use `fallow dead-code --trace <file>:<export>` or `--trace-dependency <name>` to verify.
    - **Ignore List:** If a tool/dependency is confirmed as necessary but flagged, add it to `ignoreDependencies` or `ignorePatterns` in `fallow.toml` (e.g., `tailwindcss-animate`, `@tanstack/react-query` kept for future use, `tailwindcss` build-time via `@tailwindcss/vite`, `react-doctor` via oxlint). See `fallow.toml:6` for current ignores and https://docs.fallow.tools/migration/from-knip.
  - **Agentic Workflow:** For AI agents and scripts, run `npx fallow audit --format json --quiet 2>/dev/null` and treat exit `0`/`1` as success (`1` = findings), `2` as real error (JSON envelope on stdout). Use `fallow` as the tidy gate before commit/PR (`fallow audit`), for refactoring prioritization (`fallow health --hotspots`), and for guard checks (`fallow guard <files>`).
  - **Regression Baseline:** CI uses embedded `regression.baseline` in `fallow.toml` (populated via `npx fallow --save-regression-baseline`). Run with `--fail-on-regression` to block count increases. Keep Fallow as part of the agentic process to keep the codebase tidy — run `audit` after each feature, and `dead-code --trace` before deleting any flagged export/file.

  ## 18. Layout Abstraction
  - **DRY Layouts:** If multiple pages share the same structural pattern (e.g., Header + Sidebar + Content), do not rebuild the layout in each page.
  - **Master Layouts:** Build a master layout component in the `src/components/layout` folder.
  - **Implementation:** Master layouts should use React props (like `children` or specific slots) to allow pages to inject their own content while keeping the container logic centralized.
  - **Example:** Refer to `LegalLayout.tsx` for the established standard on how to abstract complex, shared UI structures in this project.

## 19. Security & CSP Headers

- **CSP Maintenance:** Always maintain a robust Content Security Policy (CSP) to prevent XSS and data injection attacks.
- **Balance:** Strike a balance between strict security and production stability. Avoid over-restrictive policies that break critical third-party integrations (e.g., Google Fonts, analytics, or CDN-hosted assets).
- **Header Location:** CSP headers and other security policies are managed in `public/_headers` (for platforms like Cloudflare/Netlify).
- **Conflict Resolution:**
  - When adding a new feature that requires external resources (e.g., a new analytics tool or external API), you **MUST** audit and update the `public/_headers` file.
  - Resolve conflicts by adding the necessary domain to the relevant directive (e.g., `connect-src` or `img-src`) rather than using broad wildcards.
- **Verification:** Before deploying CSP changes, ensure:
  - Inline scripts (like the theme toggle script in `index.html`) are properly allowed via hashes or nonces.
  - `style-src` is compatible with our theme-switching mechanism and any external font CDNs.

## 20. Font Self-Hosting & Preloading

- **Self-Hosting Required:** All fonts used in the project **MUST** be self-hosted. Do not link to external font CDNs (like Google Fonts) in production.
- **Benefits:** This improves LCP (Largest Contentful Paint), removes critical request chains, and ensures full GDPR compliance by not leaking user IP addresses to third-party CDNs.
- **Directory:** Font files (WOFF2 preferred) should be stored in `public/fonts/`.
- **Implementation:**
  - Define `@font-face` rules in `src/fonts.css`.
  - Import `fonts.css` at the top of `src/index.css`.
- **Preloading:** Critical font weights (e.g., Regular 400 and Bold 700) **MUST** be preloaded via `Route.head` `<link rel="preload">` to prevent FOUT (Flash of Unstyled Text).

## 21. Import Conventions

- **Path Aliases:** Always use the path aliases defined in the project configuration (`tsconfig.json` and `vite.config.ts`).
- **Standard Alias:** Use the `@/` prefix to refer to the `src` directory (e.g., `import { Button } from "@/components/ui/button"`).
- **Benefits:** This avoids deep relative paths (`../../../../`) and makes refactoring significantly easier.
- **Consistency:** Use the alias for all imports that are not in the same directory.
