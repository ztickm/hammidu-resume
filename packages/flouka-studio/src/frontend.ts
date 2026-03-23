/**
 * Frontend bundle entrypoint for Flouka Studio desktop (Tauri production build).
 *
 * This file is bundled by `bun build` into `public/bundle.js` so that the static
 * HTML page can use xebec-render, validator, and @tauri-apps/api without a dev server.
 *
 * In dev mode (tauri dev), the frontend is served from the web server at
 * http://localhost:3001 and this bundle is NOT used — the server-side API handles
 * everything. In production (tauri build), the HTML is loaded from disk and this
 * bundle provides all the logic.
 */

import { generateHTML } from "xebec-render";
import type { GenerateConfig } from "xebec-render";
import type { ResumeSchema } from "json-resume-types";
import { validateResume } from "validator";
import { invoke } from "@tauri-apps/api/core";

// ---------------------------------------------------------------------------
// Re-export for use by index.html via window.FloukaBridge
// ---------------------------------------------------------------------------

export type { GenerateConfig, ResumeSchema };

/**
 * Validate a resume using the JS validator package (runs fully in-browser).
 */
export function clientValidateResume(resume: ResumeSchema) {
  return validateResume(resume);
}

/**
 * Generate HTML from a resume and config using xebec-render (runs in-browser).
 */
export function clientGenerateHTML(resume: ResumeSchema, config?: GenerateConfig): string {
  return generateHTML(resume, config);
}

/**
 * Request Tauri backend to print the current WebView to PDF.
 *
 * Flow:
 *   1. Rust `print_to_pdf` calls `WKWebView.createPDF()` → returns raw bytes
 *   2. JS runs pdf-lib to embed resume.json + metadata
 *   3. Rust `save_pdf` opens a native Save dialog and writes the final PDF
 *
 * Returns the saved file path, or null if the user cancelled.
 */
export async function tauriPrintToPDF(
  resume: ResumeSchema,
  defaultName: string,
): Promise<string | null> {
  // Step 1: get raw PDF bytes from the WebView's own print engine
  const rawBytes: number[] = await invoke<number[]>("print_to_pdf");

  // Step 2: embed resume.json as an attachment using pdf-lib (dynamic import
  // keeps pdf-lib out of the initial parse — it's large).
  const { PDFDocument } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.load(new Uint8Array(rawBytes));

  const jsonBytes = new TextEncoder().encode(JSON.stringify(resume, null, 2));
  await pdfDoc.attach(jsonBytes, "resume.json", {
    mimeType: "application/json",
    description: "JSON Resume source data",
    creationDate: new Date(),
    modificationDate: new Date(),
  });

  if (resume.basics) {
    const name = resume.basics.name ?? "";
    pdfDoc.setTitle(`${name} — Resume`);
    pdfDoc.setAuthor(name);
    pdfDoc.setSubject("Curriculum Vitae");
    pdfDoc.setKeywords(["resume", "cv", "json-resume"]);
    pdfDoc.setProducer("Hammidu Resume / Flouka Studio");
    pdfDoc.setCreator("Flouka Studio desktop app");
  }

  const finalBytes = Array.from(await pdfDoc.save());

  // Step 3: native Save dialog + write file
  const result = await invoke<string | null>("save_pdf", {
    bytes: finalBytes,
    defaultName,
  });

  return result;
}

/**
 * Expose bridge on window so that the inline script in index.html can call it
 * without needing ES module import syntax (which requires a bundler-aware entry).
 */
declare global {
  interface Window {
    FloukaBridge?: {
      isTauri: boolean;
      validateResume: typeof clientValidateResume;
      generateHTML: typeof clientGenerateHTML;
      printToPDF: (resume: ResumeSchema, defaultName: string) => Promise<string | null>;
    };
  }
}

window.FloukaBridge = {
  isTauri: true,
  validateResume: clientValidateResume,
  generateHTML: clientGenerateHTML,
  printToPDF: tauriPrintToPDF,
};
