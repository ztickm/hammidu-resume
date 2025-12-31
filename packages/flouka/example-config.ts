import { generatePDFToFile } from "./src/index";
import { readFileSync } from "fs";
import type { ResumeSchema, GenerateConfig } from "xebec";
import { join } from "path";

// Define resumes folder path
const resumesPath = join(__dirname, "../../resumes");
const inputPath = join(resumesPath, "example_input.json");

// Load JSON Resume
const resume = JSON.parse(
  readFileSync(inputPath, "utf-8")
) as ResumeSchema;

console.log("=== Generating PDFs with Configuration ===\n");
console.log("Resume for:", resume.basics.name);

// Test 1: Default configuration
console.log("\n1. Generating PDF with default configuration...");
await generatePDFToFile(resume, join(resumesPath, "pdf-default.pdf"));

// Test 2: Custom configuration with page break after education
console.log("\n2. Generating PDF with page break after education...");
const config: GenerateConfig = {
  pageBreakAfter: ["education"],
};
await generatePDFToFile(resume, join(resumesPath, "pdf-configured.pdf"), config);

// Test 3: Custom section order
console.log("\n3. Generating PDF with custom section order (work first)...");
const config2: GenerateConfig = {
  sectionOrder: ["work", "education", "skills", "projects", "languages"],
  pageBreakAfter: [],
};
await generatePDFToFile(resume, join(resumesPath, "pdf-custom-order.pdf"), config2);

console.log("\n✅ All PDFs generated successfully in resumes/ folder!");
console.log("   - HTML content rendered with Puppeteer");
console.log("   - JSON Resume embedded as attachment");
console.log("   - Custom page breaks and section ordering applied");
console.log("\nOpen the PDF files to see the differences.");
