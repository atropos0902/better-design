export interface Env {
  /** Hosted: Hyperdrive pools connections near the database. */
  HYPERDRIVE?: { connectionString: string };
  /** Inside a customer's network: the same build connects directly. */
  DATABASE_URL?: string;
  PUBLIC_URL: string;
  GITHUB_API_URL: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  /** Issuer of the tokens runners present, e.g. https://token.actions.githubusercontent.com */
  RUNNER_OIDC_ISSUER: string;
  RUNNER_OIDC_AUDIENCE: string;
}
