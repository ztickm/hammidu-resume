import { PDFDocument } from "pdf-lib";
import * as jsonT from "./json-resume";
import { generateHTML } from "./html-generator";

// Note: html2pdf.js is browser-based, so we'll need an alternative approach
// For now, let's create a structure that can work with different backends

/**
 * Generate PDF from JSON Resume with embedded metadata
 */
export async function generatePDF(resume: jsonT.ResumeSchema): Promise<Uint8Array> {
  // Step 1: Generate HTML
  const html = generateHTML(resume);
  
  // Step 2: Convert HTML to PDF
  // TODO: Implement HTML to PDF conversion
  // html2pdf.js requires a browser environment (uses jsPDF + html2canvas)
  // We need to either:
  // - Use Puppeteer/Playwright for server-side rendering
  // - Use a different library that works in Bun/Node
  // - Generate PDF directly with pdf-lib
  
  throw new Error("PDF generation not yet implemented");
}

/**
 * Embed JSON Resume data as attachment in PDF
 */
export async function embedJSONMetadata(
  pdfBytes: Uint8Array,
  resume: jsonT.ResumeSchema
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  // Convert resume to JSON string
  const jsonString = JSON.stringify(resume, null, 2);
  const jsonBytes = new TextEncoder().encode(jsonString);
  
  // Attach JSON file to PDF
  await pdfDoc.attach(jsonBytes, "resume.json", {
    mimeType: "application/json",
    description: "JSON Resume source data",
    creationDate: new Date(),
    modificationDate: new Date(),
  });
  
  // Set PDF metadata
  pdfDoc.setTitle(resume.basics.name + " - Resume");
  pdfDoc.setAuthor(resume.basics.name);
  pdfDoc.setSubject("Resume/CV");
  pdfDoc.setKeywords(["resume", "cv"]);
  pdfDoc.setProducer("Hammidu Resume - Xebec");
  pdfDoc.setCreator("Xebec");
  
  // Save and return
  return await pdfDoc.save();
}
