/**
 * Node A — Resume Analysis
 *
 * Extracts structured requirements from the JD and maps them against the
 * master resume to produce a JDAnalysis object that Node B consumes.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import type { GraphStateType } from "../state.js";
import type { JDAnalysis } from "../state.js";

// ---------------------------------------------------------------------------
// Zod schema for structured JD analysis output
// ---------------------------------------------------------------------------

const JDAnalysisSchema = z.object({
  role_title: z.string().describe("The job title from the JD"),
  company: z.string().describe("The company name from the JD"),
  required_skills: z
    .array(z.string())
    .describe("Hard skills, technologies, tools mentioned as required"),
  preferred_qualities: z
    .array(z.string())
    .describe("Soft skills, leadership qualities, or 'nice-to-haves'"),
  key_responsibilities: z
    .array(z.string())
    .describe("The main responsibilities that align with work experience bullet points"),
  gaps: z
    .array(z.string())
    .describe(
      "Skills or experiences the JD asks for that the master resume does NOT contain"
    ),
  match_score: z
    .number()
    .min(0)
    .max(100)
    .describe("Estimated match percentage (0-100) between resume and JD"),
});

// ---------------------------------------------------------------------------
// Model — Claude Opus 4.6 with adaptive thinking
// ---------------------------------------------------------------------------

function getAnalysisModel() {
  const base = new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    // temperature must be 1 when thinking is enabled (Anthropic requirement)
    temperature: 1,
    maxTokens: 4096,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    // Adaptive thinking — high effort for thorough extraction
    thinking: {
      type: "enabled",
      budget_tokens: 2048,
    },
  });

  return base.withStructuredOutput(JDAnalysisSchema, {
    name: "jd_analysis",
  });
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert career consultant and resume analyst.

Given a **Job Description (JD)** and a **Master Resume** (JSON-Resume format),
your task is to:

1. Extract the role title and company from the JD.
2. List every hard skill / technology the JD requires.
3. List soft skills or preferred qualities.
4. Identify the key responsibilities that can be mapped to work experience highlights.
5. Identify gaps — things the JD asks for that the master resume does NOT contain.
6. Score the match 0-100.

Be precise. Do not hallucinate skills the candidate has or does not have.`;

// ---------------------------------------------------------------------------
// Node function
// ---------------------------------------------------------------------------

export async function analyseJD(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  const model = getAnalysisModel();

  const masterSummary = JSON.stringify(state.master_resume_json, null, 2);

  const result = (await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `## Job Description\n\n${state.current_jd}\n\n## Master Resume (JSON)\n\n\`\`\`json\n${masterSummary}\n\`\`\``,
    },
  ])) as JDAnalysis;

  return {
    jd_analysis: result,
    status: `Analysis complete — ${result.match_score}% match for ${result.role_title} at ${result.company}`,
  };
}
