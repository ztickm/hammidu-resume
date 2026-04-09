#!/usr/bin/env bun
/**
 * CLI entrypoint for the resume-tailoring agent.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... bun run src/cli.ts \
 *     --resume resumes/json_resume.json \
 *     --jd "We are looking for a senior backend engineer…" \
 *     [--user user_123] \
 *     [--db agent.sqlite]
 *
 * Env vars:
 *   ANTHROPIC_API_KEY   — required
 *   AGENT_DB_PATH       — SQLite path for checkpointing (default: agent.sqlite)
 *   AGENT_PDF_DIR       — directory for generated PDFs (default: ./output)
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import "./env.js"; // load root .env before anything reads process.env
import { runAgent } from "./graph.js";

// ---------------------------------------------------------------------------
// Arg parsing (minimal — no external dep)
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--") && i + 1 < argv.length) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // -- Validate inputs -------------------------------------------------------
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY env var is required");
    process.exit(1);
  }

  const resumePath = args.resume;
  if (!resumePath) {
    console.error("❌ --resume <path> is required");
    process.exit(1);
  }
  const fullPath = resolve(resumePath);
  if (!existsSync(fullPath)) {
    console.error(`❌ Resume file not found: ${fullPath}`);
    process.exit(1);
  }

  const jdText =
    args.jd ??
    (args["jd-file"] ? readFileSync(resolve(args["jd-file"]), "utf-8") : null);

  if (!jdText) {
    console.error('❌ --jd "..." or --jd-file <path> is required');
    process.exit(1);
  }

  const userId = args.user ?? "default_user";
  const dbPath = args.db ?? process.env.AGENT_DB_PATH ?? "agent.sqlite";

  // -- Load resume ------------------------------------------------------------
  const masterResume = JSON.parse(readFileSync(fullPath, "utf-8"));

  // -- Override DB path via env so graph.ts picks it up -----------------------
  process.env.AGENT_DB_PATH = dbPath;

  console.log("🚀 Starting resume-tailoring agent…");
  console.log(`   User:    ${userId}`);
  console.log(`   Resume:  ${fullPath}`);
  console.log(`   DB:      ${dbPath}`);
  console.log("");

  // -- Run --------------------------------------------------------------------
  const result = await runAgent({
    user_id: userId,
    master_resume_json: masterResume,
    current_jd: jdText,
    thread_id: `${userId}_${Date.now()}`,
  });

  // -- Output -----------------------------------------------------------------
  console.log("\n✅ Done!\n");
  console.log(`Status:    ${result.status}`);
  console.log(`PDF:       ${result.pdf_output_url ?? "(PDF generation skipped)"}`);

  if (result.jd_analysis) {
    console.log(`\n📊 JD Analysis:`);
    console.log(`   Role:          ${result.jd_analysis.role_title}`);
    console.log(`   Company:       ${result.jd_analysis.company}`);
    console.log(`   Match:         ${result.jd_analysis.match_score}%`);
    console.log(`   Required:      ${result.jd_analysis.required_skills.join(", ")}`);
    console.log(`   Gaps:          ${result.jd_analysis.gaps.join(", ") || "(none)"}`);
  }

  if (result.tailored_resume_json) {
    const outPath = resolve("tailored_resume.json");
    await Bun.write(outPath, JSON.stringify(result.tailored_resume_json, null, 2));
    console.log(`\n📄 Tailored resume written to ${outPath}`);
  }
}

main().catch((err) => {
  console.error("💥 Agent failed:", err);
  process.exit(1);
});
