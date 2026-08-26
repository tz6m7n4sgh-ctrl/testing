import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const requiredFiles = ["README.md", "package.json", ".github/workflows/ci.yml", "docs/ARCHITECTURE.md"];
const requiredScripts = ["test", "build"];
const problems = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) problems.push(`missing ${file}`);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const script of requiredScripts) {
  if (!pkg.scripts?.[script]) problems.push(`missing npm script: ${script}`);
}

const readme = readFileSync("README.md", "utf8");
for (const section of ["Features", "Quick Start", "Quality Gates", "License"]) {
  if (!readme.includes(section)) problems.push(`README missing section: ${section}`);
}

const tests = existsSync("test") ? readdirSync("test").filter((file) => file.endsWith(".test.js")) : [];
if (tests.length === 0) problems.push("missing test coverage");

for (const generated of ["dist", "node_modules"]) {
  if (existsSync(generated) && statSync(generated).isDirectory()) {
    console.warn(`[health] local generated directory present: ${join(process.cwd(), generated)}`);
  }
}

if (problems.length) {
  console.error(problems.map((item) => `[health] ${item}`).join("\n"));
  process.exit(1);
}

console.log(`[health] ${pkg.name} repository checks passed`);
