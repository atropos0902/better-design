# Security questionnaire

| Question | Answer |
| --- | --- |
| Does source code leave our network? | No. The review runs on your runner. See [data-flow.md](data-flow.md) |
| What does the GitHub App ask for? | Checks: write. Pull requests: read, for the webhook. The comment and the clone use the runner's own short-lived token. No actions, no administration, no secrets |
| How do people sign in? | OIDC with PKCE against your identity provider. No passwords and no client secret |
| How do machines sign in? | The runner's own OIDC token, minutes long |
| Which long-lived secrets exist? | The GitHub App key and the webhook secret, both in your secret store. Neither is written to the database |
| Is data encrypted at rest? | That's your Postgres and your disks. The service adds nothing on top |
| How are customers separated? | Postgres row-level security on every table |
| Can we run it ourselves? | Yes. `deploy/compose.yaml` runs the same build on workerd |
| What models are used on our code? | None. The gate has no model in it |
| What do you log? | Request errors by message. Admin changes go to `audit_log` with the actor |
| What's in the build? | [sbom.json](sbom.json), CycloneDX, the full lockfile including build tools |
| Is the npm package verifiable? | It's set up to publish from CI with provenance. It hasn't been published yet |
| How do we turn it off? | One button, or remove the App |
| Has it been penetration tested? | No |
