# ADR 001: which token source wins

**Status:** open. **Owner:** design lead, with the platform owner. **Signed by:** nobody yet.

Figma and the token package disagree on six values. Designers hold that Figma is the design. Engineers hold that the package is what users get.

Until this is signed the checker follows the package, because that's what ships. A screen can't be failed for matching the value it was given.

| If | Then |
| --- | --- |
| The package wins | Figma is corrected. Nothing changes in the checker |
| Figma wins | The package is released with the six changes, the bundle is signed again, and repositories take it through the lockfile |

`control.height` in compact is the one that matters most: 36px in Figma, 32px in the package, in rows that are 32px tall. `status.info` exists only in Figma, so a screen that needs it has no token to use and would be failed for something the system doesn't offer.
