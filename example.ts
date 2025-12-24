import * as jsonT from "./src/json-resume";
import { generateHTML } from "./src/html-generator";
import { writeFileSync, readFileSync } from "fs";

// Load JSON Resume from file
const resumeData = JSON.parse(
  readFileSync("example_json_resume.json", "utf-8")
) as jsonT.ResumeSchema;

console.log("Loaded Resume for:", resumeData.basics.name);
console.log("Position:", resumeData.basics.label);

// Generate HTML
console.log("\n=== Generating HTML ===");
const html = generateHTML(resumeData);

// Save to file
const outputPath = "output.html";
writeFileSync(outputPath, html, "utf-8");
console.log(`HTML saved to: ${outputPath}`);
console.log("Open this file in a browser to preview the resume");
