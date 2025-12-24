# pdf-renderer

Puppeteer-based PDF generator for JSON Resume. Converts HTML from `scpdf` to PDF and embeds JSON metadata.

## Features

- ✅ Uses Puppeteer for high-quality HTML→PDF rendering
- ✅ Embeds JSON Resume as PDF attachment
- ✅ Sets PDF metadata (title, author, keywords)
- ✅ Supports all CSS styling from scpdf templates

## Installation

```bash
cd packages/pdf-renderer
bun install
```

## Usage

```typescript
import { generatePDFToFile } from "pdf-renderer";
import type { ResumeSchema } from "scpdf";

const resume: ResumeSchema = {
  // Your JSON Resume data
};

await generatePDFToFile(resume, "output.pdf");
```

## Development

```bash
bun install           # Install dependencies (including Puppeteer/Chromium)
bun run example.ts    # Generate example PDF
```

## Note

This package depends on `scpdf` for HTML generation and uses Puppeteer (~300MB with Chromium) for PDF rendering.
