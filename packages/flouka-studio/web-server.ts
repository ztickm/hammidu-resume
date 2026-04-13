/**
 * Web server for JSON Resume to PDF converter
 * Provides a web interface for uploading/pasting JSON Resume and generating PDFs
 */

import "../agent/src/env.js"; // load root .env (ANTHROPIC_API_KEY etc.) before anything reads process.env
import { generateHTML } from "xebec-render";
import type { GenerateConfig } from "xebec-render";
import type { ResumeSchema } from "json-resume-types";
import { generatePDF } from "./src/index.ts";
import { validateResume } from "validator";
import { analyseJD } from "../agent/src/nodes/analyse-jd.js";
import { tailorResume } from "../agent/src/nodes/tailor-resume.js";

const server = Bun.serve({
  port: 3001,
  async fetch(req: Request) {
    const url = new URL(req.url);

    // Serve the main HTML page
    if (url.pathname === "/") {
      return new Response(await Bun.file("./public/index.html").text(), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // API: Validate JSON Resume
    if (url.pathname === "/api/validate" && req.method === "POST") {
      try {
        const body = (await req.json()) as { resume: ResumeSchema };
        const { resume } = body;
        
        const result = validateResume(resume);
        
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ 
            valid: false,
            errors: [{ path: "/", message: (error as Error).message }]
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // API: Generate HTML preview
    if (url.pathname === "/api/preview" && req.method === "POST") {
      try {
        const body = (await req.json()) as { resume: ResumeSchema; config: GenerateConfig };
        const { resume, config } = body;
        
        // Validate before generating
        const validation = validateResume(resume);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ 
              error: "Invalid resume",
              validation 
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        
        const html = generateHTML(resume, config);
        
        return new Response(JSON.stringify({ html }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: (error as Error).message }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // API: Generate and download PDF
    if (url.pathname === "/api/generate-pdf" && req.method === "POST") {
      try {
        const body = (await req.json()) as { resume: ResumeSchema; config: GenerateConfig };
        const { resume, config } = body;
        
        // Validate before generating
        const validation = validateResume(resume);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ 
              error: "Invalid resume",
              validation 
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        
        const pdfBytes = await generatePDF(
          resume,
          { config }
        );
        
        return new Response(pdfBytes, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="resume.pdf"',
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: (error as Error).message }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // API: Tailor resume with AI agent (Nodes A + B only, no PDF)
    if (url.pathname === "/api/tailor" && req.method === "POST") {
      if (!process.env.ANTHROPIC_API_KEY) {
        return new Response(
          JSON.stringify({ error: "ANTHROPIC_API_KEY is not set on the server." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }

      try {
        const body = (await req.json()) as { resume: ResumeSchema; jd: string };
        const { resume, jd } = body;

        if (!jd?.trim()) {
          return new Response(
            JSON.stringify({ error: "Job description is required." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Build a minimal graph state manually — no LangGraph overhead needed
        // since we're calling the node functions directly.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state: any = {
          user_id: "web_user",
          master_resume_json: resume,
          current_jd: jd,
          jd_analysis: null,
          tailored_resume_json: null,
          pdf_output_url: null,
          status: "Starting…",
        };

        // Node A — analyse JD
        const analysisResult = await analyseJD(state as Parameters<typeof analyseJD>[0]);
        const stateAfterA = { ...state, ...analysisResult };

        // Node B — tailor resume (no PDF)
        const tailorResult = await tailorResume(stateAfterA as Parameters<typeof tailorResume>[0]);

        return new Response(
          JSON.stringify({
            tailored_resume: tailorResult.tailored_resume_json,
            jd_analysis: stateAfterA.jd_analysis,
            status: tailorResult.status,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: (error as Error).message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
console.log(`📄 Open http://localhost:${server.port} in your browser`);
