// Copy the customer's current signed bundle into its repositories.
import { cp, readdir } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("customers", process.argv[2] ?? "northgate");
for (const r of await readdir(path.join(root, "repos"))) {
  const d = path.join(root, "repos", r);
  await cp(path.join(root, "dist/bundle.json"), path.join(d, ".conform/bundle.json"));
  await cp(path.join(root, "dist/keys.json"), path.join(d, ".conform/keys.json"));
  await cp(path.join(root, "dist/lock.json"), path.join(d, "conform.lock.json"));
  await cp(path.join(root, "design-system/theme.css"), path.join(d, ".conform/theme.css")).catch(() => {});
}
