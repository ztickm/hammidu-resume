/**
 * Debug script to inspect PDF structure
 */
import { PDFDocument, PDFName } from "pdf-lib";
import { join } from "path";

const pdfPath = join(__dirname, "../../resumes/example_output.pdf");

console.log("Loading PDF:", pdfPath);

const file = Bun.file(pdfPath);
const arrayBuffer = await file.arrayBuffer();
const pdfBytes = new Uint8Array(arrayBuffer);

const pdfDoc = await PDFDocument.load(pdfBytes);
const context = pdfDoc.context;
const catalog = pdfDoc.catalog;

console.log("\nCatalog keys:");
const catalogDict = catalog.dict;
for (const [key, value] of catalogDict.entries()) {
  console.log(`  ${key}: ${value}`);
}

// Check for Names
const namesRef = catalog.get(PDFName.of('Names'));
console.log("\nNames ref:", namesRef);

if (namesRef) {
  const namesDict = context.lookup(namesRef);
  console.log("Names dict:", namesDict);
  console.log("Names dict keys:");
  
  if (namesDict && typeof namesDict === 'object' && 'dict' in namesDict) {
    for (const [key, value] of (namesDict as any).dict.entries()) {
      console.log(`  ${key}: ${value}`);
    }
  }
}

// Try getting embedded files directly
console.log("\n\nTrying to get embedded files...");
const embeddedFiles = pdfDoc.context.enumerateIndirectObjects();
console.log("Total indirect objects:", embeddedFiles.length);

// Look for file specs
for (const [ref, obj] of embeddedFiles) {
  const objStr = obj.toString();
  if (objStr.includes('FileSpec') || objStr.includes('EmbeddedFile') || objStr.includes('resume')) {
    console.log(`\nFound interesting object at ${ref}:`);
    console.log(objStr.substring(0, 200));
  }
}
