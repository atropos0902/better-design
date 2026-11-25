# Decisions

Short, newest last. One line of why.

1. **Score binding, show value beside it.** A value match passes `h-10` on a 40px control and fails in compact.
2. **No model in the gate.** A prompt can't talk it round and the same pull request gets the same answer.
3. **Policy comes from the base branch.** Otherwise a pull request grades its own work.
4. **Only new findings block.** Teams won't fix 588 old ones to ship a button.
5. **Findings are keyed by rule, part path and what was written.** Renames and line shifts don't bring old ones back.
6. **The trace proposes and the probe decides.** The first blind test had wrong answers that only a changed token could expose.
7. **`min()`, `max()` and `clamp()` are always unresolved.** The probe's test values win comparisons the real ones lose.
8. **An outage means comments.** Being wrong for an hour is cheaper than stopping every merge.
9. **GitHub gets the details, the service gets hashes.** The comment belongs next to the code it's about.
10. **Adapters live with the customer.** A new token format shouldn't need a release.
11. **Rows fold, testids don't.** Ten identical rows are one decision. Two named elements are two.
