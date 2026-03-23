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
 * Returns the saved file path, or null if cancelled.
 * Phase 2: this will be implemented in src-tauri/src/pdf.rs.
 */
export async function tauriPrintToPDF(defaultName: string): Promise<string | null> {
  try {
    // Phase 2: invoke('print_to_pdf', { defaultName })
    // For now, show user that PDF export is coming soon.
    const result = await invoke<string | null>("save_pdf", {
      bytes: [],
      defaultName,
    });
    return result;
  } catch (err) {
    console.warn("tauriPrintToPDF: Phase 2 not yet implemented", err);
    return null;
  }
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
      printToPDF: typeof tauriPrintToPDF;
    };
  }
}

window.FloukaBridge = {
  isTauri: true,
  validateResume: clientValidateResume,
  generateHTML: clientGenerateHTML,
  printToPDF: tauriPrintToPDF,
};
