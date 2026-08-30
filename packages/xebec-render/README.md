# xebec-render

Converts a JSON Resume into a styled, print-ready HTML document. Pure Bun/TypeScript — no browser, no Puppeteer. For PDF output, feed the result to [`flouka-studio`](../flouka-studio).

## Features

- ✅ Generate HTML from JSON Resume data
- ✅ Harvard CV format template (single column, serif) rendered with Handlebars
- ✅ Configurable section order, page breaks, font size and line height
- ✅ Section headings localised in English, German, French and Arabic (RTL layout for `ar`)
- ✅ Date formatting helpers (ISO8601 → human-readable)
- ✅ Validates the resume before rendering — invalid input throws instead of producing a broken page
- ✅ Type-safe, no browser dependencies

## Installation

Workspace package — depend on it by name inside this monorepo:

```jsonc
// package.json
"dependencies": { "xebec-render": "workspace:*" }
```

## Usage

```typescript
import { generateHTML, type GenerateConfig } from "xebec-render";
import type { ResumeSchema } from "json-resume-types";

const resume: ResumeSchema = {
  // Your JSON Resume data
};

// Generate HTML with default configuration
const html = generateHTML(resume);

// Or with custom configuration
const config: GenerateConfig = {
  // Custom section order (omit sections you don't want)
  sectionOrder: ["summary", "work", "education", "skills"],

  // Add page breaks
  pageBreakAfter: ["education"],
  pageBreakBefore: ["work"],

  // Compact font size for longer resumes
  baseFontSize: 10,
  lineHeight: 1.4,

  // Section headings in German
  locale: "de",
};
const htmlWithConfig = generateHTML(resume, config);
```

`generateHTML` calls `validateResumeStrict` first and throws an `Error` whose message lists every problem, so callers never have to check a return value.

### Configuration Options

- **`sectionOrder`**: Array of section names to control order and which sections appear
- **`pageBreakBefore`**: Array of section names that should have a page break before them
- **`pageBreakAfter`**: Array of section names that should have a page break after them
- **`baseFontSize`**: Base font size in points (default: 12). Smaller values make more compact resumes
- **`lineHeight`**: Line height multiplier (default: 1.5). Lower values reduce spacing
- **`locale`**: `"en" | "de" | "fr" | "ar"` (default: `"en"`). Translates section headings and the "Present" label; `"ar"` also switches the document to RTL

Available sections: `summary`, `education`, `work`, `volunteer`, `skills`, `languages`, `awards`, `publications`, `projects`, `certificates`, `interests`, `references`

Default order: `summary`, `education`, `work`, `skills`, `languages`, `volunteer`, `awards`, `publications`, `projects`, `certificates`, `interests`, `references`.

### Font Size Recommendations

- **12pt** (default): Standard, highly readable
- **11pt**: Good middle ground
- **10pt**: Compact, still very readable, recommended for longer resumes
- **9pt**: Very compact, professional, fits more content

### Non-standard field

The header template renders `basics.residencyStatus` under the contact line when present. It is not part of the JSON Resume spec (nor of `json-resume-types`), and the official schema tolerates the extra property.

## Exports

| Export | Purpose |
| --- | --- |
| `generateHTML(resume, config?)` | JSON Resume → HTML string |
| `formatDate`, `formatDateOrPresent`, `joinArray` | Handlebars helpers, also usable directly |
| `DEFAULT_SECTION_ORDER`, `DEFAULT_CONFIG` | Defaults used when config fields are omitted |
| `validateResume`, `validateResumeStrict`, `validateResumeString`, `validateResumeFile` | Re-exported from `validator` for convenience |
| Types: `ResumeSchema`, `GenerateConfig`, `SectionName`, `ValidationResult`, `JsonResumeTypes` | |

## Templates

- `src/templates/harvard-configurable.hbs` — the template actually used; reads section order, page breaks, font metrics and labels from the injected `_config` object
- `src/templates/harvard.hbs` — the original fixed-layout template, kept for reference

## Development

```bash
bun install               # Install dependencies
bun run example.ts        # Render the example resume to resumes/
bun run example-config.ts # Same resume under several section/page-break configs
bun run test-validator.ts # Check the validator integration
```

From the repo root: `bun run example`, `bun run xebec:example`, `bun run xebec:test`.
