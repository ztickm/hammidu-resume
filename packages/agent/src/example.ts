#!/usr/bin/env bun
/**
 * Example: run the agent against one of the sample resumes.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... bun run packages/agent/src/example.ts
 */

import { readFileSync } from "fs";
import { resolve, join } from "path";
import "./env.js"; // load root .env before anything reads process.env
import { buildGraph } from "./graph.js";

const REPO_ROOT = resolve(import.meta.dir, "../../../..");

// -- Sample resume (use json_resume_concise.json if it exists, else json_resume.json)
const resumePath =
  [
    join(REPO_ROOT, "resumes/json_resume_concise.json"),
    join(REPO_ROOT, "resumes/json_resume.json"),
  ].find((p) => {
    try {
      readFileSync(p);
      return true;
    } catch {
      return false;
    }
  }) ?? join(REPO_ROOT, "resumes/json_resume.json");

const masterResume = JSON.parse(readFileSync(resumePath, "utf-8"));

// -- Sample JD
const sampleJD = `
Senior Backend Engineer — Acme Corp (Remote)

About the role:
We're looking for a Senior Backend Engineer to join our Platform team.
You'll design and build scalable microservices, own the CI/CD pipeline,
and mentor junior engineers.

Requirements:
- 5+ years backend development (Node.js, TypeScript, or Go)
- Experience with PostgreSQL, Redis, and message queues (RabbitMQ/Kafka)
- Strong understanding of REST and gRPC API design
- Experience with Docker, Kubernetes, and Terraform
- Excellent written and verbal communication

Nice to have:
- Experience with event-driven architectures
- Contributions to open-source projects
- Familiarity with observability (Prometheus, Grafana, OpenTelemetry)
`;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY to run this example.");
    process.exit(1);
  }

  console.log("🎯 Running resume-tailoring agent example\n");
  console.log(`Resume: ${resumePath}`);
  console.log(`JD:     Senior Backend Engineer @ Acme Corp\n`);

  // Build graph with in-memory checkpointer for the example
  const app = buildGraph(":memory:");

  const result = await app.invoke(
    {
      user_id: "example_user",
      master_resume_json: masterResume,
      current_jd: sampleJD,
      jd_analysis: null,
      tailored_resume_json: null,
      pdf_output_url: null,
      status: "Starting…",
    },
    {
      configurable: { thread_id: "example_thread" },
    }
  );

  console.log("\n" + "=".repeat(60));
  console.log("STATUS:", result.status);
  console.log("=".repeat(60));

  if (result.jd_analysis) {
    console.log("\n📊 JD Analysis:");
    console.log(JSON.stringify(result.jd_analysis, null, 2));
  }

  if (result.tailored_resume_json?.basics?.summary) {
    console.log("\n📝 Tailored Summary:");
    console.log(result.tailored_resume_json.basics.summary);
  }

  if (result.tailored_resume_json?.work) {
    console.log("\n💼 Tailored Work Highlights:");
    for (const w of result.tailored_resume_json.work) {
      console.log(`\n  ${w.name} — ${w.position}`);
      for (const h of w.highlights ?? []) {
        console.log(`    • ${h}`);
      }
    }
  }

  // Write output
  const outPath = resolve(REPO_ROOT, "resumes/tailored_resume.json");
  await Bun.write(outPath, JSON.stringify(result.tailored_resume_json, null, 2));
  console.log(`\n📄 Written to ${outPath}`);
}

main().catch((err) => {
  console.error("💥 Failed:", err);
  process.exit(1);
});
