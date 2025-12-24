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
import { generateHTML } from "scpdf";
import type { ResumeSchema } from "scpdf";

const resume: ResumeSchema = {
  // Your JSON Resume data
};

// Generate HTML
const html = generateHTML(resume);
```

## Development

```bash
bun install          # Install dependencies
bun run example.ts   # Run example
```

## Note

This library generates HTML only. For PDF generation, use the `pdf-renderer` package which uses Puppeteer to convert the HTML to PDF and embed JSON metadata.
