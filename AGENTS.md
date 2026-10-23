# Scout — Agent Guide

This is the entry point for AI coding agents in this repo. Human docs: `README.md`.

It carries rules, pointers and the facts a task needs on every run. Reasoning, history and audits belong in `docs/`; a fact that is only useful once belongs there rather than here.

## Read first

`AGENTS.md` is the only file to read before every task. Open a standard when the task touches its area (all four live in `docs/standards/`):

- `CODING_STANDARDS.md` — any code change; §15 (prohibitions and traps) always, plus the section for the area you touch
- `STYLE_GUIDE.md` — UI, layout, motion and tokens
- `TECH_STACK.md` — dependencies, build or toolchain changes
- `ARCHITECTURE.md` — modules, routing, the SSG lifecycle, data flow or native shell

`scripts/check-doc-pointers.js` fails the build if a file lands in `docs/standards/` without appearing in this list, so adding a standard means adding it here. It also holds this file to a 12,000-byte budget, so a new rule has to displace one.

Everything else is on demand. [`docs/README.md`](docs/README.md) is the map for the rest.

## Project

Scout is a TanStack Start (SSG) starter on Cloudflare Pages — `radioscout.pages.dev`. Type-safe Router + Query, Base UI + shadcn, Tailwind v4, self-hosted Poppins. All routes prerender to `dist/client` and are served as static HTML. The same artifact also ships as an Android APK via Capacitor (`capacitor.config.ts`, `android/`).

## Decision log

`docs/lineage.md` is the append-only record of what was decided, why, and what it cost. It opens with an index of every entry, so search it when you need to know _why_ something is the way it is; it never describes current behaviour. Standing prohibitions and verification traps are rules in force, so they live in `docs/standards/CODING_STANDARDS.md` §15 instead.

Append an entry there and add its line to the index. Do not put the reasoning back into this file.

## UI Primitives

`src/components/ui/*` holds the Base UI + shadcn primitives. Check what is already there before adding one; when you need another, pull it and rewire its primitives from `@radix-ui/*` to `@base-ui/react/*`:

```bash
pnpm dlx shadcn@latest add <primitive> --yes
```

Dialogs use `@base-ui/react/dialog` directly — there is no wrapper file. After adding a primitive, run `pnpm exec vp lint src/components/ui/<primitive>.tsx` and `npx fallow dead-code --trace src/components/ui/<primitive>.tsx:Export`; Fallow is silenced for primitives via `fallow.toml:ignorePatterns`, so remove the entry when the file is re-added. The acquisition strategy is `docs/standards/CODING_STANDARDS.md` §2.

## Working Agreements

- Search with the `grep`/`glob` tools, or `git grep` with an explicit path. Never recurse from the repo root: `node_modules`, `dist` and `android` turn a 60 ms search into a timeout.
- Prefer `edit`/`read`/`grep`/`glob` over shell; use `skill` when a task matches a skill (Humanizer, Cloudflare, etc.).
- Use TanStack Query (`useQuery` + `keepPreviousData`) — no `useEffect` fetch. Use Router search for URL state.
- Scope gates to the change, then widen. Start with `pnpm exec vp lint <files>` and the failing test; reach for `tsc -b`, the build, Fallow and the full suite when the change is large or you are about to commit. Most changes never need the full stack; match the gate to the magnitude, and run it at the end of the phase rather than after every edit.
- At the end of a phase, `pnpm verify` is the gate: lint, format check, unit tests, the build (with `tsc -b`, prerender and the doc-pointer check) and Fallow. CI runs the same script, alongside actionlint and Playwright; run `pnpm test:e2e` when an accessible name, role or radio route changes.
- Run one test while iterating: `pnpm exec vp test tests/unit/<file>.test.ts -t "<name>"`. The full unit suite belongs to `pnpm verify`.
- Change only what the task needs. No drive-by refactors, renames, formatting sweeps or dependency bumps; a smaller diff is faster to review and cheaper to verify.
- Done means evidence. Quote the command and its result instead of claiming it passed. For a multi-file or behavioural change, review the diff in a fresh-context subagent before finishing.
- Formatting is the pre-commit hook's job. `.vite-hooks/pre-commit` runs `vp staged` (`vp fmt`) on the files in the commit, installed by `prepare`. Do not run the formatter mid-task; if hooks are disabled, run `pnpm format` before committing. `pnpm verify` runs `pnpm format:check` as part of the gate.
- `fallow audit` is a per-feature gate, not a per-file one; run `fallow dead-code --trace` before deleting anything it flags. Run `pnpm fdroid:check` whenever Android versioning or F-Droid listing metadata changes.
- Before finishing, ask whether your change made a document wrong: behaviour a module doc describes means that doc gets updated in the same change, and a decision or a new constraint means a `docs/lineage.md` entry or a §15 rule. The table is in `docs/standards/CODING_STANDARDS.md` §24.
- Git commits from a non-interactive shell must pass `-m` (or `GIT_EDITOR=true`): `core.editor` is VS Code `--wait`, so a commit without a message waits on an editor tab forever.

## useEffect Discipline

`useEffect` is a last resort. Reach for these first, in order: derive in render or `useMemo`; `on*` props on the element that owns the interaction; `@tanstack/react-hotkeys` rather than a hand-rolled keydown listener; TanStack Query for async data; Router search params for shareable state; refs written alongside their setters.

A new effect needs a justification comment at the call site and a line in the audit. `scout/no-unjustified-effect` caps each file at the count in `toolchain.config.ts`, so the call that exceeds it fails lint; raising the count is the mechanical half of adding a site and needs an audit row. The full rule is `docs/standards/CODING_STANDARDS.md` §3.E, and the audited exceptions are `docs/plans/REFACTOR_PERFORMANCE_USEEFFECT.md` — re-derive them with `grep -rn "useEffect(" src`, because the table's line numbers are a snapshot.
