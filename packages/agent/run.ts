#!/usr/bin/env bun
/**
 * Quick-run script for the resume-tailoring agent.
 *
 *   bun run packages/agent/run.ts
 *
 * Edit JD and RESUME_PATH below, then run.
 * Outputs: tailored_resume.json + a PDF in packages/agent/output/
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import "./src/env.js"; // loads root .env
import { buildGraph } from "./src/graph.js";

// ---------------------------------------------------------------------------
// ✏️  EDIT THESE
// ---------------------------------------------------------------------------

const RESUME_PATH = resolve(import.meta.dir, "../../resumes/json_resume_BA.json");

const JD = `

Strengthen our Engineering Team in full-time as Backend Engineer (m/f/d) within Germany remotely or at one of our office locations.

As a Backend Engineer (Node.js) in our EPOS team, you will contribute to building and improving services within our university administration system.

EPOS is a large-scale ERP-like platform that powers the entire student lifecycle—from enrollment to exam management—requiring reliable architecture, scalability, and seamless integrations across multiple domains and external platforms.

Our Stack

NodeJS, Vue.js 3, Tailwind CSS, Vite, Kafka, AWS, Docker, DataDog, GitLab, DDD

## Your tasks

    Contribute to the design, development, and operation of distributed systems (microservices, microfrontends). 
    Support the implementation of scalable and reliable backend services in a complex ERP environment. 
    Work with event-driven architectures and gain hands-on experience with streaming technologies like Kafka. 
    Deploy and maintain services in AWS using Docker (and Kubernetes where applicable). 
    Collaborate closely with cross-functional peers (PM, UX, QA, DevOps) in an agile setup. 
    Take ownership of your tasks and services, including monitoring, debugging, and continuous improvement. 

## Your Profile

    3+ years of professional experience in backend development with Node.js. 
    Solid understanding of building and operating backend services and APIs. 
    Experience with event-driven systems or messaging technologies (e.g. Kafka, RabbitMQ). 
    Familiar with working with AI tools and workflows. 
    Basic knowledge of cloud environments (AWS or similar) and containerization (Docker). 
    Interest in working with complex systems and learning about scalable architectures. 
    Good understanding of web technologies and software quality principles. 
    Strong team player with a proactive mindset and willingness to learn and grow. 

## We offer

    Be you at IU: We support and empower you to achieve your personal and professional goals. After all, your happiness significantly contributes to a positive and productive environment. 
    Work wherever you want...: Digitalization is part of our DNA. Decide for yourself which place sparks the most productivity in you. You love remote work? No problem! Would you like to work abroad for a while? Our WorkFlex Benefit makes it possible. 
    ... and flexible in terms of time: It's your job; We trust you and give you the greatest possible freedom to organize yourself. 
    Take your knowledge to a new level: Where else, if not with us? Enjoy free access to all our e-learning platforms. In addition, we will finance you a complete technology course of your choice. 
    Make your journey sustainable: Whether it's a DeutschlandTicket subsidized down to 13 euros or a Jobrad (bike leasing) offer, enjoy the freedom of mobility for both work and personal activities, while also making an eco-friendly choice. 
    33 days to rest: Taking breaks is important! In addition to 30 flexible vacation days per year, we also give you an extra day off on your birthday, as well as days off on Christmas Eve and New Year's Eve. 

IU International University of Applied Science (IU) is Germany's largest university of applied science - and we are not just an excellent choice for studying, but also an outstanding Great Place to Work®! As an Edutech company, we rely on state-of-the-art technology and data-driven approaches. That's why AI-driven voice assistants and other generative AI-systems have long become part of our daily work routine, helping us to focus on exciting projects. Here at IU over 4,000 employees are dedicated to making a difference.

Sounds like the perfect job for you? Then apply now! Simple, fast and even without a cover letter.

`;

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌  ANTHROPIC_API_KEY is not set.");
    console.error(
      "    Add it to the root .env file or export it in your shell."
    );
    process.exit(1);
  }

  const masterResume = JSON.parse(readFileSync(RESUME_PATH, "utf-8"));

  console.log("🚀  Starting agent…");
  console.log(`    Resume: ${RESUME_PATH}\n`);

  const app = buildGraph(":memory:");

  const result = await app.invoke(
    {
      user_id: "run_user",
      master_resume_json: masterResume,
      current_jd: JD,
      jd_analysis: null,
      tailored_resume_json: null,
      pdf_output_url: null,
      status: "Starting…",
    },
    { configurable: { thread_id: "run_thread" } }
  );

  // -- Print JD analysis
  if (result.jd_analysis) {
    const a = result.jd_analysis;
    console.log("\n📋  JD Analysis");
    console.log(`    Role:        ${a.role_title} @ ${a.company}`);
    console.log(`    Match score: ${a.match_score}%`);
    console.log(`    Required:    ${a.required_skills.join(", ")}`);
    if (a.gaps.length)
      console.log(`    Gaps:        ${a.gaps.join(", ")}`);
  }

  // -- Save tailored resume JSON
  if (result.tailored_resume_json) {
    const outJson = resolve(import.meta.dir, "../../resumes/tailored_resume.json");
    writeFileSync(outJson, JSON.stringify(result.tailored_resume_json, null, 2));
    console.log(`\n✅  Tailored resume JSON → ${outJson}`);
  }

  // -- PDF path
  if (result.pdf_output_url) {
    console.log(`📄  PDF → ${result.pdf_output_url}`);
  }

  console.log(`\nStatus: ${result.status}`);
}

main().catch((err) => {
  console.error("💥  Agent failed:", err.message ?? err);
  process.exit(1);
});
