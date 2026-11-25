import { Overview } from "./overview";

/** What the gate opens when it reviews this dashboard. */
export default function Screen() {
  return (
    <Overview data={{
      customer: "Northgate", killSwitch: true, admin: true,
      repos: [
        { id: 1, repo: "northgate/key-vault", stage: "required", reviews: 4, decisions: 50, bound: 31, valueMatches: 44, unresolved: 1 },
        { id: 2, repo: "northgate/alert-triage", stage: "comments", reviews: 0, decisions: 0, bound: 0, valueMatches: 0, unresolved: 0 },
      ],
      rules: [{ rule: "literal-value", count: 12 }, { rule: "wrong-token", count: 3 }],
      waivers: [{ rule: "wrong-token", prop: "font-weight", count: 3, question: true }],
    }} error="The change was not saved. Try again." />
  );
}
