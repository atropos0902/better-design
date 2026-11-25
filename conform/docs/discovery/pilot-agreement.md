# Pilot agreement

**Length:** 30 days. **Repositories:** `access-review` and `alert-triage`.

**Baseline:** 60% and 66% of style decisions bound, measured on today's screens in all four themes. Existing findings are stored and don't block anyone.

**Target:** new pull requests at least 20 points higher with the server than without, on the same 20 tasks. Functional tests pass at least as often.

**What we install:** a GitHub App (write checks, read pull requests), a step on your own runner, and an MCP server your agents start with `npx`. Source code stays on your runner.

**What you can do at any time:** set one repository to silent, or set every repository to comments from the dashboard.

**It ends early if** a required check blocks a fair pull request twice in a week and we haven't fixed the rule.

| Signs | Role |
| --- | --- |
| | Platform owner |
| | Design lead |
| | Security reviewer |
