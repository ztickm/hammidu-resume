# Hammidu Resume - JSON Resume to PDF

A Bun-based monorepo for converting JSON Resume format to PDF with embedded metadata.

## Architecture

This is a monorepo containing two packages:

### 📦 `packages/xebec`
Lightweight library for generating HTML from JSON Resume data.
- ✅ No browser dependencies
- ✅ Handlebars templating
- ✅ Harvard CV format
- ✅ Type-safe with TypeScript

### 📦 `packages/flouka`
PDF generator using Puppeteer to convert HTML to PDF, plus a web interface.
- ✅ High-quality PDF rendering
- ✅ Embeds JSON Resume as PDF attachment
- ✅ Full CSS support
- ✅ Web UI with live preview

## Getting Started

```bash
# Install dependencies for all packages
bun install

# Try the xebec library (HTML generation only)
cd packages/xebec
bun run example.ts

# Try the flouka PDF generator
cd packages/flouka
bun install  # Downloads Puppeteer/Chromium
bun run example.ts

# Start the web interface
cd packages/flouka
bun run web
# Open http://localhost:3001 in your browser
```

## Project Structure

```
hammidu-resume/
├── packages/
│   ├── xebec/             # Core library (lightweight)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── html-generator.ts
│   │   │   ├── helpers.ts
│   │   │   └── templates/
│   │   │       └── harvard-configurable.hbs
│   │   └── example.ts
│   │
│   └── flouka/            # PDF generation + Web UI
│       ├── src/
│       │   └── index.ts
│       ├── public/
│       │   └── index.html
│       ├── web-server.ts
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
