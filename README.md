# Hammidu Resume - JSON Resume to PDF

A Bun-based monorepo for converting JSON Resume format to PDF with embedded metadata.

## Architecture

This is a monorepo containing three packages:

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

### 📦 `packages/validator`
JSON Resume schema validator using AJV.
- ✅ Validates against official JSON Resume schema
- ✅ Detailed error messages with paths
- ✅ CLI tool and programmatic API
- ✅ Format validation (email, URI, dates)

## Getting Started

```bash
# Install dependencies for all packages
bun install
```

### Quick Start (from root directory)

You can run all package commands from the root directory without cd'ing:

```bash
# Run validator tests
bun run validate

# Generate HTML example (xebec)
bun run example

# Start web interface (flouka)
bun run web

# Run xebec validator integration test
bun run xebec:test
```

### Available Scripts

**Validator:**
- `bun run validate` - Run comprehensive validator test suite
- `bun run validator:example` - Same as above
- `bun run validator:validate` - Validate a JSON file (with path argument)

**Xebec (HTML Generator):**
- `bun run example` - Generate HTML from example resume
- `bun run xebec:example` - Same as above
- `bun run xebec:test` - Test validator integration

**Flouka (PDF Generator & Web UI):**
- `bun run web` - Start web interface at http://localhost:3001
- `bun run flouka:web` - Same as above
- `bun run flouka:example` - Generate PDF from example resume

### Manual Package Usage

If you prefer working within each package:

```bash
# Validate a JSON Resume file
cd packages/validator
bun cli.ts ../../resumes/example_input.json

# Try the xebec library (HTML generation only)
cd packages/xebec
bun example.ts

# Try the flouka PDF generator
cd packages/flouka
bun example.ts

# Start the web interface
cd packages/flouka
bun --watch web-server.ts
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
