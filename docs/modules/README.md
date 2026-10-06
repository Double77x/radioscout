# Module contracts

One file per module that needs more explanation than a TSDoc block can carry. The path mirrors `src/`, so `src/lib/player/engine.ts` is documented by `modules/player/engine.md`.

## What belongs here

- What the module is responsible for, and what it deliberately leaves to other modules.
- Invariants a caller depends on, stated as rules rather than as descriptions of the current code.
- Known traps: ordering requirements, state that must not be touched, platform splits.
- Deployment consequences, such as a CSP or cache requirement that a code change would break.

## What does not

- **History.** When it was built, which bug prompted it, what was tried first. That belongs in `plans/`, linked from the code that carries the consequence.
- **Signatures.** The module's exports document themselves.
- **Anything a mechanical check can enforce.** If a test can catch it, the test catches it and the doc stays prose.

## The pointer

The module's own file header names its doc, so an agent opening the file finds it without searching:

```ts
/**
 * Playback state machine, and the app's largest module.
 * Contract: docs/modules/player/engine.md
 */
```

Two rules keep the pointers honest:

- Every doc here is reachable from a source file header or from the index in `docs/README.md`. An unreferenced module doc is dead weight.
- Every path a source file names must resolve. `scripts/check-doc-pointers.js` runs in the build chain and checks both directions, so a moved doc fails the build rather than quietly rotting.