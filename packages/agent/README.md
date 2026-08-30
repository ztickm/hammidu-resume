# Agent — LangGraph Resume Tailoring

A stateful LangGraph agent that takes a **Master Resume** (JSON-Resume format) and a **Job Description**, then produces a tailored resume and renders it to PDF. Nodes A and B are also exposed via the Flouka Studio web server at `/api/tailor`.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Node A:    │────▶│  Node B:         │────▶│  Node C:       │
│  Analyse JD │     │  Tailor Resume   │     │  Generate PDF  │
│             │     │  (structured out)│     │  (xebec+flouka)│
└─────────────┘     └──────────────────┘     └────────────────┘

State persisted via BunSqliteSaver across sessions (MemorySaver when AGENT_DB_PATH is ":memory:").
```

The Flouka Studio web app calls Nodes A and B directly as plain functions — it does not run the graph, and PDF generation there is a separate client-triggered step.

### Nodes

| Node                  | Purpose                                                                                                                   | Model                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **A — Analyse JD**    | Extract requirements from JD, map against master resume, score match 0–100                                                | LLM + structured output |
| **B — Tailor Resume** | Rewrite `basics.label`, `basics.summary`, `work[].highlights`; select the relevant subset of `skills` and `education`      | LLM + structured output |
| **C — Generate PDF**  | Render tailored JSON → HTML (xebec-render) → PDF (flouka-studio/Puppeteer), write to disk                                  | Local (no LLM)          |

Node C is wrapped in an exponential-backoff retry (3 attempts) at the graph level.

### State

```typescript
{
  user_id: string;
  master_resume_json: ResumeSchema;
  current_jd: string;
  jd_analysis: JDAnalysis | null;              // output of Node A
  tailored_resume_json: ResumeSchema | null;   // output of Node B
  pdf_output_url: string | null;               // local file path written by Node C
  status: string;
}
```

### JDAnalysis shape (Node A output)

```typescript
{
  role_title: string;
  company: string;
  required_skills: string[];
  preferred_qualities: string[];
  key_responsibilities: string[];
  gaps: string[];          // things the JD asks for that the resume lacks
  match_score: number;     // 0–100
}
```

### How Node B merges its output

Node B does not return a whole resume. It returns four fields, which `mergeResume()` folds into a deep copy of the master resume:

- `basics.label` / `basics.summary` — replaced outright.
- `work[]` — matched to the master by `(name, position)`; only `highlights` is replaced.
- `skills[]` — the model selects groups by 0-based `index` and lists the keywords to keep; kept keywords are matched case-insensitively against the original and re-emitted with the master's exact spelling. Anything invented is dropped, and an empty selection falls back to the full master list.
- `education[]` — same index-based selection, returned in the master's original order, with an optional `courses` subset.

## Supported models

Pass `model_key` via the LangGraph `configurable` (or `--model` on the CLI) to switch models. The registry lives in `src/model.ts`.

| Key                 | Provider            | Model ID                     |
| ------------------- | ------------------- | ---------------------------- |
| `claude-opus-4-5`   | Anthropic (default) | `claude-opus-4-5-20251101`   |
| `claude-sonnet-4-6` | Anthropic           | `claude-sonnet-4-6-20250620` |
| `claude-sonnet-4-5` | Anthropic           | `claude-sonnet-4-5-20251001` |
| `deepseek-chat`     | DeepSeek (V3)       | `deepseek-chat`              |
| `deepseek-reasoner` | DeepSeek (R1)       | `deepseek-reasoner`          |

> The web UI keeps its own copy of this list in `packages/flouka-studio/public/index.html` (`MODEL_OPTIONS`). Update both when adding a model.

### Provider differences

Anthropic models use native tool-call structured output. DeepSeek rejects both `response_format: json_schema` and forced `tool_choice`, so it goes through `jsonMode` (`response_format: json_object`) with the schema injected into the prompt, plus an explicit "use exactly these field names" suffix (`fieldNamesInstruction`).

DeepSeek also bills chain-of-thought against the completion budget, so `deepseek-reasoner` gets 32 768 max output tokens (others get 16 384) and Node B retries once with a "raw JSON only, be terse" instruction when a response fails to parse.

## Node B — `prompt_addition`

Node B accepts an optional `prompt_addition` string via `configurable`. It is appended to the system prompt under an `## Additional Instructions from User` heading, letting callers inject per-call tailoring guidance without modifying the code.

