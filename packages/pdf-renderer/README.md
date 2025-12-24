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
import type { ResumeSchema, GenerateConfig } from "scpdf";

const resume: ResumeSchema = {
  // Your JSON Resume data
};

// Generate PDF with default configuration
await generatePDFToFile(resume, "output.pdf");

// Or with custom configuration
const config: GenerateConfig = {
  sectionOrder: ["summary", "work", "education", "skills"],
  pageBreakAfter: ["education"],
};
await generatePDFToFile(resume, "output.pdf", config);
```

### Configuration

Supports all configuration options from `scpdf`:
- **Section ordering**: Control which sections appear and in what order
- **Page breaks**: Add page breaks before or after specific sections
- **Custom layouts**: Perfect for multi-page resumes

## Development

```bash
bun install           # Install dependencies (including Puppeteer/Chromium)
bun run example.ts    # Generate example PDF
```

## Note

This package depends on `scpdf` for HTML generation and uses Puppeteer (~300MB with Chromium) for PDF rendering.
