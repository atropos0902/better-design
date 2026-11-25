# Design system inventory

| Source | What it holds | Trusted for |
| --- | --- | --- |
| Figma variables export | 9 variables, 2 modes, light only | Names and intent |
| Token package | 38 tokens, 4 themes | What ships |
| Shipped screens | 25 screens in 12 repositories | What people see |

Where the first two disagree is in [token-disagreements.md](token-disagreements.md). Where the third disagrees with the second is in `results/survey-northgate.json`.

The survey found three things worth telling the customer before the pilot.

- Every repository looks better by value than by binding. `scan-scheduler` is 91% by value and 47% by binding. `key-vault` is 94% and 81%.
- The one the checker caught in the design system itself: `--spacing-control` in the Tailwind theme made `px-control` resolve to the height token. Every control had 40px of padding where 16px was meant.
- The base stylesheet set no text color on the page, so text with no class was black in dark mode.
