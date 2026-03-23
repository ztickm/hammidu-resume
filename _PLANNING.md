# Hammidu Resume Implementation Planning

## Project Goal
Convert JSON Resume format to PDF with embedded metadata, using a hybrid HTML → PDF approach.

## Current Status: v1 Complete ✅

The core pipeline is fully implemented and working end-to-end as of the `main` branch. The project has been restructured as a **Bun monorepo** with four packages.

---

## Monorepo Structure

```
hammidu-resume/
├── packages/
│   ├── json-resume-types/   # Standalone TypeScript type definitions
│   ├── xebec-render/        # JSON Resume → HTML (Handlebars)
│   ├── flouka-studio/       # HTML → PDF + web interface (Puppeteer)
│   ├── validator/           # JSON Resume schema validator (AJV)
│   └── extractor/           # PDF → JSON Resume extractor (pdf-lib)
├── resumes/                 # Example output files
└── test-roundtrip.ts        # End-to-end round-trip test
```

---

## Architecture: Hybrid HTML → PDF Pipeline

### Implemented Flow
```
JSON Resume
    │
    ▼ (xebec-render)
    HTML (Handlebars template, Harvard style CSS)
    │
    ▼ (flouka-studio / Puppeteer)
    PDF (A4, with print CSS)
    │
    ▼ (flouka-studio / pdf-lib)
    PDF + embedded resume.json attachment + metadata
    │
    ▼ (extractor)
    JSON Resume (round-trip extraction)
```

---

## Library Stack (Resolved)

| Purpose                   | Library                              | Status                 |
| ------------------------- | ------------------------------------ | ---------------------- |
| HTML templating           | `handlebars` ^4.7.8                  | ✅ Implemented          |
| HTML → PDF rendering      | `puppeteer` ^23.0.0                  | ✅ Chosen & implemented |
| PDF metadata / attachment | `pdf-lib` ^1.17.1                    | ✅ Implemented          |
| JSON schema validation    | `ajv` ^8.12.0 + `ajv-formats` ^3.0.1 | ✅ Implemented          |
| JSON Resume schema        | `@jsonresume/schema` ^1.2.1          | ✅ Implemented          |
| Runtime                   | Bun                                  | ✅ Used throughout      |

---

## Package Details

### `json-resume-types`
- Standalone TypeScript type definitions for all JSON Resume fields
- Extracted into its own package so all other packages share a single source of truth
- Exports: `ResumeSchema`, `Basics`, `Work`, `Education`, `Skill`, `ISO8601`, etc.

### `xebec-render`
- Converts JSON Resume → styled HTML using Handlebars
- **Templates**: `harvard.hbs` (original), `harvard-configurable.hbs` (active, supports all config options)
- **Helpers implemented**:
  - `formatDate` — ISO8601 → "January 2019" (handles `YYYY`, `YYYY-MM`, `YYYY-MM-DD`)
  - `formatDateOrPresent` — returns "Present" when `endDate` is absent
  - `joinArray` — joins keyword arrays with a separator
  - `eq`, `hasPageBreak` — Handlebars logic helpers
- **Configuration** (`GenerateConfig`):
  - `sectionOrder` — custom section ordering (all 12 JSON Resume sections supported)
  - `pageBreakBefore` / `pageBreakAfter` — force page breaks around any section
  - `baseFontSize` — font size in px (default: 12)
  - `lineHeight` — line height multiplier (default: 1.5)
- Validates resume via `validator` package before generating HTML (throws on invalid input)
- Re-exports validator functions for convenience

### `flouka-studio`
- Orchestrates the full PDF generation pipeline
- Uses **Puppeteer** (headless Chrome) to render HTML → PDF (A4, `networkidle0`)
- PDF margins: 0.5cm top/right/left, 1.2cm bottom
- **Footer**: page number, total pages, link to Hammidu Resume GitHub repo
- Uses `pdf-lib` to post-process the PDF:
  - Attaches `resume.json` (MIME: `application/json`)
  - Sets PDF title, author, subject, keywords, producer, creator metadata
