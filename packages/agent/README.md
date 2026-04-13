# Agent — LangGraph Resume Tailoring

A stateful LangGraph agent that takes a **Master Resume** (JSON-Resume format) and a **Job Description**, then produces a tailored resume and renders it to PDF using the local xebec-render + flouka-studio pipeline.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Node A:    │────▶│  Node B:         │────▶│  Node C:       │
│  Analyse JD │     │  Tailor Resume   │     │  Generate PDF  │
│             │     │  (structured out)│     │  (xebec+flouka)│
└─────────────┘     └──────────────────┘     └────────────────┘

State persisted via SqliteSaver across sessions.
```

### Nodes

| Node                  | Purpose                                                                    | Model                                      |
| --------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| **A — Analyse JD**    | Extract requirements from JD, map against master resume, score match       | Claude Opus 4.6 + structured output        |
| **B — Tailor Resume** | Rewrite `basics.summary` and `work[].highlights`                           | Claude Opus 4.6 + adaptive thinking (high) |
| **C — Generate PDF**  | Render tailored JSON → HTML (xebec-render) → PDF (flouka-studio/Puppeteer) | Local (no LLM)                             |

### State

```typescript
{
  user_id: string;
  master_resume_json: ResumeSchema;   // persisted across threads
  current_jd: string;
  jd_analysis: JDAnalysis | null;
  tailored_resume_json: ResumeSchema | null;
  pdf_output_url: string | null;
  status: string;
}
```

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

## Environment Variables

| Variable            | Required | Description                                             |
| ------------------- | -------- | ------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | ✅        | Claude API key                                          |
| `AGENT_DB_PATH`     | ❌        | SQLite path for checkpointing (default: `agent.sqlite`) |
| `AGENT_PDF_DIR`     | ❌        | Directory for generated PDFs (default: `./output`)      |
