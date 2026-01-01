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
} else {
  console.log("❌ Invalid JSON Resume\n");
  
  if (result.errors && result.errors.length > 0) {
    console.log("Schema Errors:");
    result.errors?.forEach((err, index) => {
      console.log(`\n${index + 1}. Path: ${err.path}`);
      console.log(`   Message: ${err.message}`);
      if (err.keyword) {
        console.log(`   Type: ${err.keyword}`);
      }
    });
  }
  
  if (result.warnings && result.warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    result.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`);
    });
  }
  
  console.log();
  process.exit(1);
}