- **Web server** (`web-server.ts`) on port 3001 with:
  - `GET /` — serves the web UI (`public/index.html`)
  - `POST /api/validate` — validates a JSON Resume
  - `POST /api/preview` — returns rendered HTML
  - `POST /api/generate-pdf` — streams PDF download
- Web UI features: resizable sidebar, live preview, configuration panel, section ordering, font size control, page break toggles, remove/restore sections, save/load config

### `validator`
- Schema validation using AJV against the official `@jsonresume/schema`
- **Two-layer validation**:
  1. Schema validation (AJV, all errors reported)
  2. Practical checks (warnings for missing name, no contact info, bad date formats, empty resume, invalid URLs/emails)
- Exports: `validateResume`, `validateResumeStrict` (throws), `validateResumeString`, `validateResumeFile`
- Has a **CLI** (`cli.ts`) for validating JSON files from the command line

### `extractor`
- Extracts embedded `resume.json` from a PDF using `pdf-lib`
- Handles both plain and FlateDecode-compressed streams
- Parses hex-encoded (UTF-16BE) PDF name strings correctly
- Exports: `extractResumeFromPDF`, `extractResumeFromFile`, `hasResumeMetadata`
- Round-trip verified: JSON → PDF → JSON produces identical data

---

## Layout Design: Harvard CV Format ✅

### Characteristics (Implemented):
- Clean, professional, single-column layout
- Serif typography (Times New Roman)
- Configurable base font size and line height
- Clear section headers with ruled dividers
- Contact info in header, page number in footer

### Structure:
```
┌─────────────────────────────────────┐
│ NAME (Large, Bold, Centered)        │
│ Title/Label (Centered)              │
│ Contact Info (Centered/One Line)    │
├─────────────────────────────────────┤
│ SUMMARY                             │
│ Brief paragraph...                  │
├─────────────────────────────────────┤
│ EDUCATION                           │
│ Degree, Institution, Date           │
│ - Details...                        │
├─────────────────────────────────────┤
│ EXPERIENCE                          │
│ Position, Company, Date             │
│ - Highlight bullet points           │
├─────────────────────────────────────┤
│ SKILLS                              │
│ Category: keyword, keyword          │
├─────────────────────────────────────┤
│ ADDITIONAL SECTIONS                 │
│ (Awards, Publications, etc.)        │
├─────────────────────────────────────┤
│ Page N/Total · Hammidu Resume (link)│
└─────────────────────────────────────┘
```

---

## Features

### v1 — Implemented ✅
- [x] JSON Resume type definitions (`json-resume-types` package)
- [x] HTML template generation (Handlebars, Harvard style)
- [x] Harvard CV CSS styling (configurable font size & line height)
- [x] HTML → PDF conversion (Puppeteer, headless Chrome)
- [x] JSON metadata embedding as PDF attachment (`resume.json` via pdf-lib)
- [x] PDF metadata (title, author, subject, keywords, producer, creator)
- [x] Multi-page support (Puppeteer handles pagination automatically)
- [x] Configurable section ordering (all 12 sections)
- [x] Configurable page breaks (before/after any section)
- [x] JSON Resume validator (AJV + practical checks + CLI)
- [x] PDF → JSON extractor (round-trip restoration)
- [x] Web interface (live preview, PDF download, config panel)
- [x] Resizable sidebar in web UI
- [x] Footer with page numbers and project link
- [x] Round-trip test (`test-roundtrip.ts`): JSON → HTML → PDF → JSON

