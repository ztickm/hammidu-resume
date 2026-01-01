/**
 * Type declarations for extractor package
 * Extracts JSON Resume metadata from PDF files
 */

export type { ResumeSchema } from "@jsonresume/schema";

export interface ExtractionResult {
  success: boolean;
  resume?: import("@jsonresume/schema").ResumeSchema;
  error?: string;
}

/**
 * Extract JSON Resume metadata from PDF bytes
 */
export function extractResumeFromPDF(pdfBytes: Uint8Array): Promise<ExtractionResult>;

/**
 * Extract JSON Resume from a PDF file path
 */
export function extractResumeFromFile(filePath: string): Promise<ExtractionResult>;

/**
 * Check if PDF contains resume metadata
 */
export function hasResumeMetadata(pdfBytes: Uint8Array): Promise<boolean>;
