# Agent log

Claude Code wrote this code. Codex hasn't been used on it yet, so there's nothing to compare.

**Saved time**

- The CDP cascade reader and the Tailwind build worked on the first run.
- Unit tests for the CSS value parser, about 60 cases in one pass.
- The second customer's adapter.

**Cost time**

- The first checker trusted its own trace for literals and resets. Its tests passed because the same reasoning wrote both. A blind set from a separate session found 9 wrong answers.
- The evaluation runner twice compared the wrong side of a padding or gap value. Both times it looked like a checker bug.
- A helper named `src/proxy.ts` became Next middleware without a warning in development.
- Tests for the MCP server first accepted several answers at once. They were rewritten to accept one.

**Mutants.** Rules in `packages/core` merge at 90% or more killed. The current score is 91.9%: 1,038 of 1,129. The weakest file is `bundle.ts` at 80%, where most survivors change key options the runtime ignores.
