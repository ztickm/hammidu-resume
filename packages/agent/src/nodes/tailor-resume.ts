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
    model: "claude-opus-4-5-20251101",
    temperature: 1,
    maxTokens: 8192,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    // The SDK defaults topP to -1 which some models now reject.
    // invocationKwargs merges last into the API body and overrides it.
    invocationKwargs: { top_p: undefined },
  });

  return base.withStructuredOutput(TailoredResumeSchema, {
    name: "tailored_resume",
  });
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert resume writer who tailors resumes for specific job applications.

## Your task

You will receive:
1. A **JD Analysis** — structured extraction of what the role needs, including key responsibilities and required skills.
2. The **Job Description** in full.
3. The **Master Resume** in JSON-Resume format.

Produce a tailored output with the following fields:

### basics.label
Update the professional headline to reflect the target role's title or domain.
- Example: "Senior Backend Engineer" → "Software Engineer — Payroll Systems"
- Keep it concise (3-6 words).

### basics.summary  
Rewrite the summary in 2-3 sentences:
- Open with the most relevant experience for this specific role.
- Weave in 2-3 keywords from the JD's requirements.
- Match the tone of the JD (startup = action-oriented; enterprise = measured).

### work[].highlights
For each work entry, **lightly edit** the original bullets — do NOT rewrite from scratch:
- Preserve every fact, metric, and number from the original.
- Swap generic terms for the JD's specific terminology where natural (e.g. "API" → "REST API" if the JD says REST).
- Reorder bullets so the most JD-relevant one comes first.
- If a bullet has zero relevance to the JD, keep it unchanged — do not remove it.

## Hard rules
- Do NOT fabricate accomplishments, numbers, or technologies.
- Company names, job titles, and dates must be copied verbatim from the master resume.
- Return ALL work entries in the original order, even if you make no changes to them.`;

// ---------------------------------------------------------------------------
// Merge helper
// ---------------------------------------------------------------------------

function mergeResume(
  master: ResumeSchema,
  tailored: TailoredResume
): ResumeSchema {
  const merged: ResumeSchema = JSON.parse(JSON.stringify(master));

  // Merge basics
  if (merged.basics) {
    merged.basics.summary = tailored.basics.summary;
    if (tailored.basics.label) {
      merged.basics.label = tailored.basics.label;
    }
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

  // Render original bullets explicitly so the model edits rather than rewrites
  const originalBullets = (
    (state.master_resume_json as { work?: Array<{ name?: string; position?: string; highlights?: string[] }> }).work ?? []
  )
    .map(
      (w, i) =>
        `[${i}] ${w.position ?? ""} @ ${w.name ?? ""}\n` +
        (Array.isArray(w.highlights) ? w.highlights : []).map((h) => `  • ${h}`).join("\n")
    )
    .join("\n\n");

  const keyResponsibilities = state.jd_analysis.key_responsibilities.join("\n- ");

  const result = (await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `## JD Analysis\n\`\`\`json\n${analysisContext}\n\`\`\``,
        `## Key responsibilities to foreground (from JD Analysis)\n- ${keyResponsibilities}`,
        `## Job Description\n${state.current_jd}`,
        `## Original work highlights (edit these — do not rewrite from scratch)\n${originalBullets}`,
        `## Full Master Resume (JSON)\n\`\`\`json\n${masterJson}\n\`\`\``,
        `Now produce the tailored output. Remember: edit the original bullets above, preserve all facts and metrics.`,
      ].join("\n\n"),
    },
  ])) as TailoredResume;

  const merged = mergeResume(state.master_resume_json, result);

  return {
    tailored_resume_json: merged,
    status: `Tailoring complete — summary and ${result.work.length} work entries rewritten`,
  };
}
