# PDFTS - JSON Resume to PDF

A Bun-based monorepo for converting JSON Resume format to PDF with embedded metadata.

## Architecture

This is a monorepo containing two packages:

### 📦 `packages/scpdf`
Lightweight library for generating HTML from JSON Resume data.
- ✅ No browser dependencies
- ✅ Handlebars templating
- ✅ Harvard CV format
- ✅ Type-safe with TypeScript

### 📦 `packages/pdf-renderer`
PDF generator using Puppeteer to convert HTML to PDF.
- ✅ High-quality PDF rendering
- ✅ Embeds JSON Resume as PDF attachment
- ✅ Full CSS support

## Getting Started

```bash
# Install dependencies for all packages
bun install

# Try the scpdf library (HTML generation only)
cd packages/scpdf
bun run example.ts

# Try the pdf-renderer (full PDF generation)
cd packages/pdf-renderer
bun install  # Downloads Puppeteer/Chromium
bun run example.ts
```

## Project Structure

```
PDFTS/
├── packages/
│   ├── scpdf/           # Core library (lightweight)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── html-generator.ts
│   │   │   ├── helpers.ts
│   │   │   └── templates/
│   │   │       └── harvard.hbs
│   │   └── example.ts
│   │
│   └── pdf-renderer/    # PDF generation (with Puppeteer)
│       ├── src/
│       │   └── index.ts
│       └── example.ts
│
├── package.json         # Monorepo root
└── README.md
```

## Features

- **Clean separation**: Library doesn't depend on heavy browser tools
- **Type-safe**: Full TypeScript support with JSON Resume schema
- **Metadata embedding**: Original JSON stored as PDF attachment
- **Professional layouts**: Harvard CV format included
- **Extensible**: Easy to add new templates and formats

## Development

Built with [Bun](https://bun.sh) - a fast all-in-one JavaScript runtime.
