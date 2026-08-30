# Hammidu Resume - JSON Resume to PDF

Your resume as a PDF that never loses its source data.

[JSON Resume](https://jsonresume.org/) is an open standard for storing your CV as a structured JSON file — version-controllable, portable, and tool-friendly.  
Hammidu Resume takes that JSON and produces a professionally formatted PDF with the original JSON silently embedded inside it as an attachment. The PDF looks great for humans; the attachment keeps the data alive for tools (AIs, ATSs, etc).


## What problem does this solve?

PDF resumes are a dead end. Once you export to PDF you lose the structured data — you can't programmatically update it, parse it, or feed it into other tools without starting from scratch.

Hammidu Resume solves this by treating the PDF as a **container**, not just a document:

- The **visible PDF** is a clean, print-ready resume in Harvard CV style.
- The **embedded attachment** (`resume.json`) is the full source JSON Resume, recoverable at any time.

This means you can hand a recruiter a normal-looking PDF while keeping the machine-readable source intact inside the same file. If you lose your original `.json` file, you can extract it back out of the PDF and more importantly ATSs will be get that info easily and won't make you re-fill all the forms.

---

## Flouka Studio : the easiest way to use this project

Flouka Studio is a web app that runs on your computer. It is a full resume management tool: store your master resume, paste job descriptions, let AI tailor your resume for each application, chat with the AI to refine it, and download the result as PDF, HTML, or JSON.

**Step 1 — Install dependencies** (one time only):
```bash
bun install
```

**Step 2 — Add your API key.** Copy `.env.example` to `.env` and fill in `ANTHROPIC_API_KEY` (and/or `DEEPSEEK_API_KEY` if you want to use DeepSeek models). Only the AI tailoring features need a key — rendering and validation work without one.

**Step 3 — Start the app:**
```bash
bun run web
```

**Step 4 — Open your browser and go to:**
```
http://localhost:3020
```

On first visit you'll be guided through a short onboarding to set up your master resume (paste JSON, upload a file, or fill in a step-by-step form). After that:

1. **Dashboard** — see all your job applications at a glance with match scores
2. **New Job Application** — paste a job description; AI tailors your resume and creates a named application automatically
3. **Application detail** — a live PDF preview pinned to the side, next to three tabs: JSON editor (Monaco), layout configurator (section order, page breaks, font, line height, locale), and JD analysis (match score, skill gaps, key responsibilities). A chat sidebar lets you ask for further edits in plain language
4. **Settings** — choose the AI model, add custom instructions to the tailoring prompt, and set rendering defaults
5. **Master Resume** — edit your base resume at any time; existing applications are unaffected

Your data is stored locally in a SQLite database at `packages/flouka-studio/data/flouka.sqlite` — nothing leaves your machine except the API calls to Claude/DeepSeek for tailoring. (The editor itself is loaded from a CDN, so the app needs a network connection.)

To stop the app, press `Ctrl+C` in the terminal.

---


## Packages

### `xebec-render` — JSON → HTML
Turns your JSON Resume into a styled HTML document. No browser required. Use this if you only need HTML output, want to build your own PDF pipeline, or want to render resumes server-side without heavy dependencies.

- Harvard CV format (single-column, serif, print-ready)
- Configurable section order, font size, line height, and page breaks
- Section headings localised in English, German, French, or Arabic
- Validates the resume before rendering and gives you clear error messages

### `flouka-studio` — PDF generator + full web application
Takes the HTML from `xebec-render`, prints it to a pixel-perfect PDF, and embeds the original JSON as an attachment inside the PDF. Also ships a multi-page web application for managing resumes and job applications.

- What you see in the browser preview is exactly what you get in the PDF
- The embedded JSON can be extracted back out at any time (see `extractor`)
- Manage multiple job applications: AI tailoring, AI chat refinement, per-application layout config, PDF/HTML/JSON download
- Persists everything in a local SQLite file; no account or cloud database required

### `agent` — AI resume tailoring
A LangGraph pipeline with three nodes: Node A analyses the job description and scores the match; Node B rewrites `basics.label`, `basics.summary`, and `work[].highlights` and selects the JD-relevant subset of `skills` and `education`; Node C renders the result to PDF. Supports Claude (Opus 4.5, Sonnet 4.6, Sonnet 4.5) and DeepSeek (Chat, Reasoner) models. Exposed via `/api/tailor` in the web server and usable standalone via CLI.

### `validator` — catch errors before they reach the PDF
Validates your JSON Resume against the official schema and runs a second layer of practical checks: is there a name? contact info? are the dates valid ISO8601? This runs automatically before any render, so you get a clear error message instead of a broken PDF.

- Use the CLI to validate any `.json` file
- Use the API to validate programmatically

### `extractor` — get your JSON back out of a PDF
If you have a PDF generated by `flouka-studio`, this package pulls the embedded `resume.json` back out. The extracted data is identical to what went in — verified by the round-trip test.

### `json-resume-types` — shared TypeScript types
The JSON Resume schema as TypeScript types. Used internally by all packages; also usable on its own if you just need the types.

## Getting Started

```bash
# Install dependencies for all packages
bun install

# Configure API keys (only needed for AI tailoring)
cp .env.example .env
```

---

### Available Scripts

**Flouka Studio (PDF Generator & Web UI):**
- `bun run web` - Start web interface at http://localhost:3020
- `bun run flouka:web` - Same as above
- `bun run flouka:example` - Generate PDF from example resume

**Agent (AI tailoring):**
- `bun run agent:cli -- --resume <path> --jd "<text>"` - Tailor a resume and render the PDF
- `bun run agent:run` - Quick-run script (edit the JD and resume path at the top of `packages/agent/run.ts`)
- `bun run agent:example` - Programmatic example

**Xebec Render (HTML Generator):**
- `bun run example` - Generate HTML from example resume
- `bun run xebec:example` - Same as above
- `bun run xebec:test` - Test validator integration

**Validator:**
- `bun run validate` - Run comprehensive validator test suite
- `bun run validator:example` - Same as above
- `bun run validator:validate <file.json>` - Validate a JSON file (paths resolve relative to `packages/validator`, e.g. `../../resumes/example_input.json`)

**Extractor (PDF to JSON):**
- `bun run extract` - Extract JSON Resume from generated PDF
- `bun run extractor:example` - Same as above

**Round-Trip Test:**
- `bun run roundtrip` - Test complete workflow: JSON → HTML → PDF → JSON

### Environment Variables

Set these in `.env` at the repo root (see `.env.example`).

| Variable            | Required            | Description                                                                   |
| ------------------- | ------------------- | ----------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | for Claude models   | Claude API key                                                                |
| `DEEPSEEK_API_KEY`  | for DeepSeek models | DeepSeek API key                                                              |
| `AGENT_DB_PATH`     | no                  | SQLite path for LangGraph checkpoints (CLI default `agent.sqlite`)            |
| `AGENT_PDF_DIR`     | no                  | Where the agent writes PDFs (default: `resumes/`)                             |
| `FLOUKA_DB_PATH`    | no                  | Flouka Studio database (default: `packages/flouka-studio/data/flouka.sqlite`) |

### Manual Package Usage

If you prefer working within each package:

```bash
# Validate a JSON Resume file
cd packages/validator
bun cli.ts ../../resumes/example_input.json

# Try the xebec-render library (HTML generation only)
cd packages/xebec-render
bun example.ts

# Try the flouka-studio PDF generator
cd packages/flouka-studio
bun example.ts

# Start the web interface
cd packages/flouka-studio
bun --watch web-server.ts
# Open http://localhost:3020 in your browser
```

## Project Structure

```
PDFTS/
├── packages/
│   ├── json-resume-types/ # TypeScript type definitions
│   │   ├── index.ts
│   │   └── README.md
│   │
│   ├── xebec-render/      # HTML rendering library (lightweight)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── html-generator.ts
│   │   │   ├── config.ts          # GenerateConfig, section names, locales
│   │   │   ├── helpers.ts
│   │   │   └── templates/
│   │   │       ├── harvard-configurable.hbs
│   │   │       └── harvard.hbs
│   │   └── example.ts
│   │
│   ├── flouka-studio/     # PDF generation + Web UI
│   │   ├── src/
│   │   │   └── index.ts           # generatePDF (Puppeteer + pdf-lib)
│   │   ├── public/
│   │   │   └── index.html         # the entire SPA (markup, CSS, JS)
│   │   ├── web-server.ts          # Bun.serve + JSON API
│   │   ├── storage.ts             # SQLite key-value store
│   │   ├── data/                  # flouka.sqlite (gitignored)
│   │   └── example.ts
│   │
│   ├── agent/             # LangGraph AI tailoring
│   │   ├── src/
│   │   │   ├── graph.ts           # node wiring + retries + checkpointing
│   │   │   ├── state.ts           # GraphState / JDAnalysis
│   │   │   ├── model.ts           # model registry (Claude + DeepSeek)
│   │   │   ├── schemas.ts         # Zod schemas for structured output
│   │   │   ├── bun-sqlite-saver.ts
│   │   │   ├── env.ts
│   │   │   ├── cli.ts
│   │   │   └── nodes/
│   │   │       ├── analyse-jd.ts
│   │   │       ├── tailor-resume.ts
│   │   │       └── trigger-pdf.ts
│   │   └── run.ts
│   │
│   ├── validator/         # JSON Resume validator
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── cli.ts
│   │   └── example.ts
│   │
│   └── extractor/         # PDF to JSON extractor
│       ├── src/
│       │   └── index.ts
│       └── example.ts
│
├── resumes/             # Sample inputs and generated outputs
├── test-roundtrip.ts    # JSON → HTML → PDF → JSON integration test
├── CLAUDE.md            # Notes for AI coding agents
├── package.json         # Monorepo root
└── README.md
```


## Roadmap

### ✅ v1 — Core pipeline (released, `main`)
- [x] JSON Resume → HTML via Handlebars (Harvard CV style)
- [x] HTML → PDF via Puppeteer (headless Chrome)
- [x] `resume.json` embedded as a PDF attachment (pdf-lib)
- [x] PDF metadata: title, author, subject, keywords
- [x] Configurable section order, font size, line height, page breaks
- [x] JSON Resume schema validator with practical error messages (AJV + CLI)
- [x] PDF → JSON extractor (round-trip restoration, FlateDecode support)
- [x] Web UI: live preview, PDF download, section ordering, font controls
- [x] Footer with page numbers on every page
- [x] Round-trip test: JSON → HTML → PDF → JSON ✓

### ✅ v2 — AI tailoring + Flouka Studio multi-page app (released, `main`)
- [x] LangGraph agent: Node A analyses JD + scores match, Node B tailors `basics.label`, `basics.summary`, `work[].highlights`, and selects relevant `skills` / `education`
- [x] Multi-model support: Claude Opus 4.5 / Sonnet 4.6 / Sonnet 4.5 + DeepSeek Chat & Reasoner
- [x] Per-call `promptAddition` to inject custom tailoring instructions
- [x] Chat sidebar: refine a tailored resume conversationally (tool-calling on Claude, JSON mode on DeepSeek)
- [x] Flouka Studio rewritten as a multi-page SPA (hash routing, no framework)
- [x] Onboarding wizard: paste JSON, upload file, or guided step-by-step builder
- [x] Dashboard: application cards with match scores, quick PDF download/delete
- [x] New Job Application flow: paste JD → AI tailors → named application created automatically
- [x] Application detail: always-visible preview beside Edit JSON (Monaco) / Configure layout / JD Analysis tabs
- [x] Per-application layout config (section order, page breaks, font, line height, locale)
- [x] Download as PDF, HTML, or JSON per application; PDF filename includes the company
- [x] Settings page: model selector, tailoring prompt addition, render defaults
- [x] Master Resume page: view, edit, upload, download
- [x] Locale/language selector for resume output (en, de, fr, ar)
- [x] Server-side SQLite persistence (survives clearing browser storage), with one-time migration from `localStorage`

### 🚧 v3 — Flouka Studio desktop app (paused, `feat/flouka-tauri-desktop`)
An unmerged experiment that replaces the browser + Bun server with a native desktop app built with [Tauri](https://tauri.app). The branch predates the SQLite store and the validator rewrite on `main`, so it needs a rebase before work continues.

- [x] Tauri v2 app shell
- [x] Dual-mode frontend: `window.FloukaBridge` in desktop, `fetch('/api/...')` in browser
- [x] Print-to-PDF via `WKWebView.createPDF()` on macOS (no Puppeteer)
- [x] Native Save dialog via Tauri
- [ ] Browser-side validation without bundling AJV (blocker in production builds)
- [ ] Show download dialog / open downloaded file
- [ ] Windows: `CoreWebView2.PrintToPdfAsync()` Rust plugin
- [ ] Code signing & notarization
- [ ] Distributable installers: `.dmg`, `.msi`, `.AppImage` / `.deb`

### 🗓 v4 — Planned
- [ ] Multiple CV templates (beyond Harvard)
- [ ] Custom font embedding for cross-platform consistency
- [ ] Color scheme options
- [ ] Fully keyboard accessible
- [ ] Automated test suite (only the round-trip script exists today)
- [ ] Published releases

---

## Development

Built with [Bun](https://bun.sh) — use `bun`, not `npm`/`node`. An optional Nix shell is available via `shell.nix`.

There is no build step: Bun runs the TypeScript directly. `bun run roundtrip` is the closest thing to a test suite; see `CLAUDE.md` for architecture notes and known rough edges.

## Disclaimer

Parts of this project are written with AI tools. Do with that information what you will.
