/**
 * LangGraph state definition for the resume-tailoring agent.
 *
 * `Annotation.Root` gives us a typed, immutable state that LangGraph
 * serialises/deserialises at every checkpoint boundary.
 */

import { Annotation } from "@langchain/langgraph";
import type { ResumeSchema } from "json-resume-types";

// ---------------------------------------------------------------------------
// JD Analysis produced by Node A
// ---------------------------------------------------------------------------

export interface JDAnalysis {
  /** Role title extracted from the JD */
  role_title: string;
  /** Company name */
  company: string;
  /** Hard skills / technologies mentioned */
  required_skills: string[];
  /** Soft skills / leadership qualities */
  preferred_qualities: string[];
  /** Key responsibilities that map to work.highlights */
  key_responsibilities: string[];
  /** Gaps: master resume skills that are NOT in the JD (for de-emphasis) */
  gaps: string[];
  /** Match score 0–100 */
  match_score: number;
}

// ---------------------------------------------------------------------------
// Graph State
// ---------------------------------------------------------------------------

export const GraphState = Annotation.Root({
  /** Unique user identifier — scopes the SqliteSaver thread. */
  user_id: Annotation<string>,

  /**
   * The canonical master resume that persists across sessions.
   * Written once (or updated by the user), read by every tailoring run.
   */
  master_resume_json: Annotation<ResumeSchema>,

  /** The job description the user wants to tailor for. */
  current_jd: Annotation<string>,

  /** Output of Node A — structured JD analysis. */
  jd_analysis: Annotation<JDAnalysis | null>,

  /**
   * The fully-merged tailored resume, ready for the headless service.
   * `basics.summary` and `work[].highlights` come from Node B; everything
   * else is carried over from `master_resume_json`.
   */
  tailored_resume_json: Annotation<ResumeSchema | null>,

  /** URL returned by the headless PDF service (Node C). */
  pdf_output_url: Annotation<string | null>,

  /** Human-readable status for the UI / CLI. */
  status: Annotation<string>,
});

export type GraphStateType = typeof GraphState.State;
