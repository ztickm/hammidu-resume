#!/usr/bin/env bun
/**
 * Flouka MCP server — the resume pipeline over stdio.
 *
 * Exposes this monorepo's deterministic pieces (validate, render to PDF/HTML
 * with the source JSON embedded, read it back out, read/patch the master
 * resume) as MCP tools, so any MCP client can produce the real Harvard-template
 * PDF instead of hand-rolling one. No model calls happen here — the connected
 * model does the tailoring and hands the resume JSON back.
 *
 * stdio is the JSON-RPC channel, so NOTHING may write to stdout. All logging
 * goes to stderr; this is also why the render path calls `generatePDF` +
 * `Bun.write` rather than `generatePDFToFile`, which console.logs.
 */

import "../../agent/src/env.js"; // load root .env (FLOUKA_DB_PATH, AGENT_PDF_DIR) before anything reads process.env
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAll } from "./tools.ts";
import { OUTPUT_DIR } from "./render.ts";

const server = new McpServer(
  { name: "flouka", version: "0.1.0" },
  {
    instructions:
      "Resume tooling for Salim's JSON Resume pipeline. The master resume in the store is the only source of truth about his background — select and reframe from it, never invent entries, dates, tools or metrics. Tailor in your own context, then save the result with create_application so it is editable in the Flouka Studio web app, and render it with render_resume_pdf (which embeds the source JSON, so the PDF can be read back with extract_resume_from_pdf). A resume tailored for one application belongs in an application, never written over the master with update_master_resume or replace_master_resume.",
  }
);

registerAll(server);

const transport = new StdioServerTransport();
await server.connect(transport);

// stderr only — stdout belongs to the protocol.
console.error(`[flouka-mcp] ready on stdio; PDFs → ${OUTPUT_DIR}`);
