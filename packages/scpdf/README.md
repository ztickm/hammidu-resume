# scpdf

A Bun-based TypeScript library for converting JSON Resume format to HTML and working with PDF metadata.

## Features

- ✅ Generate HTML from JSON Resume data
- ✅ Harvard CV format template with Handlebars
- ✅ Date formatting helpers (ISO8601 → human-readable)
- ✅ Type-safe with full TypeScript support
- ✅ Lightweight - no browser dependencies

## Installation

```bash
bun add scpdf
```

## Usage

```typescript
import { generateHTML, type GenerateConfig } from "scpdf";
import type { ResumeSchema } from "scpdf";

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
};
const htmlWithConfig = generateHTML(resume, config);
```

### Configuration Options

- **`sectionOrder`**: Array of section names to control order and which sections appear
- **`pageBreakBefore`**: Array of section names that should have a page break before them
- **`pageBreakAfter`**: Array of section names that should have a page break after them

Available sections: `summary`, `education`, `work`, `volunteer`, `skills`, `languages`, `awards`, `publications`, `projects`, `certificates`, `interests`, `references`

## Development

```bash
bun install          # Install dependencies
bun run example.ts   # Run example
```

## Note

This library generates HTML only. For PDF generation, use the `pdf-renderer` package which uses Puppeteer to convert the HTML to PDF and embed JSON metadata.
