import { readFileSync } from "node:fs";

const summary = process.argv.slice(2).join(" ").toLowerCase();
const current = readFileSync(new URL("../VERSION", import.meta.url), "utf8").trim();
const [major, minor] = current.split(".").map(Number);

const majorKeywords = [
  "breaking",
  "incompatible",
  "remove",
  "removed",
  "rename",
  "renamed",
  "schema",
  "csv column",
  "input format",
  "output format",
  "major"
];

const bump = majorKeywords.some((keyword) => summary.includes(keyword)) ? "major" : "minor";
const next = bump === "major" ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`;

console.log(JSON.stringify({ current, bump, next }, null, 2));
