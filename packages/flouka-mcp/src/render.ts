/**
 * Resume resolution, validation gating and rendering for the MCP tools.
 *
 * No rendering logic of its own: `generateHTML` (xebec-render) and
 * `generatePDF` (flouka-studio) do the work, exactly as the web server and the
 * agent's trigger_pdf node call them. This module only decides *which* resume,
 * *which* config and *which* output path, and whether validation should block.
 */

import { mkdirSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { generateHTML, DEFAULT_CONFIG } from "xebec-render";
import type { GenerateConfig } from "xebec-render";
import { generatePDF } from "flouka-studio";
import { validateResume } from "validator";
import type { ValidationResult } from "validator";
import type { ResumeSchema } from "json-resume-types";
import { findApplication, readMasterConfig, requireMaster } from "./store.ts";

// ---------------------------------------------------------------------------
// Paths — resolved from this file, never from cwd
// ---------------------------------------------------------------------------

// An MCP client launches us with whatever cwd it likes, so relative paths are
// meaningless here. Mirrors packages/agent/src/nodes/trigger-pdf.ts.
const PACKAGE_DIR = resolve(import.meta.dir, "..");
const MONOREPO_ROOT = resolve(PACKAGE_DIR, "../..");

/**
 * Where generated PDFs land — `AGENT_PDF_DIR`, same variable the agent uses.
 *
 * That variable is conventionally relative (`.env` ships `../../resumes`)
 * because every other consumer runs under `bun run --cwd packages/<name>`, so a
 * relative value is resolved against *this package's* directory to land in the
 * same place. Left to `process.cwd()` it would follow the MCP client around.
 */
export const OUTPUT_DIR = process.env.AGENT_PDF_DIR
  ? resolve(PACKAGE_DIR, process.env.AGENT_PDF_DIR)
  : resolve(MONOREPO_ROOT, "resumes");

/**
 * Resolve a path from a tool argument. Relative paths are relative to the
 * monorepo root — what someone passing `resumes/foo.pdf` means — never to cwd.
 */
export function resolveOutputPath(path: string): string {
  return isAbsolute(path) ? path : resolve(MONOREPO_ROOT, path);
}

// ---------------------------------------------------------------------------
// Resume resolution
// ---------------------------------------------------------------------------

export interface SourceArgs {
  resume?: ResumeSchema;
  applicationId?: string;
}

export interface ResolvedSource {
  resume: ResumeSchema;
  /** Config that belongs to this resume, before the caller's overrides. */
  baseConfig: GenerateConfig;
  /** Human-readable provenance, echoed back so the model knows what it rendered. */
  origin: string;
  /** Company name to work into the filename, when we know one. */
  company?: string;
}

/**
 * Pick the resume to render: inline `resume` wins, then a stored application,
 * then the master resume.
 */
export function resolveSource(args: SourceArgs): ResolvedSource {
  if (args.resume) {
    return {
      resume: args.resume,
      baseConfig: readMasterConfig() ?? {},
      origin: "inline resume argument",
    };
  }

  if (args.applicationId) {
    const app = findApplication(args.applicationId);
    if (!app) {
      throw new Error(
        `No application with id "${args.applicationId}". Call list_applications to see the stored ids.`
      );
    }
    if (!app.tailoredResume) {
      throw new Error(`Application "${args.applicationId}" has no tailoredResume stored.`);
    }
    return {
      resume: app.tailoredResume,
      baseConfig: app.config ?? {},
      origin: `application ${args.applicationId}${app.name ? ` (${app.name})` : ""}`,
      company: app.jdAnalysis?.company || undefined,
    };
  }

  return {
    resume: requireMaster(),
    baseConfig: readMasterConfig() ?? {},
    origin: "stored master resume",
  };
}

// ---------------------------------------------------------------------------
// Validation gating
// ---------------------------------------------------------------------------

export interface GateResult {
  /** Practical problems that did not block the render. */
  warnings: string[];
  result: ValidationResult;
}

/**
 * Validate before rendering.
 *
 * `validateResume` reports `valid: false` for warnings too (see `buildResult`
 * in packages/validator/src/index.ts), which is why the web server refuses to
 * render a resume missing a phone number. Over MCP that would leave the caller
 * no way through, so by default only schema *errors* block and warnings are
 * reported back. `strict` restores the web server's behaviour.
 */
export function gateValidation(resume: ResumeSchema, strict = false): GateResult {
  const result = validateResume(resume);
  const warnings = result.warnings ?? [];

  if (strict && !result.valid) {
    throw new Error(`Resume is invalid (strict mode):\n${result.summary ?? "unknown problem"}`);
  }

  const errors = result.errors ?? [];
  if (errors.length > 0) {
    const lines = errors.map((e) => `  - ${e.path || "(document)"}: ${e.message}`);
    throw new Error(
      `Resume has ${errors.length} schema error${errors.length === 1 ? "" : "s"} and cannot be rendered:\n${lines.join("\n")}`
    );
  }

  return { warnings, result };
}

// ---------------------------------------------------------------------------
// Output naming — matches what the SPA downloads (public/index.html:1236, :2121)
// ---------------------------------------------------------------------------

function fileBase(resume: ResumeSchema): string {
  return (resume.basics?.name || "resume").replace(/\s+/g, "_");
}

function companySlug(company: string): string {
  return company
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function defaultFilename(
  resume: ResumeSchema,
  company: string | undefined,
  extension: "pdf" | "html"
): string {
  const slug = company ? companySlug(company) : "";
  const base = slug
    ? `${fileBase(resume)}_resume_${slug}`
    : `${fileBase(resume)}_resume`;
  return `${base}.${extension}`;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Caller overrides win over the resume's stored config, which wins over defaults. */
export function mergeConfig(
  baseConfig: GenerateConfig,
  overrides: GenerateConfig | undefined
): GenerateConfig {
  return { ...DEFAULT_CONFIG, ...baseConfig, ...(overrides ?? {}) };
}

export interface RenderArgs extends SourceArgs {
  config?: GenerateConfig;
  outputPath?: string;
  company?: string;
  strict?: boolean;
}

export interface PdfRenderResult {
  path: string;
  bytes: number;
  origin: string;
  warnings: string[];
  configUsed: GenerateConfig;
}

export async function renderPdf(args: RenderArgs): Promise<PdfRenderResult> {
  const source = resolveSource(args);
  const { warnings } = gateValidation(source.resume, args.strict);
  const configUsed = mergeConfig(source.baseConfig, args.config);

  const path = args.outputPath
    ? resolveOutputPath(args.outputPath)
    : resolve(
        OUTPUT_DIR,
        defaultFilename(source.resume, args.company ?? source.company, "pdf")
      );

  // generatePDF embeds the source JSON as a `resume.json` attachment, so the
  // artefact round-trips back through the extractor.
  const pdfBytes = await generatePDF(source.resume, { config: configUsed });

  mkdirSync(resolve(path, ".."), { recursive: true });
  await Bun.write(path, pdfBytes);

  return { path, bytes: pdfBytes.byteLength, origin: source.origin, warnings, configUsed };
}

export interface HtmlRenderResult {
  html: string;
  path?: string;
  origin: string;
  warnings: string[];
  configUsed: GenerateConfig;
}

export async function renderHtml(args: RenderArgs): Promise<HtmlRenderResult> {
  const source = resolveSource(args);
  const { warnings } = gateValidation(source.resume, args.strict);
  const configUsed = mergeConfig(source.baseConfig, args.config);

  const html = generateHTML(source.resume, configUsed);

  let path: string | undefined;
  if (args.outputPath) {
    path = resolveOutputPath(args.outputPath);
    mkdirSync(resolve(path, ".."), { recursive: true });
    await Bun.write(path, html);
  }

  return { html, path, origin: source.origin, warnings, configUsed };
}
