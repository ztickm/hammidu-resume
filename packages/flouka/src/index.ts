import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import { generateHTML, type ResumeSchema, type GenerateConfig } from "xebec";

/**
 * Generate PDF from JSON Resume with embedded metadata using Puppeteer
 */
export async function generatePDF(
  resume: ResumeSchema,
  options: { config?: GenerateConfig } = {}
): Promise<Uint8Array> {
  // Step 1: Generate HTML from resume with configuration
  const html = generateHTML(resume, options.config);

  // Step 2: Launch Puppeteer and render HTML to PDF
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Set content and wait for any fonts/styles to load
  await page.setContent(html, {
    waitUntil: "networkidle0",
  });

  // Generate PDF with proper print settings
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: false,
    margin: {
      top: "0.5cm",
      right: "0.5cm",
      bottom: "0.5cm",
      left: "0.5cm",
    },
  });

  await browser.close();

  // Step 3: Embed JSON metadata using pdf-lib
  const pdfWithMetadata = await embedJSONMetadata(pdfBuffer, resume);

  return pdfWithMetadata;
}

/**
 * Embed JSON Resume data as attachment in PDF
 */
async function embedJSONMetadata(
  pdfBytes: Uint8Array,
  resume: ResumeSchema
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
  pdfDoc.setTitle(`${resume.basics.name} - Resume`);
  pdfDoc.setAuthor(resume.basics.name);
  pdfDoc.setSubject("Resume/CV");
  pdfDoc.setKeywords(["resume", "cv", "json-resume"]);
  pdfDoc.setProducer("Hammidu Resume - Flouka");
  pdfDoc.setCreator("Flouka");

  // Save and return
  return await pdfDoc.save();
}

/**
 * Generate PDF and save to file
 */
export async function generatePDFToFile(
  resume: ResumeSchema,
  outputPath: string,
  config?: GenerateConfig
): Promise<void> {
  const pdfBytes = await generatePDF(resume, { config });
  await Bun.write(outputPath, pdfBytes);
  console.log(`PDF saved to: ${outputPath}`);
}
