import { generatePDFToFile } from "./src/index";
import { readFileSync } from "fs";
import type { ResumeSchema, GenerateConfig } from "scpdf";

// Load JSON Resume from the scpdf package example
const resumePath = "../scpdf/example_json_resume.json";
const resume = JSON.parse(
  readFileSync(resumePath, "utf-8")
) as ResumeSchema;

console.log("=== Generating PDFs with Configuration ===\n");
console.log("Resume for:", resume.basics.name);

// Test 1: Default configuration
console.log("\n1. Generating PDF with default configuration...");
await generatePDFToFile(resume, "output-default.pdf");

// Test 2: Custom configuration with page break after education
console.log("\n2. Generating PDF with page break after education...");
const config: GenerateConfig = {
  pageBreakAfter: ["education"],
};
await generatePDFToFile(resume, "output-configured.pdf", config);

// Test 3: Custom section order
console.log("\n3. Generating PDF with custom section order (work first)...");
const config2: GenerateConfig = {
  sectionOrder: ["summary", "work", "education", "skills", "projects", "languages"],
  pageBreakAfter: ["work"],
};
await generatePDFToFile(resume, "output-custom-order.pdf", config2);

console.log("\n✅ All PDFs generated successfully!");
console.log("   - HTML content rendered with Puppeteer");
console.log("   - JSON Resume embedded as attachment");
console.log("   - Custom page breaks and section ordering applied");
console.log("\nOpen the PDF files to see the differences.");