```typescript
const config = {
  configurable: {
    model_key: "claude-opus-4-5",
    prompt_addition: "Always prefer concise one-line bullets.",
  },
};
const result = await tailorResume(state, config);
```

The Flouka Studio web app exposes this as the **Tailoring Prompt Addition** field in Settings.

## Usage

### CLI

```bash
bun run src/cli.ts \
  --resume ../../resumes/json_resume.json \
  --jd "Senior Backend Engineer at Acme Corp…" \
  --user user_123 \
  --model claude-opus-4-5 \
  --db agent.sqlite
```

Or from the repo root: `bun run agent:cli -- --resume … --jd "…"`.

| Flag        | Required | Description                                                     |
| ----------- | -------- | --------------------------------------------------------------- |
| `--resume`  | ✅        | Path to the master JSON Resume                                  |
| `--jd`      | ✅\*      | Job description text                                            |
| `--jd-file` | ✅\*      | …or a path to read it from                                      |
| `--user`    | ❌        | User id, also the checkpoint thread prefix (default `default_user`) |
| `--model`   | ❌        | One of the model keys above (default `claude-opus-4-5`)         |
| `--db`      | ❌        | Checkpoint SQLite path (default `agent.sqlite`)                 |

\* one of `--jd` / `--jd-file`.

The CLI writes the tailored resume to `tailored_resume.json` in the working directory; the PDF path is printed and comes from `AGENT_PDF_DIR`.

`src/cli.ts` currently requires `ANTHROPIC_API_KEY` to be set even when you select a DeepSeek model.

### Quick-run script

`run.ts` is a scratch runner with the resume path, JD and model as constants at the top — edit and `bun run run.ts` (or `bun run agent:run` from the root).

### Programmatic

```typescript
import { runAgent } from "agent";

const result = await runAgent({
  user_id: "user_123",
  master_resume_json: myResume,
  current_jd: "We are looking for…",
  model_key: "claude-opus-4-5",
});

console.log(result.tailored_resume_json);
console.log(result.pdf_output_url);
```

### Via Flouka Studio web server

```bash
curl -X POST http://localhost:3020/api/tailor \
  -H "Content-Type: application/json" \
  -d '{
    "resume": { "...": "..." },
    "jd": "We are looking for…",
    "model": "claude-opus-4-5",
    "promptAddition": "Prefer one-line bullets."
  }'
```

Response:
```json
{
  "tailored_resume": { "...": "..." },
  "jd_analysis": { "role_title": "...", "match_score": 82, "..." : "..." },
  "status": "Tailoring complete — summary and 4 work entries rewritten, 12/28 skills and 2/3 education entries kept"
}
```

## Environment Variables

Loaded from the monorepo root `.env` by `src/env.ts`, which every entrypoint imports first (Bun only auto-loads `.env` from the process cwd). Shell variables always win over the file.

| Variable            | Required              | Description                                                              |
| ------------------- | --------------------- | ------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | ✅                     | Claude API key (required for Claude models)                              |
| `DEEPSEEK_API_KEY`  | ✅ (if using DeepSeek) | DeepSeek API key                                                         |
| `AGENT_DB_PATH`     | ❌                     | SQLite path for checkpointing (`:memory:` by default, `agent.sqlite` from the CLI) |
| `AGENT_PDF_DIR`     | ❌                     | Directory for generated PDFs (default: the repo's `resumes/`)            |
