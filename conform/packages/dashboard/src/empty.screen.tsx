import { Overview } from "./overview";

export default function Screen() {
  return <Overview data={{ customer: "Northgate", killSwitch: false, admin: true, repos: [], rules: [], waivers: [] }} />;
}
