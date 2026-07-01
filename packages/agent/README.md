# Agent — LangGraph Resume Tailoring

A stateful LangGraph agent that takes a **Master Resume** (JSON-Resume format) and a **Job Description**, then produces a tailored resume. Nodes A and B are also exposed via the Flouka Studio web server at `/api/tailor`.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Node A:    │────▶│  Node B:         │────▶│  Node C:       │
│  Analyse JD │     │  Tailor Resume   │     │  Generate PDF  │
│             │     │  (structured out)│     │  (xebec+flouka)│
└─────────────┘     └──────────────────┘     └────────────────┘

State persisted via SqliteSaver across sessions.
```

The Flouka Studio web app runs Nodes A and B directly (no Node C — PDF generation is a separate client-triggered step).

### Nodes

| Node | Purpose | Model |
|---|---|---|
| **A — Analyse JD** | Extract requirements from JD, map against master resume, score match 0–100 | Claude Opus 4.8 + structured output |
| **B — Tailor Resume** | Rewrite `basics.label`, `basics.summary`, and `work[].highlights` | Claude Opus 4.8 + structured output |
| **C — Generate PDF** | Render tailored JSON → HTML (xebec-render) → PDF (flouka-studio/Puppeteer) | Local (no LLM) |

### State

```typescript
{
  user_id: string;
  master_resume_json: ResumeSchema;
  current_jd: string;
  jd_analysis: JDAnalysis | null;     // output of Node A
  tailored_resume_json: ResumeSchema | null;  // output of Node B
  pdf_output_url: string | null;
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

## Supported models

Pass `model_key` via the LangGraph `configurable` to switch models:

| Key | Provider |
|---|---|
| `claude-opus-4-8` | Anthropic (default) |
| `claude-sonnet-4-6` | Anthropic |
| `claude-haiku-4-5` | Anthropic |
| `deepseek-chat` | DeepSeek |

## Node B — `prompt_addition`

Node B accepts an optional `prompt_addition` string via `configurable`. It is appended to the system prompt under an `## Additional Instructions from User` heading, letting callers inject per-call tailoring guidance without modifying the code.

```typescript
const config = {
  configurable: {
    model_key: "claude-opus-4-8",
    prompt_addition: "Always prefer concise one-line bullets.",
  },
};
const result = await tailorResume(state, config);
```

The Flouka Studio web app exposes this as the **Tailoring Prompt Addition** field in Settings.

## Usage

### CLI

```bash
ANTHROPIC_API_KEY=sk-... bun run src/cli.ts \
  --resume ../../resumes/json_resume.json \
  --jd "Senior Backend Engineer at Acme Corp…" \
  --user user_123 \
  --db agent.sqlite
```

### Programmatic

```typescript
import { runAgent } from "agent";

const result = await runAgent({
  user_id: "user_123",
  master_resume_json: myResume,
  current_jd: "We are looking for…",
});

console.log(result.tailored_resume_json);
console.log(result.pdf_output_url);
```

### Via Flouka Studio web server

```bash
curl -X POST http://localhost:3001/api/tailor \
  -H "Content-Type: application/json" \
  -d '{
    "resume": { "...": "..." },
    "jd": "We are looking for…",
    "model": "claude-opus-4-8",
    "promptAddition": "Prefer one-line bullets."
  }'
```

Response:
```json
{
  "tailored_resume": { "...": "..." },
  "jd_analysis": { "role_title": "...", "match_score": 82, "..." : "..." },
  "status": "Tailoring complete — summary and 4 work entries rewritten"
}
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key (required for Claude models) |
| `DEEPSEEK_API_KEY` | ✅ (if using DeepSeek) | DeepSeek API key |
| `AGENT_DB_PATH` | ❌ | SQLite path for checkpointing (default: `agent.sqlite`) |
| `AGENT_PDF_DIR` | ❌ | Directory for generated PDFs (default: `./output`) |
