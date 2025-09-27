#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function getFlag(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return undefined;
  return process.argv[index + 1];
}

const planFlag = getFlag("--plan");
const configFlag = getFlag("--config");

if (!planFlag || !configFlag) {
  console.error("Usage: npm run exec:plan -- --plan <planPath> --config <configPath>");
  process.exit(1);
}

const planPath = path.resolve(process.cwd(), planFlag);
const configPath = path.resolve(process.cwd(), configFlag);

if (!fs.existsSync(planPath)) {
  console.error(`[executor] Plan file not found: ${planPath}`);
  process.exit(1);
}

if (!fs.existsSync(configPath)) {
  console.error(`[executor] Config file not found: ${configPath}`);
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

console.log("[executor] Starting mock execution...\n");
console.log(`[executor] Plan file: ${planPath}`);
console.log(`[executor] Config file: ${configPath}`);
console.log("\n[executor] Plan contents:\n", JSON.stringify(plan, null, 2));
console.log("\n[executor] Config contents:\n", JSON.stringify(config, null, 2));

console.log("\n[executor] Execution complete. (Mock)");
