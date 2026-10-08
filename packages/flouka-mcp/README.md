# flouka-mcp

An MCP server that exposes this monorepo's resume pipeline over stdio, so any MCP client
(Claude Code, Claude Desktop) can produce the real Harvard-template PDF — with the source JSON
embedded as a `resume.json` attachment — instead of hand-rolling HTML.

**No model calls happen in this server.** The connected model does the tailoring, which it is
already good at, and this server does the deterministic work: read the stored resume, validate
it, render it, read it back out of a PDF. That means no API key, no second model bill, and no
prompt duplicated between here and `packages/agent`.

## Tools

| Tool | What it does |
| --- | --- |
| `get_master_resume` | The stored master JSON Resume + its layout config |
| `list_applications` | Applications saved in Flouka Studio, summarised (read-only) |
| `get_application` | One application's tailored resume, JD, analysis and config |
| `validate_resume` | Schema + practical checks on an inline resume, a `.json` file, or the master |
| `extract_resume_from_pdf` | Read the embedded `resume.json` back out of a generated PDF |
| `update_master_resume` | Patch the master resume section-wise |
| `replace_master_resume` | Overwrite the master resume wholesale |
| `render_resume_pdf` | → A4 PDF with the JSON embedded; returns the absolute path |
| `render_resume_html` | → the same HTML the PDF is made from, without spawning Chromium |

Resources `flouka://master`, `flouka://master/config` and `flouka://applications` serve the same
data for clients that browse resources. One prompt, `tailor-to-jd`, carries the editorial rules
(select and reframe real content, never invent a tool/metric/date, plain language, one page by
default) and ends by telling the model to call `render_resume_pdf`.

## Running it

```sh
bun run mcp         # from the repo root — starts the server on stdio
bun run mcp:smoke   # end-to-end test: drives the real server with the MCP SDK's client
```

The smoke test runs against a throwaway store and PDF directory, so it never touches the real
master resume or the samples in `resumes/`.

### Claude Code

Already registered by the repo-root `.mcp.json`; `/mcp` should list `flouka` as connected.

### Claude Desktop

Needs absolute paths, since it doesn't launch from the repo:

```json
{
  "mcpServers": {
    "flouka": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/PDFTS/packages/flouka-mcp/src/server.ts"]
    }
  }
}
```

Add `"env": { "FLOUKA_DB_PATH": "…" }` only if the store isn't at its default location.

## Things worth knowing

- **Validation is less strict here than in the web UI, on purpose.** `buildResult()` in
  `packages/validator/src/index.ts` reports `valid: false` for *warnings* too, which is why
  `/api/generate-pdf` refuses a resume with no phone number. Over MCP that would leave the caller
  no way through, so only schema **errors** block a render; warnings come back in the tool result.
  Pass `strict: true` to restore the web server's behaviour.

- **Every master write snapshots first.** The previous `flouka_master` is copied to
  `<store dir>/backups/flouka_master_<timestamp>.json` before `update_master_resume` or
  `replace_master_resume` writes. This matters because the SPA (`public/index.html`) keeps a
  write-through cache: a browser tab left open can overwrite what the MCP just wrote, and will
  show stale data until reloaded. Both tools say so in their result, so the model passes the
  warning along.

- **`update_master_resume` appends unmatched entries.** `work` and `volunteer` entries are matched
  on their identifying fields and shallow-merged; an entry matching nothing is added as a new job
  and named in the result. That makes "I started a new job" a patch rather than a full replace,
  but it also means a typo'd employer name creates a duplicate — hence the explicit callout.
  `replace_master_resume` is the only way to *delete* anything.

- **Applications are read-only.** A resume rendered through MCP does not appear in Flouka Studio's
  application list; the SPA owns `flouka_apps`.

- **stdout is the JSON-RPC channel.** Nothing in this package may `console.log` — all logging goes
  to stderr. This is also why the render path calls `generatePDF` + `Bun.write` instead of
  `generatePDFToFile`, which logs its output path.

- **Paths resolve from the source files, never from cwd**, because an MCP client launches the
  server with whatever cwd it likes. Relative paths in tool arguments resolve against the repo
  root. `AGENT_PDF_DIR` decides where PDFs land (default `resumes/`); the repo's `.env` sets it
  to `../../resumes`, which every other consumer reads under `bun run --cwd packages/<name>`, so
  a relative value is resolved against *this package's* directory — same destination, and it no
  longer follows the client's cwd around. `FLOUKA_DB_PATH` decides where the store lives.

- **Chromium is launched per render** (~1–2 s). No shared browser instance: a long-lived stdio
  server holding one open would leak a process every time a client disconnects untidily.
