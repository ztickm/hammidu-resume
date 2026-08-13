#!/usr/bin/env bun
/**
 * CLI tool for validating JSON Resume files
 * Usage: bun cli.ts <file.json>
 */

import { validateResumeFile } from "./src/index";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Usage: bun cli.ts <file.json>");
  console.log("Example: bun cli.ts ../../resumes/example_input.json");
  process.exit(1);
}

const filePath = args[0]!;

console.log(`🔍 Validating ${filePath}...\n`);

const result = await validateResumeFile(filePath);

if (result.valid) {
  console.log("✅ Valid JSON Resume!\n");
  process.exit(0);
}

const issues = result.issues ?? [];
const errors = issues.filter((i) => i.severity === "error");
const warnings = issues.filter((i) => i.severity === "warning");

console.log(`❌ Invalid JSON Resume — ${issues.length} problem(s) found\n`);

if (errors.length > 0) {
  console.log(`Schema errors (${errors.length}):`);
  errors.forEach((issue, index) => {
    console.log(`  ${index + 1}. ${issue.path || "(whole document)"} ${issue.message}`);
    if (issue.keyword) console.log(`     rule: ${issue.keyword}`);
  });
  console.log();
}

if (warnings.length > 0) {
  console.log(`⚠️  Content problems (${warnings.length}):`);
  warnings.forEach((issue, index) => {
    console.log(`  ${index + 1}. ${issue.path || "(whole document)"} ${issue.message}`);
  });
  console.log();
}

process.exit(1);
