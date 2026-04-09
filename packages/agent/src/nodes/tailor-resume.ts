/**
 * Node B — Structured Tailoring
 *
 * Uses Claude Opus 4.6 with `.withStructuredOutput()` to rewrite:
 *   - basics.summary
 *   - work[].highlights
 *
 * The output is validated against TailoredResumeSchema (Zod) and then
 * merged back into the full master resume to produce tailored_resume_json.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import type { ResumeSchema, Work } from "json-resume-types";
import type { GraphStateType } from "../state.js";
import { TailoredResumeSchema, type TailoredResume } from "../schemas.js";

// ---------------------------------------------------------------------------
// Model — Claude Opus 4.6 with high-effort adaptive thinking
// ---------------------------------------------------------------------------

function getTailoringModel() {
  const base = new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    // temperature must be 1 when thinking is enabled (Anthropic requirement)
    temperature: 1,
    maxTokens: 8192,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    // High-effort adaptive thinking for nuanced rewriting
    thinking: {
      type: "enabled",
      budget_tokens: 4096,
    },
  });

  return base.withStructuredOutput(TailoredResumeSchema, {
    name: "tailored_resume",
  });
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert resume writer who tailors resumes for specific job applications.

## Rules

1. **summary**: Rewrite basics.summary to highlight the candidate's fit for the target role.
   - Lead with the most relevant experience/skills.
   - Keep it to 2-3 sentences.
   - Use language that mirrors the JD's tone and keywords.

2. **work[].highlights**: Rewrite each bullet to emphasise relevance to the JD.
   - Preserve factual accuracy — do NOT fabricate accomplishments or numbers.
   - Use the JD's terminology where natural (keyword optimisation).
   - Quantify impact wherever the original bullet already contained metrics.
   - Reorder bullets within each role so the most relevant come first.

3. **Preservation**:
   - Do NOT change company names, job titles, dates, or any other field.
   - Return exactly one entry per work experience, in the same order.

4. **Output format**: Your output must be valid JSON matching the provided schema.`;

// ---------------------------------------------------------------------------
// Merge helper
// ---------------------------------------------------------------------------

function mergeResume(
  master: ResumeSchema,
  tailored: TailoredResume
): ResumeSchema {
  const merged: ResumeSchema = JSON.parse(JSON.stringify(master));

  // Merge summary
  if (merged.basics) {
    merged.basics.summary = tailored.basics.summary;
  }

  // Merge work highlights — match by (name, position) pair
  if (merged.work && tailored.work) {
    for (const tw of tailored.work) {
      const match = merged.work.find(
        (mw: Work) => mw.name === tw.name && mw.position === tw.position
      );
      if (match) {
        match.highlights = tw.highlights;
      }
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Node function
// ---------------------------------------------------------------------------

export async function tailorResume(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  if (!state.jd_analysis) {
    throw new Error("tailorResume called before JD analysis — missing jd_analysis in state");
  }

  const model = getTailoringModel();

  const analysisContext = JSON.stringify(state.jd_analysis, null, 2);
  const masterJson = JSON.stringify(state.master_resume_json, null, 2);

  const result = (await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `## JD Analysis\n\n\`\`\`json\n${analysisContext}\n\`\`\``,
        `## Job Description\n\n${state.current_jd}`,
        `## Master Resume (JSON)\n\n\`\`\`json\n${masterJson}\n\`\`\``,
        "",
        "Now produce the tailored output matching the schema.",
      ].join("\n\n"),
    },
  ])) as TailoredResume;

  const merged = mergeResume(state.master_resume_json, result);

  return {
    tailored_resume_json: merged,
    status: `Tailoring complete — summary and ${result.work.length} work entries rewritten`,
  };
}
