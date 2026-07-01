# flouka-studio

Puppeteer-based PDF generator for JSON Resume, plus a full-featured web application for managing resumes and job applications.

## Starting the web app

```bash
bun run web
# Open http://localhost:3001
```

## Web application overview

Flouka Studio is a multi-page SPA (hash routing, no framework, vanilla JS + CSS). All data is stored in `localStorage` under the `flouka_*` keys — no account or backend database needed.

### Pages

| Route | Description |
|---|---|
| `#onboarding` | First-visit wizard: paste, upload, or build your master JSON Resume step-by-step |
| `#dashboard` | Card grid of all job applications with match scores and quick actions |
| `#new` | Paste a job description → AI tailors your resume → creates a named application |
| `#app/{id}` | Application detail: Preview / Edit JSON / Configure layout / JD Analysis tabs |
| `#resume` | View and edit your master JSON Resume |
| `#settings` | Global defaults: AI model, tailoring prompt addition, font/locale/section defaults |

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
  config: {
    sectionOrder, pageBreakBefore, pageBreakAfter, removedSections,
    baseFontSize, lineHeight, locale
  }
}
```

### localStorage keys

| Key | Contents |
|---|---|
| `flouka_master` | Master JSON Resume object |
| `flouka_settings` | Global settings (model, promptAddition, render defaults) |
| `flouka_apps` | Array of job application objects |

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/validate` | Validate a JSON Resume; returns `{ valid, errors }` |
| `POST` | `/api/preview` | Render JSON Resume to HTML string for in-browser preview |
| `POST` | `/api/generate-pdf` | Render to PDF (binary); responds with `Content-Disposition: attachment` |
| `POST` | `/api/generate-html` | Render to HTML file download |
| `POST` | `/api/tailor` | Run AI tailoring (Nodes A + B); returns `{ tailored_resume, jd_analysis, status }` |

### `/api/tailor` request body

```json
{
  "resume": { ...json-resume... },
  "jd": "We are looking for…",
  "model": "claude-opus-4-8",
  "promptAddition": "Always prefer concise one-line bullets."
}
```

`model` defaults to `claude-opus-4-8` if omitted. `promptAddition` is appended to the tailoring system prompt.

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

## Development

```bash
bun install
bun run web          # start with auto-reload
bun run example.ts   # generate a PDF from the example resume
```
