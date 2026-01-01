import { PDFDocument, PDFName, PDFArray, PDFDict, PDFStream } from "pdf-lib";
import type { ResumeSchema } from "@jsonresume/schema";
import { inflateSync } from "zlib";

export interface ExtractionResult {
  success: boolean;
  resume?: ResumeSchema;
  error?: string;
}

/**
 * Extract JSON Resume metadata from a PDF file
 * Looks for embedded file attachments named "resume.json"
 */
export async function extractResumeFromPDF(pdfBytes: Uint8Array): Promise<ExtractionResult> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const context = pdfDoc.context;
    
    // Try to get the Names dictionary from the catalog
    const catalog = pdfDoc.catalog;
    const namesRef = catalog.get(PDFName.of('Names'));
    
    if (!namesRef) {
      return {
        success: false,
        error: "No Names dictionary found in PDF"
      };
    }

    const namesDict = context.lookup(namesRef);
    if (!(namesDict instanceof PDFDict)) {
      return {
        success: false,
        error: "Invalid Names dictionary"
      };
    }

    // Look for EmbeddedFiles
    const embeddedFilesRef = namesDict.get(PDFName.of('EmbeddedFiles'));
    if (!embeddedFilesRef) {
      return {
        success: false,
        error: "No embedded files found in PDF"
      };
    }

    const embeddedFilesDict = context.lookup(embeddedFilesRef);
    if (!(embeddedFilesDict instanceof PDFDict)) {
      return {
        success: false,
        error: "Invalid EmbeddedFiles dictionary"
      };
    }

    // Get the Names array
    const namesArrayRef = embeddedFilesDict.get(PDFName.of('Names'));
    if (!namesArrayRef) {
      return {
        success: false,
        error: "No Names array in EmbeddedFiles"
      };
    }

    const namesArray = context.lookup(namesArrayRef);
    if (!(namesArray instanceof PDFArray)) {
      return {
        success: false,
        error: "Invalid Names array"
      };
    }

    // Iterate through the names array [name1, ref1, name2, ref2, ...]
    const names = namesArray.asArray();
    for (let i = 0; i < names.length; i += 2) {
      const nameObj = names[i];
      const fileSpecRef = names[i + 1];
      
      if (!nameObj || !fileSpecRef) {
        continue;
      }
      
      // The name might be in PDF string format or hex string
      // Convert to regular string
      let fileName = '';
      const nameStr = nameObj.toString();
      
      // Check if it's a hex string (UTF-16BE with BOM FEFF)
      if (nameStr.startsWith('<FEFF')) {
        // Remove < and >, then parse hex
        const hex = nameStr.slice(5, -1);
        const bytes = [];
        for (let j = 0; j < hex.length; j += 4) {
          const code = parseInt(hex.substr(j, 4), 16);
          bytes.push(code);
        }
        fileName = String.fromCharCode(...bytes);
      } else {
        fileName = nameStr.replace(/[<>()]/g, '');
      }
      
      // Check if this is resume.json
      if (fileName.includes('resume.json')) {
        const fileSpec = context.lookup(fileSpecRef);
        
        if (!(fileSpec instanceof PDFDict)) {
          continue;
        }

        // Get the embedded file stream
        const efRef = fileSpec.get(PDFName.of('EF'));
        if (!efRef) {
          continue;
        }

        const efDict = context.lookup(efRef);
        if (!(efDict instanceof PDFDict)) {
          continue;
        }

        const fileStreamRef = efDict.get(PDFName.of('F'));
        if (!fileStreamRef) {
          continue;
        }

        const fileStream = context.lookup(fileStreamRef);
        if (!(fileStream instanceof PDFStream)) {
          continue;
        }

        // Extract the contents
        const fileContents = fileStream.getContents();
        
        // Check if the stream is compressed (FlateDecode filter)
        const filterObj = fileStream.dict.get(PDFName.of('Filter'));
        const isCompressed = filterObj && filterObj.toString() === '/FlateDecode';
        
        // Decompress if needed
        const rawData = isCompressed ? inflateSync(fileContents) : fileContents;
        const jsonString = new TextDecoder().decode(rawData);
        
        try {
          const resume = JSON.parse(jsonString) as ResumeSchema;
          return {
            success: true,
            resume
          };
        } catch (parseError) {
          return {
            success: false,
            error: `Failed to parse JSON: ${(parseError as Error).message}`
          };
        }
      }
    }
    
    return {
      success: false,
      error: "resume.json attachment not found in PDF"
    };
  } catch (error) {
    return {
      success: false,
      error: `PDF extraction error: ${(error as Error).message}`
    };
  }
}

/**
 * Extract JSON Resume from a PDF file path
 */
export async function extractResumeFromFile(filePath: string): Promise<ExtractionResult> {
  try {
    const file = Bun.file(filePath);
    const arrayBuffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);
    
    return await extractResumeFromPDF(pdfBytes);
  } catch (error) {
    return {
      success: false,
      error: `File read error: ${(error as Error).message}`
    };
  }
}

/**
 * Extract and validate that the PDF contains resume metadata
 * Returns true if resume.json attachment exists, false otherwise
 */
export async function hasResumeMetadata(pdfBytes: Uint8Array): Promise<boolean> {
  const result = await extractResumeFromPDF(pdfBytes);
  return result.success;
}

// Re-export types
export type { ResumeSchema } from "@jsonresume/schema";
