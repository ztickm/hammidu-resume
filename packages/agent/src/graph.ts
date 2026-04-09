/**
 * LangGraph graph assembly — wires nodes A → B → C with SqliteSaver
 * checkpointing and retry policies.
 */

import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { BunSqliteSaver } from "./bun-sqlite-saver.js";
import { GraphState, type GraphStateType } from "./state.js";
import { analyseJD } from "./nodes/analyse-jd.js";
import { tailorResume } from "./nodes/tailor-resume.js";
import { triggerPdf } from "./nodes/trigger-pdf.js";

// ---------------------------------------------------------------------------
// Retry wrapper
// ---------------------------------------------------------------------------

/**
 * Wrap an async node function with exponential-backoff retries.
 * LangGraph's built-in retry on `addNode` is limited in the TS SDK,
 * so we implement a portable retry at the function level.
 */
function withRetry<S>(
  fn: (state: S) => Promise<Partial<S>>,
  opts: { maxAttempts?: number; baseDelayMs?: number; name?: string } = {}
): (state: S) => Promise<Partial<S>> {
  const { maxAttempts = 3, baseDelayMs = 1000, name = fn.name } = opts;

  return async (state: S): Promise<Partial<S>> => {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn(state);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxAttempts) {
          const delay = baseDelayMs * 2 ** (attempt - 1);
          console.warn(
            `[${name}] Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying in ${delay}ms…`
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw new Error(
      `[${name}] All ${maxAttempts} attempts failed. Last error: ${lastError?.message}`
    );
  };
}

// ---------------------------------------------------------------------------
// Build graph
// ---------------------------------------------------------------------------

export function buildGraph(sqlitePath?: string) {
  // -- Checkpoint persistence -----------------------------------------------
  const dbPath = sqlitePath ?? process.env.AGENT_DB_PATH ?? ":memory:";
  const checkpointer =
    dbPath === ":memory:"
      ? new MemorySaver()
      : BunSqliteSaver.fromConnString(dbPath);

  // -- Graph ----------------------------------------------------------------
  const graph = new StateGraph(GraphState)
    .addNode("analyse_jd", analyseJD)
    .addNode("tailor_resume", tailorResume)
    .addNode(
      "trigger_pdf",
      withRetry(triggerPdf, {
        maxAttempts: 3,
        baseDelayMs: 2000,
        name: "trigger_pdf",
      })
    )
    .addEdge(START, "analyse_jd")
    .addEdge("analyse_jd", "tailor_resume")
    .addEdge("tailor_resume", "trigger_pdf")
    .addEdge("trigger_pdf", END);

  return graph.compile({ checkpointer });
}

// ---------------------------------------------------------------------------
// Convenience runner
// ---------------------------------------------------------------------------

export interface RunInput {
  user_id: string;
  master_resume_json: Record<string, unknown>;
  current_jd: string;
  /** Optional LangGraph thread_id — defaults to `user_id` */
  thread_id?: string;
}

export async function runAgent(input: RunInput): Promise<GraphStateType> {
  const app = buildGraph();

  const result = await app.invoke(
    {
      user_id: input.user_id,
      master_resume_json: input.master_resume_json,
      current_jd: input.current_jd,
      jd_analysis: null,
      tailored_resume_json: null,
      pdf_output_url: null,
      status: "Starting…",
    },
    {
      configurable: {
        thread_id: input.thread_id ?? input.user_id,
      },
    }
  );

  return result as GraphStateType;
}
