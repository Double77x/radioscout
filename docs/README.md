# Documentation map

Four tiers. The first is read on every task; the rest are on demand.

| Tier | Folder | Read when |
| :---- | :---- | :---- |
| Standards | `standards/` | **Always.** Four files, `ARCHITECTURE.md` among them |
| Modules | `modules/` | The task names a file and its header points here |
| Lineage | `lineage.md` | You need to know why something ended up this way |
| Plans | `plans/` | A decision has a deep dive you need to read |

`ROADMAP.md` and `TODO.md` sit at the root because they are living state rather than reference. They are write targets, not reading targets.

## The procedure

1. Read all four files in `standards/`: `CODING_STANDARDS.md`, `STYLE_GUIDE.md`, `TECH_STACK.md`, `ARCHITECTURE.md`. `AGENTS.md` lists them, and `scripts/check-doc-pointers.js` fails the build if a standard is added without appearing there.
2. Editing a module that has a contract doc? Follow the pointer in its file header.
3. Tracing why something is the way it is? Search `lineage.md` before reading anything else.

Step 2 is the one that does the work. You are already opening the file, so the pointer costs nothing to read and saves a search.

## Why standards are unconditional

The obvious alternative is a trigger table — "read the style guide if the change touches UI". It does not survive contact with an agent under time pressure, because deciding whether a task touches UI requires knowing something about the task you do not know yet. That is not a hypothetical: the old instruction was "read all files in `docs/`", it was not obeyed, and `STYLE_GUIDE.md` spent months describing a different application with components that do not exist in this repo.

The set is small enough to read every time, it is bounded by a folder, and the folder is gated against the instruction that names it. That is the whole mechanism.

## Where the "why" lives

The rule that keeps this from rotting is **one home per why**. A verdict gets stated in exactly one place, and the other places point at it.

- **TSDoc on an export** is the contract for its caller. Present tense, short, and it never restates the module doc.
- **A module doc** is the contract for the whole module: what it is for, its invariants, its known traps. Present tense only. A module doc that starts needing a History section is telling you the content belongs in `lineage.md`, so link out instead.
- **`lineage.md`** is the append-only record of how it got that way. One entry per decision. It never describes current behaviour, which is what stops it contradicting the code. A later decision that reverses an older one appends and says so.
- **A plan** is the long-form version of one decision, for the ones that earned it. Nine of them do.
- **An `AGENTS.md` entry** is the one-line index into all of the above.
- **A standing prohibition** is not history, it is a rule in force right now, so it goes in `standards/CODING_STANDARDS.md` §15 alongside the verification traps. If ignoring it would damage the repo in a way that is hard to notice afterwards, it belongs there rather than in `lineage.md`.

`AGENTS.md` holds a one-line index of the decisions plus the rules an agent needs on every task, and nothing else. The harness injects it into context on each turn, so its size is a running cost: it held 45KB of decision history until that moved here, roughly 12k tokens per turn for prose most tasks never need. `scripts/check-doc-pointers.js` enforces a 12,000-byte budget on it, so reasoning that creeps back in fails the build.

Code comments follow the same split. A comment states a constraint or a decision that an agent would otherwise get wrong; anything about how the code arrived at that shape belongs in `lineage.md`.

## Adding a document

| Kind | Goes in | Also needs |
| :---- | :---- | :---- |
| A rule | `standards/` | The trigger stated in step 2-4 above |
| A module contract | `modules/`, mirroring the `src/` path | A pointer in the module's file header |
| A subsystem overview | `standards/`, beside `ARCHITECTURE.md` | A pointer from the files it governs |
| A decision | `lineage.md`, appended | A dated `AGENTS.md` entry linking to it |
| A decision with a deep dive | `plans/` | A `lineage.md` entry that links to it |

A document that nothing points at is a dead document. If you cannot name what would send an agent to it, do not write it.

## What is here now

**standards/** — `CODING_STANDARDS.md` (the rules), `STYLE_GUIDE.md` (tokens, layout, motion), `TECH_STACK.md` (versions and rationale), `ARCHITECTURE.md` (system design, routing, the SSG lifecycle, the native shell).

**modules/** — per-module contracts, paths mirroring `src/`, each reached by following the pointer in its module's own file header — that pointer is the index, so no list here. `modules/README.md` holds the naming rule and what belongs in one. The one exception is documented where it lives: `player/leveling.md` is named after a subsystem rather than one file, because loudness leveling spans four files, and all four point at it.

The four files behind it: the maths in `radio/normalize.ts`, the graph in `player/leveling-graph.ts`, the tick plumbing in `player/leveling.ts`, and the refs in `player/engine.ts`.

Only files that need explaining beyond their code get one. `src/lib/radio/icy.ts` and `src/lib/native-audio.ts` are heavily commented and deliberately have no contract — their comments are the contracts, per-export and present-tense, and extracting them would cost context rather than save it.

**lineage.md** — the append-only decision log. Search this first when tracing a problem: it records what was chosen, why, and what it cost, and never describes current behaviour. Runs from 2026-09-01; `AGENTS.md` carries the one-line index and the gate keeps the two in step.

**plans/** — dated decision records, append-only:

- `AGENTIC_PLAY.md` — the `?play=` URL contract
- `CAPACITOR_PLAN.md` — native shell, signing, release workflow
- `FDROID_PLAN.md` — reproducible builds, listing metadata
- `NATIVE_AUDIO_PLAN.md` — the Media3 foreground-service player
- `OBTAINIUM_PLAN.md` — Obtainium listing config
- `REFACTOR_PERFORMANCE_USEEFFECT.md` — the `useEffect` audit and its rules
- `REFACTOR_PLAYER_ENGINE_PLAN.md` — the engine split and why the seam was left uncut
- `REFACTOR_ZERO_REGRESSION_GATES.md` — the gate set that keeps refactors honest
- `STREAM_TITLES.md` — ICY, BBC RMS and the edge functions behind them