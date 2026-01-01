/**
 * Web server for JSON Resume to PDF converter
 * Provides a web interface for uploading/pasting JSON Resume and generating PDFs
 */

import { generateHTML } from "xebec-render";
import type { GenerateConfig, ResumeSchema } from "xebec-render";
import { generatePDF } from "./src/index.ts";
import { validateResume } from "validator";

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

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
console.log(`📄 Open http://localhost:${server.port} in your browser`);
