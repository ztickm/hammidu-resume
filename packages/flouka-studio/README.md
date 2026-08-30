# flouka-studio

Puppeteer-based PDF generator for JSON Resume, plus a full-featured web application for managing resumes and job applications.

## Starting the web app

```bash
bun run web
# Open http://localhost:3020
```

## Web application overview

Flouka Studio is a multi-page SPA (hash routing, no framework, vanilla JS + CSS) served from a single file: `public/index.html`. Monaco (the JSON editor) is loaded from jsDelivr, so the page needs a network connection even though your data stays local.

Data is persisted **server-side in SQLite** (`storage.ts`), not in the browser — clearing browser storage no longer loses your resumes. On first load the client hydrates its cache from `GET /api/store`; writes are debounced (500 ms) and sent to `PUT /api/store/:key` in the background. A one-time `_migrateFromLocalStorage()` copies data from installs that predate this change.

### Pages

| Route         | Description                                                                        |
| ------------- | ---------------------------------------------------------------------------------- |
| *(no master)* | First-visit onboarding wizard: paste, upload, or build your master JSON Resume step-by-step |
| `#` (default) | Dashboard — card grid of all job applications with match scores and quick actions   |
| `#new`        | Paste a job description → AI tailors your resume → creates a named application      |
| `#app/{id}`   | Application detail: persistent PDF preview beside Edit JSON / Configure Layout / JD Analysis tabs, plus a chat sidebar |
| `#resume`     | View and edit your master JSON Resume                                              |
| `#settings`   | Global defaults: AI model, tailoring prompt addition, font/locale/section defaults |

The onboarding page is shown for any route while no master resume exists.

### Application object

Each job application stored in `flouka_apps` has this shape:

```javascript
{
  id: string,
  name: string,                // e.g. "Alex Rivera — Senior Engineer @ Stripe"
  createdAt: string,           // ISO 8601
  jd: string,                  // original job description
  jdAnalysis: {
    role_title, company, match_score,
    required_skills, preferred_qualities,
    key_responsibilities, gaps
  },
  tailoredResume: { ...json-resume... },
  chatHistory: [{ role, content }],
  config: {
    sectionOrder, pageBreakBefore, pageBreakAfter, removedSections,
    baseFontSize, lineHeight, locale
  }
}
```

`removedSections` is a UI-only field — it remembers which sections you hid so they can be restored. The renderer only ever sees `sectionOrder`, which excludes them.

### Store keys

Rows in the `kv_store` table of `data/flouka.sqlite` (override the path with `FLOUKA_DB_PATH`). The file is gitignored.

| Key               | Contents                                                 |
| ----------------- | -------------------------------------------------------- |
| `flouka_master`   | Master JSON Resume object                                |
| `flouka_settings` | Global settings (model, promptAddition, render defaults) |
| `flouka_apps`     | Array of job application objects                         |

## API endpoints

| Method | Path                 | Description                                                                        |
| ------ | -------------------- | ---------------------------------------------------------------------------------- |
| `POST` | `/api/validate`      | Validate a JSON Resume; returns `{ valid, errors, warnings, issues, summary }`      |
| `POST` | `/api/preview`       | Render JSON Resume to HTML string for in-browser preview                           |
| `POST` | `/api/generate-pdf`  | Render to PDF (binary); responds with `Content-Disposition: attachment`            |
| `POST` | `/api/generate-html` | Render to HTML file download                                                       |
| `POST` | `/api/tailor`        | Run AI tailoring (agent Nodes A + B); returns `{ tailored_resume, jd_analysis, status }` |
| `POST` | `/api/chat`          | Conversational refinement; returns `{ reply, updated_resume? }`                     |
| `GET`  | `/api/store`         | All persisted values: `{ flouka_master, flouka_settings, flouka_apps }`            |
| `PUT`  | `/api/store/:key`    | Persist one key; body `{ value }`. Unknown keys → 404                             |

`/api/preview`, `/api/generate-pdf` and `/api/generate-html` validate first and return 400 with the validation result if the resume does not pass. Note that the validator treats practical *warnings* as failures too (see `packages/validator`), so a resume missing a phone number will be rejected here.

### `/api/tailor` request body

```json
{
  "resume": { "...": "..." },
  "jd": "We are looking for…",
  "model": "claude-opus-4-5",
  "promptAddition": "Always prefer concise one-line bullets."
}
```

`model` falls back to `claude-opus-4-5` if omitted or unrecognised. `promptAddition` is appended to the tailoring system prompt. Returns 503 if the API key for the chosen provider is missing, 400 if `jd` is empty.

### `/api/chat` request body

```json
{
  "resume": { "...": "..." },
  "jd": "We are looking for…",
  "jdAnalysis": { "...": "..." },
  "messages": [{ "role": "user", "content": "Make the first bullet shorter" }],
  "model": "claude-sonnet-4-6"
}
```

The system prompt pins the current tailored resume, the JD and the analysis. Claude models get an `update_resume` tool; DeepSeek is asked for a `{ reply, update_resume }` JSON object instead. When the model returns edits, the server merges only the allowed fields (`basics.label`/`summary`, `work[]` and `volunteer[]` highlights/summaries matched by name+position, and full replacement of `skills`, `languages`, `projects`) and returns the result as `updated_resume`.

## Programmatic PDF generation

```typescript
import { generatePDF } from "flouka-studio";
import type { ResumeSchema } from "json-resume-types";
import type { GenerateConfig } from "xebec-render";

const resume: ResumeSchema = { /* ... */ };

const config: GenerateConfig = {
  sectionOrder: ["summary", "work", "education", "skills"],
  pageBreakAfter: ["education"],
  baseFontSize: 10,
  lineHeight: 1.4,
};

const pdfBytes = await generatePDF(resume, { config });
await Bun.write("resume.pdf", pdfBytes);
```

`generatePDFToFile(resume, outputPath, config)` is the same thing plus the write.

The PDF is A4, printed with `printBackground`, 0.5 cm margins (1.2 cm at the bottom) and a footer carrying the page number. Afterwards `pdf-lib` attaches the source JSON as `resume.json` (`application/json`) and sets the document title, author, subject, keywords, producer and creator.

## Development

```bash
bun install
bun run web          # start with auto-reload
bun run example.ts   # generate a PDF from the example resume
```

`example-config.ts` and `example-font-sizes.ts` render the same resume under several layout configurations for visual comparison.
