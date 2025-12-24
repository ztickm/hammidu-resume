import { generatePDFToFile } from "./src/index";
import { readFileSync } from "fs";
import type { ResumeSchema } from "scpdf";

// Load JSON Resume from the scpdf package example
const resumePath = "../scpdf/example_json_resume.json";
const resume = JSON.parse(
  readFileSync(resumePath, "utf-8")
) as ResumeSchema;

console.log("Generating PDF for:", resume.basics.name);

// Generate PDF
await generatePDFToFile(resume, "output.pdf");

console.log("\n✅ PDF generated successfully!");
console.log("   - HTML content rendered with Puppeteer");
console.log("   - JSON Resume embedded as attachment");
console.log("\nOpen output.pdf to view the result.");
