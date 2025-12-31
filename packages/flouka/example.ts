import { generatePDFToFile } from "./src/index";
import { readFileSync } from "fs";
import type { ResumeSchema } from "xebec";
import { join } from "path";

// Define resumes folder path
const resumesPath = join(__dirname, "../../resumes");
const inputPath = join(resumesPath, "example_input.json");
const outputPath = join(resumesPath, "example_output.pdf");

// Load JSON Resume
const resume = JSON.parse(
  readFileSync(inputPath, "utf-8")
) as ResumeSchema;

console.log("Generating PDF for:", resume.basics.name);

// Generate PDF
await generatePDFToFile(resume, outputPath);

console.log("\n✅ PDF generated successfully!");
console.log("   - HTML content rendered with Puppeteer");
console.log("   - JSON Resume embedded as attachment");
console.log(`\nOpen ${outputPath} to view the result.`);
