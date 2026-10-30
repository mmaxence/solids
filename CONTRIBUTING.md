# Contributing

Objects, effects, shades, animations and interactions are all welcome. The shortest path:

1. Read [docs/SKILL.md](docs/SKILL.md). It is written so a coding agent can follow it, and it is the contract a PR is reviewed against.
2. Add your folder under `src/objects/`, `src/effects/` or `src/shades/` (or a file under `src/interactions/` or `src/animations/`), register it in the matching `index.ts`, and run `npm run check` until it prints `ok`.
3. Look at it in `npm run dev` on both themes.
4. Open a PR with one screenshot. Keep the PR to one object or one effect.

What gets a PR merged: it compiles everywhere, it reads as part of the family under every shade (high contrast, one accent), it stays inside the size budget, and its README says what the parameters do in plain words.

Core changes (renderer, scene, the text element) are better discussed in an issue first.
