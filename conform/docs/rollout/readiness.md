# Readiness checklist

What a team needs before this is required for every developer.

**Before silent**

- [ ] Bundle signed, lockfile committed, `npx conform-mcp doctor` clean on one laptop and one runner
- [ ] Baseline written with `conform-check survey --write-baseline`
- [ ] `.conform/`, `conform.lock.json` and the workflow file have code owners

**Silent to comments**

- [ ] Ten pull requests reviewed and read by the design system team
- [ ] No finding anyone calls wrong, or the rule is fixed

**Comments to required**

- [ ] The team has read its last 20 findings and agrees they were fair
- [ ] p95 review time under 3 minutes on this repository
- [ ] Someone on the team has used the kill switch once, on purpose
- [ ] Waivers have owners

**All repositories**

- [ ] Support has a channel and a named person
- [ ] The fix log has no hand fix still waiting for a product change
- [ ] ADR 001 is signed
