/**
 * End-to-end smoke test for the Flouka MCP server.
 *
 * Drives the real server over stdio with the MCP SDK's own client, so it
 * exercises exactly what Claude Code or Claude Desktop would: schema
 * validation of the arguments, the tool handlers, and the stdio framing (a
 * stray console.log in the server shows up here as a parse failure).
 *
 * Runs against a throwaway store and PDF directory — FLOUKA_DB_PATH and
 * AGENT_PDF_DIR point into a temp dir — so it never touches the real master
 * resume or the committed samples in resumes/.
 */

import { mkdtempSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MONOREPO_ROOT = resolve(import.meta.dir, "../..");
const EXAMPLE = resolve(MONOREPO_ROOT, "resumes/example_input.json");

const sandbox = mkdtempSync(resolve(tmpdir(), "flouka-mcp-smoke-"));
const DB_PATH = resolve(sandbox, "flouka.sqlite");
const PDF_DIR = resolve(sandbox, "pdfs");

// ---------------------------------------------------------------------------
// Tiny assertion helpers
// ---------------------------------------------------------------------------

let passed = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}${detail ? `\n    ${detail}` : ""}`);
    throw new Error(`Smoke test failed: ${label}`);
  }
}

function section(label: string): void {
  console.log(`\n${label}`);
}

// ---------------------------------------------------------------------------
// Client plumbing
// ---------------------------------------------------------------------------

const transport = new StdioClientTransport({
  command: "bun",
  args: ["run", resolve(import.meta.dir, "src/server.ts")],
  env: {
    ...(process.env as Record<string, string>),
    FLOUKA_DB_PATH: DB_PATH,
    AGENT_PDF_DIR: PDF_DIR,
  },
  stderr: "inherit",
});

const client = new Client({ name: "flouka-mcp-smoke", version: "0.1.0" });

/** Call a tool and return its text content, failing loudly on an error result. */
async function call(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  const body = (result.content as { type: string; text?: string }[])
    .map((part) => part.text ?? "")
    .join("\n");
  if (result.isError) throw new Error(`Tool ${name} errored: ${body}`);
  return body;
}

/** Call a tool expecting it to fail, and return the error text. */
async function callExpectingError(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  const body = (result.content as { type: string; text?: string }[])
    .map((part) => part.text ?? "")
    .join("\n");
  if (!result.isError) throw new Error(`Tool ${name} was expected to fail but returned: ${body}`);
  return body;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

try {
  await client.connect(transport);
  console.log(`Sandbox: ${sandbox}`);

  // -- Discovery ------------------------------------------------------------
  section("Discovery");

  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  const expected = [
    "extract_resume_from_pdf",
    "get_application",
    "get_master_resume",
    "list_applications",
    "render_resume_html",
    "render_resume_pdf",
    "replace_master_resume",
    "update_master_resume",
    "validate_resume",
  ];
  check(`lists ${expected.length} tools`, names.length === expected.length, `got: ${names.join(", ")}`);
  check("tool names match", JSON.stringify(names) === JSON.stringify(expected), `got: ${names.join(", ")}`);
  check(
    "every tool has a description",
    tools.every((t) => (t.description ?? "").length > 20)
  );

  const { resources } = await client.listResources();
  check("exposes 3 resources", resources.length === 3, `got: ${resources.map((r) => r.uri).join(", ")}`);

  const { prompts } = await client.listPrompts();
  check("exposes the tailor-to-jd prompt", prompts.some((p) => p.name === "tailor-to-jd"));

  // -- Empty store ----------------------------------------------------------
  section("Empty store");

  const missing = await callExpectingError("get_master_resume");
  check("get_master_resume explains how to fix an empty store", missing.includes("Onboard in Flouka Studio"), missing);

  const emptyApps = JSON.parse(await call("list_applications"));
  check("list_applications returns an empty list", emptyApps.count === 0);

  // -- Seed the master resume ----------------------------------------------
  section("Master resume writes");

  const example = await Bun.file(EXAMPLE).json();
  await call("replace_master_resume", { resume: example });

  const stored = JSON.parse(await call("get_master_resume"));
  check("master resume round-trips through the store", stored.resume.basics.name === example.basics.name);
  check(
    "all sections survived the write",
    JSON.stringify(Object.keys(stored.resume)) === JSON.stringify(Object.keys(example))
  );

  const patched = await call("update_master_resume", {
    work: [
      {
        name: example.work[0].name,
        position: example.work[0].position,
        highlights: ["Smoke-test highlight, replaced by the patch."],
      },
    ],
  });
  check("patch reports the updated section", patched.includes("work: 1 updated"), patched);
  check("patch warns about the open-browser cache", patched.includes("reload"), patched);

  const afterPatch = JSON.parse(await call("get_master_resume")).resume;
  check(
    "patched highlights applied",
    JSON.stringify(afterPatch.work[0].highlights) ===
      JSON.stringify(["Smoke-test highlight, replaced by the patch."])
  );
  check(
    "untouched fields on the patched entry are intact",
    afterPatch.work[0].startDate === example.work[0].startDate &&
      afterPatch.work[0].summary === example.work[0].summary
  );
  check(
    "untouched sections are byte-identical",
    JSON.stringify(afterPatch.education) === JSON.stringify(example.education) &&
      JSON.stringify(afterPatch.skills) === JSON.stringify(example.skills) &&
      JSON.stringify(afterPatch.work[1]) === JSON.stringify(example.work[1])
  );

  const backupDir = resolve(sandbox, "backups");
  const backups = existsSync(backupDir) ? readdirSync(backupDir) : [];
  check(`backup written before the patch (${backups.length} found)`, backups.length >= 1, backupDir);

  const appended = await call("update_master_resume", {
    work: [{ name: "Brand New Co", position: "Engineer", startDate: "2026-01" }],
  });
  check("an unmatched work entry is reported as ADDED", appended.includes("ADDED"), appended);

  const noop = await callExpectingError("update_master_resume", {});
  check("an empty patch is refused", noop.includes("no recognised sections"), noop);

  // -- Validation -----------------------------------------------------------
  section("Validation");

  const validation = JSON.parse(await call("validate_resume", { path: "resumes/example_input.json" }));
  check("the example resume has no blocking errors", validation.blocking === false, validation.summary);

  const broken = await callExpectingError("render_resume_pdf", {
    resume: { basics: { name: "Nobody" }, work: "not an array" },
  });
  check("a schema error blocks rendering", broken.includes("schema error"), broken);

  // -- Render ---------------------------------------------------------------
  section("Render");

  const htmlPath = resolve(sandbox, "preview.html");
  const html = await call("render_resume_html", {
    resume: example,
    config: { baseFontSize: 11 },
    outputPath: htmlPath,
  });
  check("HTML contains the candidate's name", html.includes(example.basics.name), html.slice(0, 200));
  check("HTML reports its source", html.includes("Source: inline resume argument"));
  check("HTML was written to the given path", existsSync(htmlPath), htmlPath);

  // Rendering with no source argument uses the stored master — capture exactly
  // what that is now, so the round-trip check below has something to compare to.
  const expectedRendered = JSON.parse(await call("get_master_resume")).resume;

  const pdfOut = await call("render_resume_pdf", {
    config: { baseFontSize: 11, sectionOrder: ["summary", "work", "education", "skills"] },
    company: "Acme & Co.",
  });
  const pdfPath = pdfOut.split("\n")[0]!.replace("PDF written to: ", "").trim();
  check("PDF path is absolute", pdfPath.startsWith("/"), pdfPath);
  check("PDF landed in AGENT_PDF_DIR", pdfPath.startsWith(PDF_DIR), pdfPath);
  check("filename uses the name + company convention", pdfPath.endsWith("_resume_Acme_Co.pdf"), pdfPath);
  check("PDF exists and is non-trivial", existsSync(pdfPath) && statSync(pdfPath).size > 10_000, pdfPath);
  check("render echoes the config it used", pdfOut.includes("11pt"), pdfOut);

  // -- Round trip -----------------------------------------------------------
  section("Round trip");

  const extracted = JSON.parse(await call("extract_resume_from_pdf", { path: pdfPath }));
  check(
    "the PDF carries back the exact JSON it was rendered from",
    JSON.stringify(extracted) === JSON.stringify(expectedRendered)
  );
  check(
    "sections omitted from sectionOrder are still embedded",
    Array.isArray(extracted.languages) && extracted.languages.length > 0
  );

  const notOurs = await callExpectingError("extract_resume_from_pdf", { path: htmlPath });
  check("a file without the attachment fails clearly", notOurs.includes("Only PDFs generated by this pipeline"), notOurs);

  // -- Prompt ---------------------------------------------------------------
  section("Prompt");

  const prompt = await client.getPrompt({
    name: "tailor-to-jd",
    arguments: { jd: "Senior Platform Engineer, distributed systems.", company: "Acme" },
  });
  const promptText = prompt.messages.map((m) => (m.content as { text?: string }).text ?? "").join("\n");
  check("prompt embeds the job description", promptText.includes("distributed systems"));
  check("prompt carries the no-invention rule", promptText.includes("Never invent"));
  check("prompt tells the model not to write to the master", promptText.includes("update_master_resume"));

  console.log(`\n✅ ${passed} checks passed.`);
} finally {
  await client.close().catch(() => {});
  rmSync(sandbox, { recursive: true, force: true });
}
