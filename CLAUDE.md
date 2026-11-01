# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this project is

A Bun + TypeScript monorepo ("Hammidu Resume", repo `PDFTS`) that turns a
[JSON Resume](https://jsonresume.org/) into a Harvard-style PDF **with the source JSON embedded
inside the PDF as an attachment**, plus an LLM agent that tailors the resume to a job description
and a local web app (Flouka Studio) that wraps the whole thing.

Data flow:

```
json-resume-types  (shared types, no runtime code)
        │
   validator       (AJV + practical checks — runs before every render)
        │
  xebec-render     (JSON → HTML via Handlebars, Harvard template)
        │
 flouka-studio     (HTML → PDF via Puppeteer, embeds resume.json; also the web server + SPA)
        │
   extractor       (PDF → JSON, reads the embedded attachment back out)

   agent           (LangGraph: analyse JD → tailor resume → render PDF)

   flouka-mcp      (MCP server over stdio: the pipeline above as tools, no LLM of its own)
```

## Commands

Run everything with `bun` — never `npm`/`node`. Scripts live in the root `package.json`.

| Command                                         | What it does                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `bun install`                                   | Install all workspace dependencies                                                   |
| `bun run web`                                   | Start Flouka Studio at http://localhost:3020 (alias of `flouka:web`, `--watch`)      |
| `bun run roundtrip`                             | Integration check: JSON → HTML → PDF → JSON, asserts the round trip                  |
| `bun run example`                               | xebec-render example (writes HTML into `resumes/`)                                   |
| `bun run validate`                              | Validator example suite                                                              |
| `bun run validator:validate <file>`             | Validate one JSON Resume file                                                        |
| `bun run extract`                               | Extract JSON from `resumes/example_output.pdf`                                       |
| `bun run mcp`                                   | Start the MCP server on stdio (normally launched by a client, not by hand)            |
| `bun run mcp:smoke`                             | End-to-end test of the MCP server against a throwaway store — 58 checks               |
| `bun run agent:cli -- --resume <path> --jd "…"` | Run the full agent graph (A → B → C)                                                 |
| `bun run agent:run`                             | Quick-run script; edit the JD/resume constants at the top of `packages/agent/run.ts` |

Two root scripts are currently dead: `bun run build` calls a `build` script that
`packages/xebec-render` does not define, and `bun test` finds no `bun:test` files — the repo has no
unit tests. `test-roundtrip.ts` and `packages/flouka-mcp/smoke.ts` are the de facto integration
tests; the latter is the broader of the two, since it drives the real pipeline through the MCP
protocol.

## Repo conventions

- **Bun runtime, no build step.** TypeScript is executed directly; `tsconfig` uses
  `"module": "Preserve"`, `"moduleResolution": "bundler"`, `"noEmit": true`, strict mode plus
  `noUncheckedIndexedAccess` and `noImplicitOverride`.
- **Workspace imports.** Packages depend on each other by name (`xebec-render`, `validator`,
  `json-resume-types`, …) via `workspace:*`, not relative paths. The exception is
  `packages/flouka-studio/web-server.ts`, which reaches into `../agent/src/*` directly.
- **`.js` extensions in imports** inside `packages/agent` (`./graph.js` for `graph.ts`) — ESM style,
  resolved by Bun. Match the surrounding file rather than normalising.
- **Comment style.** Files open with a block comment explaining the module's role, and sections are
  separated by `// ---…---` rulers. Keep that density; the codebase explains *why*, not *what*.
- **`_*.md` is gitignored** — files like `.github/_copilot-instructions.md` are local-only notes.

## Things that are easy to get wrong

- **Model registry has two homes.** `packages/agent/src/model.ts` (`MODEL_KEYS`, `DEFAULT_MODEL`,
  `MAX_OUTPUT_TOKENS`) is the source of truth, but the web UI repeats the list in
  `MODEL_OPTIONS`/`DEFAULT_SETTINGS.modelKey` in
  `packages/flouka-studio/public/js/constants.js`. Adding or renaming a model means editing both.
- **A validation *warning* makes a resume invalid.** `buildResult()` in
  `packages/validator/src/index.ts` returns `valid: false` when there are any issues, warnings
  included, so a missing phone number blocks `/api/preview` and `/api/generate-pdf`, not just the
  schema errors.
- **DeepSeek takes a different structured-output path.** Anthropic models use native tool-call
  structured output; DeepSeek goes through `jsonMode` plus a `fieldNamesInstruction` prompt suffix,
  and its models think by default, burning token budget on chain-of-thought — hence the larger
  `MAX_OUTPUT_TOKENS` and the parse-failure retry (`invokeWithRepair`) in `tailor-resume.ts`.
- **The tailoring node selects skills/education by index**, then `mergeResume` filters the master
  arrays. Anything the model invents is dropped; an empty selection falls back to the full master
  list so a bad response can never wipe a section.
- **The frontend has no modules and no build.** `packages/flouka-studio/public/` holds the markup
  (`index.html`), `css/` and `js/` (hash router, `Store`, page objects). No framework, no bundler.
  The scripts are classic `<script src>` tags sharing one global scope, because the inline `onclick`
  handlers depend on it, so the tag order in `index.html` matters: utilities before pages, `main.js`
  last. CSS order is the cascade, with `utilities.css` last. **Monaco** is loaded from jsDelivr, so
  the app needs a network connection even though the data is local.
- **State lives in SQLite, not localStorage in anymore.** `packages/flouka-studio/storage.ts` is a key-value
  table (`flouka_master`, `flouka_settings`, `flouka_apps`) served by `GET /api/store` and
  `PUT /api/store/:key`; the browser keeps a write-through cache with debounced writes. A one-time
  `_migrateFromLocalStorage()` still exists for older installs. The agent separately checkpoints
  LangGraph state via `BunSqliteSaver`.
- **Generated artefacts land in `resumes/`** — the agent's PDF output directory defaults there
  (`AGENT_PDF_DIR`). The directory already contains committed sample resumes; don't tidy it.
- **`AGENT_PDF_DIR` is relative in `.env`** (`../../resumes`), which only works because every
  consumer runs under `bun run --cwd packages/<name>`. Anything launched with a different cwd — an
  MCP client, for instance — must resolve it itself; `packages/flouka-mcp/src/render.ts` resolves
  it against its own package directory for exactly this reason.
- **The MCP server must never write to stdout.** stdout is its JSON-RPC channel, so a stray
  `console.log` anywhere in `packages/flouka-mcp` (or in anything it imports on the render path)
  breaks the connection with no useful error. That is why it calls `generatePDF` + `Bun.write`
  rather than `generatePDFToFile`, which logs. `smoke.ts` catches regressions here.
- **MCP validation is deliberately laxer than the web UI's.** `render_resume_pdf` blocks only on
  schema *errors*; warnings come back in the result, with `strict: true` to restore the
  `/api/generate-pdf` behaviour. Without that, the warnings-make-it-invalid rule above would make
  a resume unrenderable over MCP with no way through.
- **`flouka-studio` now has an `exports` map** (`.` and `./storage`) so `flouka-mcp` can import the
  store by workspace name. Adding a new subpath import from that package means adding it there too.
- **An application's `config` is settings-shaped, not `GenerateConfig`-shaped.** Records in
  `flouka_apps` carry an extra `removedSections` that only the SPA's layout editor reads;
  `appRenderConfig()` in `public/js/utils.js` strips it before rendering. `createApplication` in
  `packages/flouka-mcp/src/store.ts` inherits from `flouka_settings` and derives `removedSections`
  from a trimmed `sectionOrder`, so a section the model drops stays restorable in the web UI.
- **`ALL_SECTIONS` in the SPA and `DEFAULT_SECTION_ORDER` in xebec-render are different orders.**
  The SPA's list leads with summary/work/education, xebec's with summary/education/work. An
  application config follows the SPA's, a render default follows xebec's; don't "fix" one to match.

## Environment

Copy `.env.example` to `.env` at the repo root. `packages/agent/src/env.ts` loads it explicitly
(imported first by `cli.ts`, `run.ts` and the web server) because Bun only auto-loads `.env` from
the process cwd.

| Variable            | Required            | Purpose                                                                           |
| ------------------- | ------------------- | --------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | for Claude models   | Claude API key                                                                    |
| `DEEPSEEK_API_KEY`  | for DeepSeek models | DeepSeek API key                                                                  |
| `AGENT_DB_PATH`     | no                  | LangGraph checkpoint SQLite path (default `:memory:`, CLI default `agent.sqlite`) |
| `AGENT_PDF_DIR`     | no                  | Where the agent writes PDFs (default `resumes/`)                                  |
| `FLOUKA_DB_PATH`    | no                  | Flouka Studio store path (default `packages/flouka-studio/data/flouka.sqlite`)    |
| `FLOUKA_PORT`       | no                  | Flouka Studio web server port (default `3020`)                                    |

## Working style in this repo

- Don't run `echo`/`sleep` commands that have no functional effect, and don't `cat` a file into
  itself to append lines — edit the file directly.
- Prefer `bun run <script>` from the repo root over `cd`-ing into a package.
- The `feat/flouka-tauri-desktop` branch is an unmerged experiment and has drifted behind `main`
  (it predates the SQLite store and the validator rewrite). Don't cherry-pick from it blindly.
