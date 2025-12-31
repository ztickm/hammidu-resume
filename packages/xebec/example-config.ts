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

console.log("=== Testing Resume Generation with Configuration ===\n");

// Test 1: Default configuration
console.log("1. Generating with default configuration...");
const htmlDefault = generateHTML(resume);
writeFileSync(join(resumesPath, "output-default.html"), htmlDefault, "utf-8");
console.log("   ✅ Saved to resumes/output-default.html");

// Test 2: Custom section order
console.log("\n2. Generating with custom section order (work first)...");
const config1: GenerateConfig = {
  sectionOrder: ["summary", "work", "education", "skills", "projects", "languages"],
};
const htmlCustomOrder = generateHTML(resume, config1);
writeFileSync(join(resumesPath, "output-custom-order.html"), htmlCustomOrder, "utf-8");
console.log("   ✅ Saved to resumes/output-custom-order.html");

// Test 3: Page breaks after education
console.log("\n3. Generating with page break after education...");
const config2: GenerateConfig = {
  pageBreakAfter: ["education"],
};
const htmlPageBreak = generateHTML(resume, config2);
writeFileSync(join(resumesPath, "output-page-break.html"), htmlPageBreak, "utf-8");
console.log("   ✅ Saved to resumes/output-page-break.html");

// Test 4: Combined: custom order + page breaks
console.log("\n4. Generating with custom order AND page breaks...");
const config3: GenerateConfig = {
  sectionOrder: ["summary", "education", "work", "skills", "projects"],
  pageBreakAfter: [],
  pageBreakBefore: [],
};
const htmlCombined = generateHTML(resume, config3);
writeFileSync(join(resumesPath, "output-combined.html"), htmlCombined, "utf-8");
console.log("   ✅ Saved to resumes/output-combined.html");

console.log("\n✨ All examples generated successfully!");
console.log("Open the HTML files in a browser to see the differences.");
