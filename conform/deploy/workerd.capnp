using Workerd = import "/workerd/workerd.capnp";

# The same bundle that runs hosted, on plain workerd inside a customer's network.
const config :Workerd.Config = (
  services = [
    (name = "main", worker = .conform),
    (name = "net", network = (allow = ["public", "private"], tlsOptions = (trustBrowserCas = true))),
  ],
  sockets = [(name = "http", address = "*:8787", http = (), service = "main")],
);

const conform :Workerd.Worker = (
  modules = [(name = "index.js", esModule = embed "../packages/service/dist/index.js")],
  compatibilityDate = "2026-04-15",
  compatibilityFlags = ["nodejs_compat"],
  globalOutbound = "net",
  bindings = [
    (name = "DATABASE_URL", fromEnvironment = "DATABASE_URL"),
    (name = "PUBLIC_URL", fromEnvironment = "PUBLIC_URL"),
    (name = "GITHUB_API_URL", fromEnvironment = "GITHUB_API_URL"),
    (name = "GITHUB_APP_ID", fromEnvironment = "GITHUB_APP_ID"),
    (name = "GITHUB_APP_KEY", fromEnvironment = "GITHUB_APP_KEY"),
    (name = "GITHUB_WEBHOOK_SECRET", fromEnvironment = "GITHUB_WEBHOOK_SECRET"),
    (name = "RUNNER_OIDC_ISSUER", fromEnvironment = "RUNNER_OIDC_ISSUER"),
    (name = "RUNNER_OIDC_AUDIENCE", fromEnvironment = "RUNNER_OIDC_AUDIENCE"),
  ],
);
