-- Every table carries customer_id and is readable only through the app.customer_id setting.
CREATE TABLE customers (
  id text PRIMARY KEY,
  name text NOT NULL,
  kill_switch boolean NOT NULL DEFAULT false,
  oidc_issuer text NOT NULL,
  oidc_client_id text NOT NULL,
  admin_group text NOT NULL DEFAULT 'conform-admins'
);
CREATE TABLE repos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customers (id),
  full_name text NOT NULL UNIQUE,
  installation_id bigint NOT NULL,
  stage text NOT NULL DEFAULT 'silent' CHECK (stage IN ('silent', 'comments', 'required'))
);
CREATE TABLE reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customers (id),
  repo_id bigint NOT NULL REFERENCES repos (id),
  pr integer NOT NULL,
  head_sha text NOT NULL,
  fork boolean NOT NULL DEFAULT false,
  check_run_id bigint,
  conclusion text CHECK (conclusion IN ('success', 'failure', 'neutral')),
  blocking integer NOT NULL DEFAULT 0,
  decisions integer NOT NULL DEFAULT 0,
  bound integer NOT NULL DEFAULT 0,
  value_matches integer NOT NULL DEFAULT 0,
  unresolved integer NOT NULL DEFAULT 0,
  ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  reported_at timestamptz,
  UNIQUE (repo_id, pr, head_sha)
);
CREATE TABLE findings (
  review_id bigint NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES customers (id),
  hash text NOT NULL,
  rule text NOT NULL,
  blocking boolean NOT NULL,
  PRIMARY KEY (review_id, hash)
);
CREATE TABLE waiver_counts (
  repo_id bigint NOT NULL REFERENCES repos (id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES customers (id),
  rule text NOT NULL,
  prop text NOT NULL,
  count integer NOT NULL,
  PRIMARY KEY (repo_id, rule, prop)
);
CREATE TABLE sessions (
  id_hash text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customers (id),
  subject text NOT NULL,
  admin boolean NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customers (id),
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['repos', 'reviews', 'findings', 'waiver_counts', 'sessions', 'audit_log'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant ON %I USING (customer_id = current_setting(''app.customer_id'', true)) WITH CHECK (customer_id = current_setting(''app.customer_id'', true))', t);
  END LOOP;
END $$;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant ON customers USING (id = current_setting('app.customer_id', true)) WITH CHECK (id = current_setting('app.customer_id', true));

-- The only lookups that run before the customer is known. Each returns an id and nothing else.
CREATE FUNCTION customer_for_repo(name text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT customer_id FROM repos WHERE full_name = name $$;
CREATE FUNCTION customer_for_session(h text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT customer_id FROM sessions WHERE id_hash = h AND expires_at > now() $$;

-- The service connects as this role. It does not own the tables, so row security applies to it.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'conform_app') THEN CREATE ROLE conform_app LOGIN; END IF;
END $$;
GRANT SELECT ON customers TO conform_app;
GRANT UPDATE (kill_switch) ON customers TO conform_app;
GRANT SELECT ON repos TO conform_app;
GRANT UPDATE (stage) ON repos TO conform_app;
GRANT SELECT, INSERT, UPDATE ON reviews TO conform_app;
GRANT SELECT, INSERT, DELETE ON findings, waiver_counts TO conform_app;
GRANT SELECT, INSERT, DELETE ON sessions TO conform_app;
GRANT INSERT ON audit_log TO conform_app;
REVOKE EXECUTE ON FUNCTION customer_for_repo(text), customer_for_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION customer_for_repo(text), customer_for_session(text) TO conform_app;