### v2 — Flouka Studio Desktop App (in progress, branch: `feat/flouka-tauri-desktop`)
- [x] Tauri desktop app wrapping the existing Flouka Studio UI — Phase 1 complete
- [x] Dual-mode frontend: `window.FloukaBridge` in Tauri prod, `fetch('/api/...')` in web/dev mode
- [x] `bundle.js`: xebec-render + validator + @tauri-apps/api bundled for in-browser use
- [x] CSS `@page @bottom-center counter(page)` footer (replaces Puppeteer `footerTemplate`)
- [x] `cargo check` passes: zero errors, zero warnings
- [ ] Print-to-PDF via the WebView (no Puppeteer, no shipped Chromium) — **Phase 2**
- [ ] Rust plugin for platform print APIs (Mac: WKWebView, Windows: WebView2, Linux: WebKitGTK)
- [ ] `pdf-lib` post-processing retained in JS (JSON embedding + metadata)
- [ ] File save via Tauri `dialog.save()` + `fs.writeBinaryFile()`
- [ ] Packaged installers: `.dmg` (Mac), `.msi` (Windows), `.AppImage`/`.deb` (Linux)
- [ ] Remove Puppeteer and `web-server.ts` from flouka-studio
- [ ] Estimated final bundle: ~15–25MB (vs ~300MB+ with Chromium)

### v3+ — Planned
- [ ] Multiple CV templates (beyond Harvard)
- [ ] Custom font embedding
- [ ] Color scheme options
- [ ] Internationalization support
- [ ] Published npm packages

## Flouka Studio Desktop App (v2)

### Architecture

Tauri replaces the Bun HTTP server. The existing `public/index.html` UI loads directly inside the Tauri WebView. PDF generation uses the WebView's own print engine — the same engine that renders the live preview — guaranteeing WYSIWYG output without shipping Chromium.

```
JSON Resume (pasted in UI)
      │
      ▼  invoke('generate_html')  [Tauri command → xebec-render JS]
      HTML rendered in WebView  ← live preview
      │
      ▼  invoke('print_to_pdf')  [Tauri command → Rust print plugin]
      Raw PDF bytes (from WebView's own render engine)
      │
      ▼  pdf-lib in JS
      PDF + resume.json attachment + title/author metadata
      │
      ▼  invoke('save_file')  [Tauri dialog.save + fs.writeBinaryFile]
      resume.pdf saved to disk
```

### What changes vs what stays the same

| Component | Change |
|---|---|
| `xebec-render` | None |
| `validator` | None |
| `extractor` | None |
| `json-resume-types` | None |
| `pdf-lib` post-processing | None — still runs in JS after getting PDF bytes |
| `public/index.html` UI | Minor — swap `fetch('/api/...')` for `invoke('...')` |
| `flouka-studio/src/index.ts` | Puppeteer code removed; pdf-lib embedding stays |
| `web-server.ts` | Deleted |
| Puppeteer | Removed entirely |

### Platform print APIs (Rust plugin)

| Platform | API | Notes |
|---|---|---|
| macOS | `WKWebView.createPDF(configuration:)` | Native WebKit, excellent quality |
| Windows | `CoreWebView2.PrintToPdfAsync()` | WebView2 is Chromium-based, consistent output |
| Linux | WebKitGTK print operation | Functional, lower priority |

### Phases

#### Phase 1 — Tauri shell ✅ complete (`a3cbd73`)
- Scaffold Tauri project inside `packages/flouka-studio/src-tauri/`
- `tauri.conf.json`: window 1400×900, `frontendDist=../public`, `devUrl=http://localhost:3001`
- Rust commands: `validate_resume`, `generate_html` (stubs), `save_pdf` (stub)
- `src/frontend.ts` bundled to `public/bundle.js`: xebec-render + validator + @tauri-apps/api
- `window.FloukaBridge` exposed: `validateResume`, `generateHTML`, `printToPDF`
- Dual-mode `index.html`: FloukaBridge in Tauri prod, `fetch('/api/...')` in web/dev mode
- Preview in Tauri mode: HTML iframe (true WYSIWYG, same engine as PDF export)
- CSS `@page @bottom-center` footer in both `.hbs` templates (replaces Puppeteer `footerTemplate`)
- `cargo check` passes: zero errors, zero warnings

