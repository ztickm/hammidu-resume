/**
 * Node B — Structured Tailoring
 *
 * Uses Claude Opus 4.6 with `.withStructuredOutput()` to rewrite:
 *   - basics.summary
 *   - work[].highlights
 *
 * and to select only the JD-relevant subset of:
 *   - skills[] (groups and their keywords)
 *   - education[] (entries and their courses)
 *
 * The output is validated against TailoredResumeSchema (Zod) and then
 * merged back into the full master resume to produce tailored_resume_json.
 */

import type { Education, ResumeSchema, Skill, Work } from "json-resume-types";
import type { GraphStateType } from "../state.js";
import { TailoredResumeSchema, type TailoredResume } from "../schemas.js";
import { createChatModel, structuredOutputMethod, fieldNamesInstruction, DEFAULT_MODEL, type ModelKey } from "../model.js";

function getTailoringModel(modelKey: ModelKey) {
  return createChatModel(modelKey, { maxTokens: 8192 }).withStructuredOutput(
    TailoredResumeSchema,
    { name: "tailored_resume", ...structuredOutputMethod(modelKey) }
  );
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
- For each work entry, select the most relevant 3 or 4 bullets to the JD and JD analysis then **lightly edit** the original bullets — do NOT rewrite from scratch
- Preserve every fact, metric, and number from the original.
- Swap generic terms for the JD's specific terminology where natural (e.g. "API" → "REST API" if the JD says REST).
- Reorder bullets so the most JD-relevant one comes first.
- If a bullet has zero relevance to the JD, and shows no value of the applicant, remove it if there are already enough bullets for that role. (Aim for 3-4 strong bullets per role, but fewer if the original had fewer.)

### skills
Keep ONLY the skill groups and keywords that are relevant to this role.
- Reference each group by its 0-based \`index\` from the "Original skills" list below.
- A keyword is relevant if the JD names it, it is an obvious equivalent or prerequisite of something the JD names (e.g. keep "PostgreSQL" for a JD asking for SQL), or it directly supports a key responsibility.
- Copy kept keywords **verbatim** from the original — never invent, rename, or reword one. Anything you do not list is dropped from the resume.
- Order kept keywords most-relevant-first, and list groups most-relevant-group-first.
- Omit a group entirely when none of its keywords are relevant.
- Do not strip the section down to one or two keywords: keep the strongest relevant ones (roughly 8-15 across all groups when the master resume has that many), just not the irrelevant tail.

### education
Keep ONLY the education entries that are relevant to this role.
- Reference each entry by its 0-based \`index\` from the "Original education" list below, and list them in the master resume's original order.
- Always keep the highest and most recent degree — education is rarely irrelevant. Drop an entry only when it is clearly unrelated to the role AND the candidate has stronger, more relevant education elsewhere in the list.
- If an entry lists \`courses\`, you may return a relevant subset in \`courses\` (verbatim). Omit that field to keep them all.

## Hard rules
- Do NOT fabricate accomplishments, numbers, technologies, skills, courses, or degrees.
- Company names, job titles, and dates must be copied verbatim from the master resume.
- Return ALL work entries in the original order, even if you make no changes to them.
- Only use \`index\` values that exist in the lists given below.`;

// ---------------------------------------------------------------------------
// Merge helper
// ---------------------------------------------------------------------------

/**
 * Keeps only the requested entries of `original`, matched case-insensitively
 * and returned in the model's order but with the master resume's exact
 * spelling. Anything the model invented is silently dropped.
 */
function keepOriginals(original: string[], requested: string[]): string[] {
  const byLower = new Map(original.map((o) => [o.trim().toLowerCase(), o]));
  const kept: string[] = [];

  for (const req of requested) {
    const match = byLower.get(req.trim().toLowerCase());
    if (match && !kept.includes(match)) kept.push(match);
  }

  return kept;
}

/** Filters skill groups + their keywords down to the model's selection. */
function filterSkills(master: Skill[], selection: TailoredResume["skills"]): Skill[] {
  const kept: Skill[] = [];
  const seen = new Set<number>();

  for (const sel of selection) {
    const src = master[sel.index];
    if (!src || seen.has(sel.index)) continue;
    seen.add(sel.index);

    if (!src.keywords?.length) {
      kept.push(src);
      continue;
    }

    const keywords = keepOriginals(src.keywords, sel.keywords ?? []);
    // A group whose keywords were all judged irrelevant is dropped entirely.
    if (keywords.length) kept.push({ ...src, keywords });
  }

  // Never let a bad selection wipe the section out.
  return kept.length ? kept : master;
}

/** Filters education entries + their courses down to the model's selection. */
function filterEducation(
  master: Education[],
  selection: TailoredResume["education"]
): Education[] {
  const selected = new Map<number, string[] | undefined>();

  for (const sel of selection) {
    if (master[sel.index] && !selected.has(sel.index)) {
      selected.set(sel.index, sel.courses);
    }
  }

  if (selected.size === 0) return master;

  // Master order is preserved — education reads chronologically, not by relevance.
  return master.flatMap((entry, i) => {
    if (!selected.has(i)) return [];

    const requestedCourses = selected.get(i);
    if (!requestedCourses || !entry.courses?.length) return [entry];

    const courses = keepOriginals(entry.courses, requestedCourses);
    if (courses.length === 0) {
      const { courses: _dropped, ...rest } = entry;
      return [rest];
    }
    return [{ ...entry, courses }];
  });
}

export function mergeResume(
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

  // Filter skills / education down to what the model judged relevant
  if (merged.skills?.length && tailored.skills) {
    merged.skills = filterSkills(merged.skills, tailored.skills);
  }

  if (merged.education?.length && tailored.education) {
    merged.education = filterEducation(merged.education, tailored.education);
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Node function
// ---------------------------------------------------------------------------

export async function tailorResume(
  state: GraphStateType,
  config?: { configurable?: { model_key?: ModelKey; prompt_addition?: string } }
): Promise<Partial<GraphStateType>> {
  if (!state.jd_analysis) {
    throw new Error("tailorResume called before JD analysis — missing jd_analysis in state");
  }

  const modelKey: ModelKey = config?.configurable?.model_key ?? DEFAULT_MODEL;
  const promptAddition = config?.configurable?.prompt_addition ?? "";
  const model = getTailoringModel(modelKey);

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

  // Render skills / education with their indices — the model selects by index
  const masterSkills = state.master_resume_json.skills ?? [];
  const originalSkills = masterSkills
    .map(
      (s, i) =>
        `[${i}] ${s.name ?? "(unnamed group)"}${s.level ? ` — ${s.level}` : ""}\n` +
        `  ${(s.keywords ?? []).join(", ")}`
    )
    .join("\n\n");

  const masterEducation = state.master_resume_json.education ?? [];
  const originalEducation = masterEducation
    .map(
      (e, i) =>
        `[${i}] ${e.studyType ?? ""} ${e.area ?? ""} @ ${e.institution ?? ""}` +
        ` (${e.startDate ?? "?"} – ${e.endDate ?? "present"})` +
        (e.courses?.length ? `\n  courses: ${e.courses.join(", ")}` : "")
    )
    .join("\n\n");

  const keyResponsibilities = state.jd_analysis.key_responsibilities.join("\n- ");

  const systemContent = SYSTEM_PROMPT +
    (promptAddition ? `\n\n## Additional Instructions from User\n${promptAddition}` : "") +
    fieldNamesInstruction(
      modelKey,
      [
        "basics (with fields: label, summary)",
        "work (array of objects with fields: name, position, highlights)",
        "skills (array of objects with fields: index, keywords)",
        "education (array of objects with fields: index, courses)",
      ]
    );

  const result = (await model.invoke([
    { role: "system", content: systemContent },
    {
      role: "user",
      content: [
        `## JD Analysis\n\`\`\`json\n${analysisContext}\n\`\`\``,
        `## Key responsibilities to foreground (from JD Analysis)\n- ${keyResponsibilities}`,
        `## Job Description\n${state.current_jd}`,
        `## Original work highlights (edit these — do not rewrite from scratch)\n${originalBullets}`,
        `## Original skills (select relevant groups/keywords by index — anything omitted is dropped)\n${originalSkills || "(none)"}`,
        `## Original education (select relevant entries by index — anything omitted is dropped)\n${originalEducation || "(none)"}`,
        `## Full Master Resume (JSON)\n\`\`\`json\n${masterJson}\n\`\`\``,
        `Now produce the tailored output. Remember: edit the original bullets above, preserve all facts and metrics, and copy kept skills/courses verbatim.`,
      ].join("\n\n"),
    },
  ])) as TailoredResume;

  const merged = mergeResume(state.master_resume_json, result);

  const keptKeywords = (merged.skills ?? []).reduce(
    (n, s) => n + (s.keywords?.length ?? 0),
    0
  );
  const masterKeywords = masterSkills.reduce(
    (n, s) => n + (s.keywords?.length ?? 0),
    0
  );

  return {
    tailored_resume_json: merged,
    status:
      `Tailoring complete — summary and ${result.work.length} work entries rewritten, ` +
      `${keptKeywords}/${masterKeywords} skills and ` +
      `${merged.education?.length ?? 0}/${masterEducation.length} education entries kept`,
  };
}
