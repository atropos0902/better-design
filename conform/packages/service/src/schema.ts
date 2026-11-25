import { bigint, boolean, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const id = () => bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey();

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  killSwitch: boolean("kill_switch").notNull(),
  oidcIssuer: text("oidc_issuer").notNull(),
  oidcClientId: text("oidc_client_id").notNull(),
  adminGroup: text("admin_group").notNull(),
});
export const repos = pgTable("repos", {
  id: id(),
  customerId: text("customer_id").notNull(),
  fullName: text("full_name").notNull(),
  installationId: bigint("installation_id", { mode: "number" }).notNull(),
  stage: text("stage", { enum: ["silent", "comments", "required"] }).notNull(),
});
export const reviews = pgTable("reviews", {
  id: id(),
  customerId: text("customer_id").notNull(),
  repoId: bigint("repo_id", { mode: "number" }).notNull(),
  pr: integer("pr").notNull(),
  headSha: text("head_sha").notNull(),
  fork: boolean("fork").notNull(),
  checkRunId: bigint("check_run_id", { mode: "number" }),
  conclusion: text("conclusion", { enum: ["success", "failure", "neutral"] }),
  blocking: integer("blocking").notNull().default(0),
  decisions: integer("decisions").notNull().default(0),
  bound: integer("bound").notNull().default(0),
  valueMatches: integer("value_matches").notNull().default(0),
  unresolved: integer("unresolved").notNull().default(0),
  ms: integer("ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reportedAt: timestamp("reported_at", { withTimezone: true }),
});
export const findings = pgTable("findings", {
  reviewId: bigint("review_id", { mode: "number" }).notNull(),
  customerId: text("customer_id").notNull(),
  hash: text("hash").notNull(),
  rule: text("rule").notNull(),
  blocking: boolean("blocking").notNull(),
}, (t) => [primaryKey({ columns: [t.reviewId, t.hash] })]);
export const waiverCounts = pgTable("waiver_counts", {
  repoId: bigint("repo_id", { mode: "number" }).notNull(),
  customerId: text("customer_id").notNull(),
  rule: text("rule").notNull(),
  prop: text("prop").notNull(),
  count: integer("count").notNull(),
}, (t) => [primaryKey({ columns: [t.repoId, t.rule, t.prop] })]);
export const sessions = pgTable("sessions", {
  idHash: text("id_hash").primaryKey(),
  customerId: text("customer_id").notNull(),
  subject: text("subject").notNull(),
  admin: boolean("admin").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const auditLog = pgTable("audit_log", {
  id: id(),
  customerId: text("customer_id").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: jsonb("detail").notNull(),
});