#### Phase 2 — Print-to-PDF Rust plugin *(current)*
- `src-tauri/src/pdf.rs`: platform-specific print-to-PDF
  - macOS: `WKWebView.createPDF(configuration:)` via `objc2-web-kit` crate
  - Windows: `CoreWebView2.PrintToPdfAsync()` via `webview2-com` crate
  - Linux: WebKitGTK headless print operation
- `print_to_pdf` Tauri command: returns raw PDF bytes to JS
- Full `save_pdf` command: `tauri-plugin-dialog` file picker + `tauri-plugin-fs` write
- JS side: receive bytes → `pdf-lib` JSON embedding → `invoke('save_pdf', { bytes, name })`
- Wire `FloukaBridge.printToPDF()` to the real command (replace the stub)
- Remove Puppeteer from `flouka-studio/src/index.ts`

#### Phase 3 — Polish & packaging
- Real app icons (replace placeholder RGBA PNGs with proper `.icns` / `.ico`)
- `tauri build` tested on macOS, Windows, Linux
- Code signing config (Apple Developer ID notarization, Windows Authenticode)
- Update `_PLANNING.md` to reflect v2 complete

### Key risk: footer / page numbers ✅ resolved

The Puppeteer `footerTemplate` has been replaced with CSS Paged Media Level 3:
```css
@page {
  margin-bottom: 1.8cm;
  @bottom-center {
    content: counter(page) " / " counter(pages) "  ·  Generated with Hammidu Resume";
  }
}
```
Applied to both `harvard.hbs` and `harvard-configurable.hbs`. Supported natively by WKWebView (macOS) and WebView2 (Windows). Linux (WebKitGTK) supports `counter(page)` but `counter(pages)` total-page count may require a JS fallback.

---



### Approach: PDF File Attachment (Implemented)
- Embedded as `resume.json` attached file in the PDF
- MIME type: `application/json`
- Description: "JSON Resume source data"
- Compression: FlateDecode (handled transparently by extractor)

### Round-Trip Verified ✅
- `test-roundtrip.ts` demonstrates JSON → HTML → PDF → JSON
- Extracted data is byte-for-byte identical to input

---

## Development Workflow

```bash
# Web UI (live preview + PDF download)
bun run web                     # http://localhost:3001

# Generate example PDFs
bun run example                 # xebec-render HTML example
bun run flouka:example          # flouka PDF example

# Validate a JSON Resume
bun run validate

# Extract JSON from a PDF
bun run extract

# Run round-trip test
bun run roundtrip

# Validate JSON Resume via CLI
bun run validator:validate -- path/to/resume.json
```

---

## Open Questions / Future Work

1. **Font Embedding**: System fonts are used currently (Times New Roman via CSS). Bundling font files would ensure cross-platform consistency.
2. **Performance**: No benchmark established yet. Puppeteer launch time dominates; a persistent browser instance could help.
3. **npm Publishing**: Packages are workspace-linked; publishing as public packages is planned for v2.
4. **Multiple Templates**: Only the Harvard style exists. A second template would validate the templating architecture.
5. **Internationalization**: Date formatting is English-only (`January`, `February`, …).

---

## Success Criteria

| Criterion                                        | Status |
| ------------------------------------------------ | ------ |
| Convert example JSON Resume to PDF               | ✅      |
| PDF looks clean and professional (Harvard style) | ✅      |
| JSON Resume is embedded as PDF attachment        | ✅      |
| Multi-page resumes work                          | ✅      |
| Type safety throughout                           | ✅      |
| Works with Bun runtime                           | ✅      |
| Round-trip: JSON → PDF → JSON                    | ✅      |
| Validation with helpful error messages           | ✅      |
| Web interface for non-CLI use                    | ✅      |
