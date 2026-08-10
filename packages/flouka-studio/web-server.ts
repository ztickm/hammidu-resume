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
import { MODEL_KEYS, DEFAULT_MODEL, type ModelKey, createChatModel } from "../agent/src/model.js";

const server = Bun.serve({
  port: 3020,
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
      try {
        const body = (await req.json()) as { resume: ResumeSchema; jd: string; model?: string; promptAddition?: string };
        const { resume, jd } = body;

        const modelKey: ModelKey = (MODEL_KEYS as readonly string[]).includes(body.model ?? "")
          ? (body.model as ModelKey)
          : DEFAULT_MODEL;

        const isDeepSeek = modelKey.startsWith("deepseek");
        const apiKey = isDeepSeek ? process.env.DEEPSEEK_API_KEY : process.env.ANTHROPIC_API_KEY;
        const keyName = isDeepSeek ? "DEEPSEEK_API_KEY" : "ANTHROPIC_API_KEY";

        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: `${keyName} is not set on the server.` }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }

        if (!jd?.trim()) {
          return new Response(
            JSON.stringify({ error: "Job description is required." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const nodeConfig = { configurable: { model_key: modelKey, prompt_addition: body.promptAddition ?? "" } };

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
        const analysisResult = await analyseJD(state, nodeConfig);
        const stateAfterA = { ...state, ...analysisResult };

        // Node B — tailor resume (no PDF)
        const tailorResult = await tailorResume(stateAfterA, nodeConfig);

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

    // API: Generate downloadable HTML
    if (url.pathname === "/api/generate-html" && req.method === "POST") {
      try {
        const body = (await req.json()) as { resume: ResumeSchema; config: GenerateConfig };
        const { resume, config } = body;

        const validation = validateResume(resume);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ error: "Invalid resume", validation }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const html = generateHTML(resume, config);

        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": 'attachment; filename="resume.html"',
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: (error as Error).message }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // API: Chat with AI to refine the tailored resume
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function applyChatEdit(master: ResumeSchema, edit: any): ResumeSchema {
      const merged: ResumeSchema = JSON.parse(JSON.stringify(master));
      if (edit.basics) {
        if (!merged.basics) merged.basics = {};
        if (edit.basics.label)   merged.basics.label   = edit.basics.label;
        if (edit.basics.summary) merged.basics.summary = edit.basics.summary;
      }
      if (edit.work && merged.work) {
        for (const tw of edit.work) {
          const match = merged.work.find((w) => w.name === tw.name && w.position === tw.position);
          if (match) {
            if (tw.highlights) match.highlights = tw.highlights;
            if (tw.summary  !== undefined) match.summary  = tw.summary;
          }
        }
      }
      if (edit.skills)    merged.skills    = edit.skills;
      if (edit.languages) merged.languages = edit.languages;
      if (edit.projects)  merged.projects  = edit.projects;
      if (edit.volunteer && merged.volunteer) {
        for (const tv of edit.volunteer) {
          const match = merged.volunteer.find((v) => v.organization === tv.organization && v.position === tv.position);
          if (match) {
            if (tv.highlights) match.highlights = tv.highlights;
            if (tv.summary !== undefined) match.summary = tv.summary;
          }
        }
      }
      return merged;
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      try {
        const body = (await req.json()) as {
          resume: ResumeSchema;
          jd: string;
          jdAnalysis: Record<string, unknown>;
          messages: Array<{ role: "user" | "assistant"; content: string }>;
          model?: string;
        };

        const modelKey: ModelKey = (MODEL_KEYS as readonly string[]).includes(body.model ?? "")
          ? (body.model as ModelKey)
          : DEFAULT_MODEL;

        const isDeepSeek = modelKey.startsWith("deepseek");
        const apiKey = isDeepSeek ? process.env.DEEPSEEK_API_KEY : process.env.ANTHROPIC_API_KEY;
        const keyName = isDeepSeek ? "DEEPSEEK_API_KEY" : "ANTHROPIC_API_KEY";

        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: `${keyName} is not set on the server.` }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }

        const systemPrompt = `You are a resume consultant helping refine a tailored resume. The resume has already been optimised for this job application.

## Current Tailored Resume
\`\`\`json
${JSON.stringify(body.resume, null, 2)}
\`\`\`

## Job Description
${body.jd}

## JD Analysis
\`\`\`json
${JSON.stringify(body.jdAnalysis, null, 2)}
\`\`\`

Help the user refine their resume. You can edit:
- basics.label (professional headline) and basics.summary
- work[].highlights (bullet points) and work[].summary — match entries by name + position
- skills[] — full replacement of the skills array
- languages[] — full replacement of the languages array
- projects[] — full replacement of the projects array
- volunteer[].highlights and volunteer[].summary — match entries by organization + position

Do NOT change: name, email, phone, education dates/institutions, job titles, company names, or any other factual identity fields.

${isDeepSeek
  ? `You MUST respond in JSON format with this exact structure:
\`\`\`json
{
  "reply": "Your conversational message to the user.",
  "update_resume": {
    "basics": { "label": "...", "summary": "..." },
    "work": [{ "name": "...", "position": "...", "highlights": ["..."], "summary": "..." }],
    "skills": [{ "name": "...", "level": "...", "keywords": ["..."] }],
    "languages": [{ "language": "...", "fluency": "..." }],
    "projects": [{ "name": "...", "description": "...", "highlights": ["..."], "keywords": ["..."], "url": "..." }],
    "volunteer": [{ "organization": "...", "position": "...", "highlights": ["..."], "summary": "..." }]
  }
}
\`\`\`
Include "update_resume" ONLY when the user asks you to change the resume. Otherwise, return only "reply". For array sections (work, skills, languages, projects, volunteer) always include ALL entries. Match work and volunteer entries by name/position or organization/position exactly. Preserve all facts, metrics, and dates — never fabricate.`
  : "When the user asks you to implement or apply changes, call the update_resume tool with only the sections you are changing. Include ALL entries for any array section you touch (e.g. all work entries if you edit any work highlights). Preserve all facts, metrics, and dates — never fabricate anything."}`;

        const conversationMessages = [
          { role: "system" as const, content: systemPrompt },
          ...body.messages,
        ];

        const extractText = (content: unknown): string =>
          typeof content === "string"
            ? content
            : (content as Array<{ type: string; text?: string }>)
                .filter((c) => c.type === "text")
                .map((c) => c.text ?? "")
                .join("");

        if (isDeepSeek) {
          const model = createChatModel(modelKey, { jsonMode: true });
          const response = await model.invoke(conversationMessages);
          const rawText = extractText(response.content);

          let parsed: { reply?: string; update_resume?: Record<string, unknown> };
          try {
            parsed = JSON.parse(rawText);
          } catch {
            return new Response(JSON.stringify({ reply: rawText }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          const reply = parsed.reply || rawText;

          if (parsed.update_resume) {
            const updatedResume = applyChatEdit(body.resume, parsed.update_resume);
            return new Response(
              JSON.stringify({ reply, updated_resume: updatedResume }),
              { headers: { "Content-Type": "application/json" } }
            );
          }

          return new Response(JSON.stringify({ reply }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // Anthropic — bind the update_resume tool
        const updateResumeTool = {
          name: "update_resume",
          description:
            "Apply changes to the resume. Only include the sections you are actually changing. For array sections (work, skills, languages, projects, volunteer) always include ALL entries of that section.",
          input_schema: {
            type: "object" as const,
            properties: {
              basics: {
                type: "object",
                description: "Updated headline and/or summary only — do not change name, email, or contact fields",
                properties: {
                  label:   { type: "string", description: "Professional headline" },
                  summary: { type: "string", description: "2–3 sentence professional summary" },
                },
              },
              work: {
                type: "array",
                description: "All work entries in original order. Match by name + position.",
                items: {
                  type: "object",
                  properties: {
                    name:       { type: "string", description: "Company name — must match original exactly" },
                    position:   { type: "string", description: "Job title — must match original exactly" },
                    highlights: { type: "array", items: { type: "string" } },
                    summary:    { type: "string" },
                  },
                  required: ["name", "position", "highlights"],
                },
              },
              skills: {
                type: "array",
                description: "Full replacement of the skills list",
                items: {
                  type: "object",
                  properties: {
                    name:     { type: "string" },
                    level:    { type: "string" },
                    keywords: { type: "array", items: { type: "string" } },
                  },
                },
              },
              languages: {
                type: "array",
                description: "Full replacement of the languages list",
                items: {
                  type: "object",
                  properties: {
                    language: { type: "string" },
                    fluency:  { type: "string" },
                  },
                },
              },
              projects: {
                type: "array",
                description: "Full replacement of the projects list",
                items: {
                  type: "object",
                  properties: {
                    name:        { type: "string" },
                    description: { type: "string" },
                    highlights:  { type: "array", items: { type: "string" } },
                    keywords:    { type: "array", items: { type: "string" } },
                    url:         { type: "string" },
                  },
                },
              },
              volunteer: {
                type: "array",
                description: "All volunteer entries in original order. Match by organization + position.",
                items: {
                  type: "object",
                  properties: {
                    organization: { type: "string", description: "Must match original exactly" },
                    position:     { type: "string", description: "Must match original exactly" },
                    highlights:   { type: "array", items: { type: "string" } },
                    summary:      { type: "string" },
                  },
                  required: ["organization", "position"],
                },
              },
            },
          },
        };

        const model = createChatModel(modelKey).bindTools([updateResumeTool]);
        const response = await model.invoke(conversationMessages);

        const toolCalls = (response.tool_calls ?? []) as Array<{ name: string; args: unknown }>;
        const updateCall = toolCalls.find((tc) => tc.name === "update_resume");

        if (updateCall) {
          const updatedResume = applyChatEdit(body.resume, updateCall.args);
          return new Response(
            JSON.stringify({
              reply: extractText(response.content) || "I've updated your resume with the requested changes.",
              updated_resume: updatedResume,
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response(JSON.stringify({ reply: extractText(response.content) }), {
          headers: { "Content-Type": "application/json" },
        });
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
