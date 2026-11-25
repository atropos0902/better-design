# Support runbook

**"It blocked a fair pull request."** Set the repository to comments on the dashboard first. Then rerun `conform-check review --base <dir> --head <dir>` on their runner and read the finding. If the rule is wrong, fix the contract and sign a new bundle. If it's right but the screen has a reason, they add a waiver with an owner.

**"It blocks everything."** Press *Set all to comments*. It sets every repository to comments and turns failed checks neutral. Then look at what changed last: the bundle version in `conform.lock.json` is the first suspect.

**"The check never finishes."** The check says *Waiting for the runner* until the runner reports. Look at the workflow run. If the service is down, the runner posts a neutral check itself.

**"The agent ignores the design system."** Run `npx conform-mcp doctor`. Each problem comes with the command that fixes it. Restart the agent after a change.

**"Signature does not verify."** Someone edited `.conform/bundle.json`. Restore it from the main branch.

**Third waiver of one rule.** Open a question with the design system team before approving it. At that point the rule may be the mistake.
