import { generatePDFToFile } from "./src/index";
import { readFileSync } from "fs";
import type { ResumeSchema, GenerateConfig } from "xebec";

// Load JSON Resume
const resumePath = "./json_resume.json";
const resume = JSON.parse(
  readFileSync(resumePath, "utf-8")
) as ResumeSchema;

console.log("=== Generating PDFs with Different Font Sizes ===\n");
console.log("Resume for:", resume.basics.name);

// Test 1: Default size (12pt)
console.log("\n1. Generating PDF with default font (12pt) and lower line height...");
const config12: GenerateConfig = {
  lineHeight: 1.2,
  sectionOrder: [ "work","education", "skills", "projects"],
  pageBreakAfter: [],
  pageBreakBefore: [],
};
await generatePDFToFile(resume, "output-12pt.pdf", config12);

// // Test 2: Compact size (10pt)
// console.log("\n2. Generating compact PDF (10pt)...");
// const config10: GenerateConfig = {
//   baseFontSize: 10,
//   lineHeight: 1.4,
// };
// await generatePDFToFile(resume, "output-10pt.pdf", config10);

// // Test 3: Very compact (9pt)
// console.log("\n3. Generating very compact PDF (9pt)...");
// const config9: GenerateConfig = {
//   baseFontSize: 9,
//   lineHeight: 1.3,
// };
// await generatePDFToFile(resume, "output-9pt.pdf", config9);

console.log("\n✅ All PDFs generated successfully!");
console.log("   - Smaller font sizes reduce page count");
console.log("   - 10pt is a good balance between compact and readable");
console.log("   - 9pt is very compact but still professional");
console.log("\nCompare the PDFs to see the difference in length.");
