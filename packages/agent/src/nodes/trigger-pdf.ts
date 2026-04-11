/**
 * Node C — PDF Generation (local)
 *
 * Uses xebec-render to turn the tailored JSON-Resume into HTML, then
 * flouka-studio's Puppeteer-based `generatePDF` to produce a PDF.
 *
 * The PDF bytes are written to disk and the local file path is stored
 * in state.pdf_output_url.  A retry wrapper is applied at the graph
 * level (see graph.ts).
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateHTML } from "xebec-render";
import type { GenerateConfig } from "xebec-render";
import { generatePDF } from "flouka-studio";
import type { ResumeSchema } from "json-resume-types";
import type { GraphStateType } from "../state.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Directory where generated PDFs are stored. */
const OUTPUT_DIR = process.env.AGENT_PDF_DIR ?? resolve(import.meta.dir, "../../../../resumes");

// ---------------------------------------------------------------------------
// Tool definition (usable by the agent autonomously if needed)
// ---------------------------------------------------------------------------

export const generatePdfTool = tool(
  async (input: { resume_json: string; config_json?: string }): Promise<string> => {
    const resume: ResumeSchema = JSON.parse(input.resume_json);
    const config: GenerateConfig = input.config_json
      ? JSON.parse(input.config_json)
      : {};

    // 1. xebec-render: JSON → HTML
    const _html = generateHTML(resume, config);

    // 2. flouka-studio: HTML → PDF (Puppeteer)
    const pdfBytes = await generatePDF(resume, { config });

    // 3. Write to disk
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const filename = `tailored_${Date.now()}.pdf`;
    const outPath = resolve(OUTPUT_DIR, filename);
    writeFileSync(outPath, pdfBytes);

    return outPath;
  },
  {
    name: "generate_pdf",
    description:
      "Render a JSON-Resume to PDF using xebec-render (HTML) and flouka-studio (Puppeteer). Returns the local file path.",
    schema: z.object({
      resume_json: z
        .string()
        .describe("Stringified JSON-Resume to render"),
      config_json: z
        .string()
        .optional()
        .describe("Optional stringified GenerateConfig (sectionOrder, baseFontSize, etc.)"),
    }),
  }
);

// ---------------------------------------------------------------------------
// Node function (deterministic — calls tool directly, no LLM)
// ---------------------------------------------------------------------------

export async function triggerPdf(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  if (!state.tailored_resume_json) {
    throw new Error(
      "triggerPdf called before tailoring — missing tailored_resume_json in state"
    );
  }

  const resumeStr = JSON.stringify(state.tailored_resume_json);
  const filePath = await generatePdfTool.invoke({ resume_json: resumeStr });

  return {
    pdf_output_url: filePath,
    status: `PDF generated — ${filePath}`,
  };
}
