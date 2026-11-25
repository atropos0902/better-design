# Threat model

| Threat | What stops it | Checked by |
| --- | --- | --- |
| A pull request edits its own baseline, waivers, contract, lockfile or keys | All of them are read from the base branch | `eval/measure.ts instructions` |
| Text tells the agent or the reviewer to pass | The gate runs no model. MCP text is marked as reference and the bundle is signed | 25 attempts |
| PR code patches `getComputedStyle` or `matches` | The checker reads from an isolated world and from CDP | 25 attempts |
| PR code edits the design system stylesheet or its variables | Rule count compared with a pristine parse, and `token-redefined` | 25 attempts |
| PR code calls out from the runner's browser | Every request that isn't the screen itself is refused | `privacy` measurement |
| PR CSS runs JavaScript through `@plugin` or `@config` | Tailwind is compiled with module loading off | `build.ts` |
| PR imports files outside the repository | The bundler refuses them, links included | `build.ts` |
| Agent asks the MCP server for other files | Paths are resolved and must stay inside the project | MCP tests |
| Forged webhook | HMAC-SHA256 signature, compared in constant time | Service tests |
| Forged runner | OIDC token with issuer, audience and expiry. The repository comes from the claim | Service tests |
| One customer reads another | Row-level security on every table, with a role that doesn't own them | Service tests |
| Cross-site change to the kill switch | `SameSite` cookie, origin check and admin group | Service tests |
| Our outage blocks merges | The runner falls back to a neutral check of its own | Checker tests, against a fake GitHub |

## Known gaps

- **The GitHub App key is long-lived.** GitHub offers no other way to mint installation tokens. It's read from the customer's secret store at start and each token is for one repository with checks only. Everything else is short-lived.
- **The workflow file comes from the pull request.** Protect it with an organization ruleset, or a pull request could remove the step.
- **Forks are not enforced.** They get a neutral check, since they run without a write token.
- **One viewport, hover and focus only.** Media queries for other widths and other states are not opened.
- **The outage fallback hasn't been run against real GitHub.**
