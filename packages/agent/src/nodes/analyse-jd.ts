/**
 * Node A — Resume Analysis
 *
 * Extracts structured requirements from the JD and maps them against the
 * master resume to produce a JDAnalysis object that Node B consumes.
 */

import { z } from "zod";
import type { GraphStateType } from "../state.js";
import type { JDAnalysis } from "../state.js";
import { createChatModel, structuredOutputMethod, fieldNamesInstruction, DEFAULT_MODEL, type ModelKey } from "../model.js";

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

function getAnalysisModel(modelKey: ModelKey) {
  return createChatModel(modelKey, { maxTokens: 4096 }).withStructuredOutput(
    JDAnalysisSchema,
    { name: "jd_analysis", ...structuredOutputMethod(modelKey) }
  );
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
  state: GraphStateType,
  config?: { configurable?: { model_key?: ModelKey } }
): Promise<Partial<GraphStateType>> {
  const modelKey: ModelKey = config?.configurable?.model_key ?? DEFAULT_MODEL;
  const model = getAnalysisModel(modelKey);

  const masterSummary = JSON.stringify(state.master_resume_json, null, 2);

  const systemContent = SYSTEM_PROMPT + fieldNamesInstruction(
    modelKey,
    ["role_title", "company", "required_skills", "preferred_qualities", "key_responsibilities", "gaps", "match_score"]
  );

  const result = (await model.invoke([
    { role: "system", content: systemContent },
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
