import { existsSync, readFileSync } from "node:fs";

const problems = [];
const warnings = [];

const requiredFiles = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "docs/ENTERPRISE_READINESS.md",
  "docs/OPERATIONS.md",
  ".github/pull_request_template.md",
  ".github/workflows/ci.yml",
];

for (const file of requiredFiles) {
  if (!existsSync(file)) problems.push(`missing ${file}`);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const scripts = pkg.scripts ?? {};
for (const script of ["test", "health", "ops:check"]) {
  if (!scripts[script]) problems.push(`missing npm script: ${script}`);
}

if (!scripts.build && !scripts["build:renderer"] && !scripts.check) {
  problems.push("missing build, build:renderer, or check script");
}

if (!pkg.engines?.node) {
  problems.push("package.json missing engines.node");
}

if (existsSync(".gitignore")) {
  const ignored = readFileSync(".gitignore", "utf8");
  for (const pattern of ["node_modules", ".env"]) {
    if (!ignored.includes(pattern)) warnings.push(`.gitignore does not mention ${pattern}`);
  }
}

const ci = existsSync(".github/workflows/ci.yml") ? readFileSync(".github/workflows/ci.yml", "utf8") : "";
if (ci && !ci.includes("npm run ops:check")) {
  problems.push("CI does not run npm run ops:check");
}

const readme = existsSync("README.md") ? readFileSync("README.md", "utf8") : "";
for (const phrase of ["Quality Gates", "Enterprise Readiness"]) {
  if (!readme.includes(phrase)) problems.push(`README missing ${phrase}`);
}

for (const warning of warnings) {
  console.warn(`[ops] ${warning}`);
}

if (problems.length) {
  console.error(problems.map((problem) => `[ops] ${problem}`).join("\n"));
  process.exit(1);
}

console.log("[ops] LaunchOps Control Tower operational readiness checks passed");
