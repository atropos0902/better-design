# Fix log

Every fix made by hand and the product change that replaced it. Times were not recorded during the build, so that column is empty until a pilot fills it.

| Found on | Fixed by hand | Product change | Time |
| --- | --- | --- | --- |
| Northgate theme | Renamed the Tailwind key so `px-control` meant padding | The survey runs before a bundle is signed, which is how it was found | |
| Northgate dark themes | Set a page text color | `root` in the contract: the base stylesheet applies it for every customer | |
| Old white cards | Told reviewers to ignore contrast findings on them | A contrast finding caused by an old background is a comment | |
| Added stylesheet | Loaded it by hand | Stylesheets a pull request adds are loaded and judged | |
| Repeated rows | Counted one row and missed a different one | All rows are judged, identical results fold into one | |
| Fernhill tokens | Nothing in core | A 47-line adapter in the customer's folder | |
| Dashboard worker | Renamed `src/proxy.ts`, which Next treats as middleware | None needed elsewhere | |
