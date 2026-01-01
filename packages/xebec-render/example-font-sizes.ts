import { generateHTML, type GenerateConfig } from "./src/index";
import { readFileSync, writeFileSync } from "fs";
import type { ResumeSchema } from "./src/json-resume";
import { join } from "path";

// Define resumes folder path
const resumesPath = join(__dirname, "../../resumes");
const inputPath = join(resumesPath, "example_input.json");

// Load JSON Resume
const resume = JSON.parse(
  readFileSync(inputPath, "utf-8")
) as ResumeSchema;

console.log("=== Testing Font Size Configuration ===\n");

// Test 1: Default (12pt)
console.log("1. Generating with default font size (12pt)...");
const html12 = generateHTML(resume);
writeFileSync(join(resumesPath, "output-12pt.html"), html12, "utf-8");
console.log("   ✅ Saved to resumes/output-12pt.html");

// Test 2: Smaller (10pt)
console.log("\n2. Generating with smaller font size (10pt)...");
const config10: GenerateConfig = {
  baseFontSize: 10,
  lineHeight: 1.4,
};
const html10 = generateHTML(resume, config10);
writeFileSync(join(resumesPath, "output-10pt.html"), html10, "utf-8");
console.log("   ✅ Saved to resumes/output-10pt.html");

// Test 3: Compact (9pt)
console.log("\n3. Generating with compact font size (9pt)...");
const config9: GenerateConfig = {
  baseFontSize: 9,
  lineHeight: 1.3,
};
const html9 = generateHTML(resume, config9);
writeFileSync(join(resumesPath, "output-9pt.html"), html9, "utf-8");
console.log("   ✅ Saved to resumes/output-9pt.html");

// Test 4: Larger (14pt)
console.log("\n4. Generating with larger font size (14pt)...");
const config14: GenerateConfig = {
  baseFontSize: 14,
  lineHeight: 1.6,
};
const html14 = generateHTML(resume, config14);
writeFileSync(join(resumesPath, "output-14pt.html"), html14, "utf-8");
console.log("   ✅ Saved to resumes/output-14pt.html");

console.log("\n✅ All test files generated in resumes/ folder!");
console.log("Smaller font sizes will make the resume more compact.");
console.log("Compare the different sizes in your browser.");
