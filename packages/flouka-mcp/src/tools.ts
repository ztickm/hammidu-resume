/**
 * MCP tool, resource and prompt registrations.
 *
 * Nine tools, no LLM calls: the connected model does the tailoring and this
 * server does the deterministic work — read the stored resume, validate it,
 * render the Harvard template to PDF/HTML with the source JSON embedded, and
 * read that JSON back out of a PDF.
 *
 * Tool descriptions carry the defaults and units, because the client model
 * only ever sees the schema — not this file.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DEFAULT_CONFIG } from "xebec-render";
import type { GenerateConfig } from "xebec-render";
import { validateResume } from "validator";
import { extractResumeFromFile } from "extractor";
import type { ResumeSchema } from "json-resume-types";
import {
  OUTPUT_DIR,
  gateValidation,
  renderHtml,
  renderPdf,
  resolveOutputPath,
} from "./render.ts";
import {
  RELOAD_NOTICE,
  findApplication,
  mergeResumePatch,
  readApplications,
  readMaster,
  readMasterConfig,
  requireMaster,
  writeMaster,
} from "./store.ts";

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const SECTION_NAMES = [
  "summary",
  "education",
  "work",
  "volunteer",
  "skills",
  "languages",
  "awards",
  "publications",
  "projects",
  "certificates",
  "interests",
  "references",
] as const;

const SectionName = z.enum(SECTION_NAMES);

const ConfigSchema = z
  .object({
    sectionOrder: z
      .array(SectionName)
      .optional()
      .describe(
        `Sections to render, in order. Sections left out are omitted entirely. Default: ${DEFAULT_CONFIG.sectionOrder.join(", ")}`
      ),
    pageBreakBefore: z
      .array(SectionName)
      .optional()
      .describe("Force a page break before each of these sections. Default: none"),
    pageBreakAfter: z
      .array(SectionName)
      .optional()
      .describe("Force a page break after each of these sections. Default: none"),
    baseFontSize: z
      .number()
      .optional()
      .describe(`Base font size in pt. Default: ${DEFAULT_CONFIG.baseFontSize}. 10-11 fits more on a page.`),
    lineHeight: z
      .number()
      .optional()
      .describe(`Line-height multiplier. Default: ${DEFAULT_CONFIG.lineHeight}`),
    locale: z
      .enum(["en", "de", "fr", "ar"])
      .optional()
      .describe(`Language of the section headings. Default: ${DEFAULT_CONFIG.locale}`),
  })
  .describe("Layout overrides, merged over the resume's stored config.");

/**
 * Resumes travel as loose objects: the `validator` package is the authority on
 * shape, and restating the whole JSON Resume schema in zod would bloat every
 * tool listing the client loads.
 */
const ResumeObject = z
  .record(z.string(), z.unknown())
  .describe(
    "A full JSON Resume document (basics, work, education, skills, languages, projects, …)."
  );

const sourceShape = {
  resume: ResumeObject.optional().describe(
    "Render this resume. Omit to use the stored master resume (or `applicationId`)."
  ),
  applicationId: z
    .string()
    .optional()
    .describe("Render a stored application's tailored resume instead. See list_applications."),
};

const renderShape = {
  ...sourceShape,
  config: ConfigSchema.optional(),
  strict: z
    .boolean()
    .optional()
    .describe(
      "Treat validation warnings (e.g. a missing phone number) as blocking, like the web UI does. Default: false — only schema errors block."
    ),
};

// Entry shapes for the patch tool — these are the fields worth being explicit
// about, since the model has to know how entries are matched.
const WorkEntry = z.object({
  name: z.string().optional().describe("Employer. Matched with `position` against the existing entry."),
  position: z.string().optional().describe("Job title. Matched with `name` against the existing entry."),
  location: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  startDate: z.string().optional().describe("ISO8601, e.g. 2023-04"),
  endDate: z.string().optional().describe("ISO8601; omit for a current role"),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional().describe("Replaces this entry's highlights wholesale"),
});

const VolunteerEntry = z.object({
  organization: z.string().optional().describe("Matched with `position` against the existing entry."),
  position: z.string().optional(),
  url: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
});

const patchShape = {
  basics: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Shallow-merged: only the fields you pass change (name, label, email, phone, url, summary, location, profiles)."),
  work: z
    .array(WorkEntry)
    .optional()
    .describe(
      "Entries matched on name + position and shallow-merged. An entry matching nothing is APPENDED as a new job and called out in the result."
    ),
  volunteer: z
    .array(VolunteerEntry)
    .optional()
    .describe("Matched on organization + position; same append behaviour as `work`."),
  education: z.array(z.record(z.string(), z.unknown())).optional().describe("Replaces the whole section."),
  skills: z.array(z.record(z.string(), z.unknown())).optional().describe("Replaces the whole section."),
  languages: z.array(z.record(z.string(), z.unknown())).optional().describe("Replaces the whole section."),
  projects: z.array(z.record(z.string(), z.unknown())).optional().describe("Replaces the whole section."),
  awards: z.array(z.record(z.string(), z.unknown())).optional().describe("Replaces the whole section."),
  certificates: z.array(z.record(z.string(), z.unknown())).optional().describe("Replaces the whole section."),
  publications: z.array(z.record(z.string(), z.unknown())).optional().describe("Replaces the whole section."),
  interests: z.array(z.record(z.string(), z.unknown())).optional().describe("Replaces the whole section."),
  references: z.array(z.record(z.string(), z.unknown())).optional().describe("Replaces the whole section."),
  meta: z.record(z.string(), z.unknown()).optional().describe("Shallow-merged."),
};

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

function json(data: unknown) {
  return text(JSON.stringify(data, null, 2));
}

function warningBlock(warnings: string[]): string {
  if (warnings.length === 0) return "";
  return `\n\nValidation warnings (did not block the render):\n${warnings.map((w) => `  - ${w}`).join("\n")}`;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerAll(server: McpServer): void {
  // -- Read -----------------------------------------------------------------

  server.registerTool(
    "get_master_resume",
    {
      title: "Get master resume",
      description:
        "Read the stored master resume (the full, untailored JSON Resume) and its layout config from Flouka Studio's local store. Start here when tailoring: select and reframe what is already in it, never invent entries.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const resume = requireMaster();
      return json({ resume, config: readMasterConfig() });
    }
  );

  server.registerTool(
    "list_applications",
    {
      title: "List applications",
      description:
        "List the job applications saved in Flouka Studio, newest field order as stored. Returns summaries only — use get_application for a full tailored resume. Read-only: applications are created and edited in the web UI.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const apps = readApplications().map((app) => ({
        id: app.id,
        name: app.name,
        company: app.jdAnalysis?.company ?? null,
        role_title: app.jdAnalysis?.role_title ?? null,
        createdAt: app.createdAt ?? null,
      }));
      return json({ count: apps.length, applications: apps });
    }
  );

  server.registerTool(
    "get_application",
    {
      title: "Get application",
      description:
        "Read one saved application: its tailored resume, the job description it was built for, the JD analysis and its layout config.",
      inputSchema: {
        id: z.string().describe("Application id from list_applications"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const app = findApplication(id);
      if (!app) {
        throw new Error(
          `No application with id "${id}". Call list_applications to see the stored ids.`
        );
      }
      return json({
        id: app.id,
        name: app.name,
        createdAt: app.createdAt,
        jd: app.jd,
        jdAnalysis: app.jdAnalysis,
        config: app.config,
        tailoredResume: app.tailoredResume,
      });
    }
  );

  server.registerTool(
    "validate_resume",
    {
      title: "Validate resume",
      description:
        "Check a resume against the JSON Resume schema plus practical checks. Errors block rendering; warnings (a missing phone number, say) do not unless you pass strict:true to the render tools. Omit both arguments to validate the stored master resume.",
      inputSchema: {
        resume: ResumeObject.optional(),
        path: z.string().optional().describe("Validate a .json file instead. Relative paths resolve against the repo root."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ resume, path }) => {
      let target: unknown;
      if (resume) {
        target = resume;
      } else if (path) {
        target = await Bun.file(resolveOutputPath(path)).json();
      } else {
        target = requireMaster();
      }

      const result = validateResume(target);
      return json({
        blocking: (result.errors?.length ?? 0) > 0,
        errors: result.errors ?? [],
        warnings: result.warnings ?? [],
        summary: result.summary ?? "No problems found.",
      });
    }
  );

  server.registerTool(
    "extract_resume_from_pdf",
    {
      title: "Extract resume from PDF",
      description:
        "Read the JSON Resume source back out of a PDF produced by this pipeline (it is embedded as a `resume.json` attachment). Use it to recover the data behind an existing PDF instead of re-typing it.",
      inputSchema: {
        path: z.string().describe("Path to the PDF. Relative paths resolve against the repo root."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ path }) => {
      const result = await extractResumeFromFile(resolveOutputPath(path));
      if (!result.success) {
        throw new Error(
          `Could not extract a resume from ${path}: ${result.error ?? "no embedded resume.json found"}. Only PDFs generated by this pipeline carry the attachment.`
        );
      }
      return json(result.resume);
    }
  );

  // -- Write (master resume only) -------------------------------------------

  server.registerTool(
    "update_master_resume",
    {
      title: "Update master resume",
      description:
        "Patch the stored master resume. Pass only the sections you are changing: basics and meta are shallow-merged, work and volunteer entries are matched on their identifying fields and merged (an unmatched entry is appended as new), and the remaining array sections are replaced wholesale. The previous master is snapshotted to a backup file first. Use replace_master_resume to delete entries.",
      inputSchema: patchShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (patch) => {
      const master = requireMaster();
      const { merged, changes } = mergeResumePatch(master, patch as Partial<ResumeSchema>);

      if (changes.length === 0) {
        throw new Error("Patch contained no recognised sections — nothing was written.");
      }

      const { warnings } = gateValidation(merged);
      const { backupPath } = writeMaster(merged);

      return text(
        [
          "Master resume updated.",
          "",
          ...changes.map((c) => `  - ${c}`),
          "",
          backupPath ? `Previous version backed up to: ${backupPath}` : "",
          warningBlock(warnings).trim(),
          "",
          RELOAD_NOTICE,
        ]
          .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
          .join("\n")
      );
    }
  );

  server.registerTool(
    "replace_master_resume",
    {
      title: "Replace master resume",
      description:
        "Overwrite the stored master resume with a complete JSON Resume document. Everything not included is removed — this is the only way to delete a work entry or wipe a section. Prefer update_master_resume for edits. The previous master is snapshotted to a backup file first.",
      inputSchema: {
        resume: ResumeObject.describe("The complete replacement JSON Resume document."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ resume }) => {
      const next = resume as ResumeSchema;
      const { warnings } = gateValidation(next);
      const previous = readMaster();
      const { backupPath } = writeMaster(next);

      const before = previous ? Object.keys(previous).length : 0;
      return text(
        [
          `Master resume replaced (${before} top-level sections before, ${Object.keys(next).length} now).`,
          backupPath ? `Previous version backed up to: ${backupPath}` : "No previous master to back up.",
          warningBlock(warnings).trim(),
          "",
          RELOAD_NOTICE,
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  );

  // -- Render ---------------------------------------------------------------

  server.registerTool(
    "render_resume_pdf",
    {
      title: "Render resume PDF",
      description:
        `Render a resume to a Harvard-template A4 PDF with the source JSON embedded as a resume.json attachment, and write it to disk. Returns the absolute path. Takes a few seconds — it runs headless Chromium. Defaults to the stored master resume and writes into ${OUTPUT_DIR} with a name derived from the resume's name and the company.`,
      inputSchema: {
        ...renderShape,
        outputPath: z
          .string()
          .optional()
          .describe(`Where to write the PDF. Relative paths resolve against the repo root. Default: ${OUTPUT_DIR}/<Name>_resume[_<Company>].pdf`),
        company: z
          .string()
          .optional()
          .describe("Company name, worked into the default filename. Ignored when outputPath is given."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await renderPdf({
        resume: args.resume as ResumeSchema | undefined,
        applicationId: args.applicationId,
        config: args.config as GenerateConfig | undefined,
        outputPath: args.outputPath,
        company: args.company,
        strict: args.strict,
      });

      return text(
        [
          `PDF written to: ${result.path}`,
          `Source: ${result.origin}`,
          `Size: ${(result.bytes / 1024).toFixed(1)} KB`,
          `Layout: ${result.configUsed.baseFontSize}pt / line-height ${result.configUsed.lineHeight} / ${result.configUsed.locale}`,
          `Sections: ${(result.configUsed.sectionOrder ?? []).join(", ")}`,
        ].join("\n") + warningBlock(result.warnings)
      );
    }
  );

  server.registerTool(
    "render_resume_html",
    {
      title: "Render resume HTML",
      description:
        "Render a resume to the same Harvard-template HTML the PDF is made from, and return it. Much faster than render_resume_pdf (no Chromium) — use it to check section order or length before committing to a PDF.",
      inputSchema: {
        ...renderShape,
        outputPath: z
          .string()
          .optional()
          .describe("Optionally also write the HTML here. Relative paths resolve against the repo root."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await renderHtml({
        resume: args.resume as ResumeSchema | undefined,
        applicationId: args.applicationId,
        config: args.config as GenerateConfig | undefined,
        outputPath: args.outputPath,
        strict: args.strict,
      });

      const header = [
        `Source: ${result.origin}`,
        result.path ? `Written to: ${result.path}` : null,
        `Sections: ${(result.configUsed.sectionOrder ?? []).join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n");

      return text(`${header}${warningBlock(result.warnings)}\n\n${result.html}`);
    }
  );

  // -- Resources ------------------------------------------------------------

  server.registerResource(
    "master-resume",
    "flouka://master",
    {
      title: "Master resume",
      description: "The stored master JSON Resume — the only source of truth for what is true.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(readMaster() ?? null, null, 2),
        },
      ],
    })
  );

  server.registerResource(
    "master-config",
    "flouka://master/config",
    {
      title: "Master resume layout config",
      description: "Section order, font size, line height and locale the master resume renders with.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(readMasterConfig() ?? DEFAULT_CONFIG, null, 2),
        },
      ],
    })
  );

  server.registerResource(
    "applications",
    "flouka://applications",
    {
      title: "Saved applications",
      description: "Job applications saved in Flouka Studio, summarised.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            readApplications().map((app) => ({
              id: app.id,
              name: app.name,
              company: app.jdAnalysis?.company ?? null,
              role_title: app.jdAnalysis?.role_title ?? null,
              createdAt: app.createdAt ?? null,
            })),
            null,
            2
          ),
        },
      ],
    })
  );

  // -- Prompt ---------------------------------------------------------------

  server.registerPrompt(
    "tailor-to-jd",
    {
      title: "Tailor resume to a job description",
      description:
        "Walk through tailoring the master resume to a specific posting and rendering the PDF, with the editorial rules that keep it honest.",
      argsSchema: {
        jd: z.string().describe("The job description / posting text"),
        company: z.string().optional().describe("Company name, for the output filename"),
      },
    },
    ({ jd, company }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Tailor my resume to the job description below, then render it as a PDF.",
              "",
              "Process:",
              "1. Call `get_master_resume`. It is the only allowed source of facts about my background.",
              "2. Read the posting and note the 4-6 requirements that actually matter, and whether the role is backend-, frontend-, product- or leadership-leaning.",
              "3. For each role in `work`, select and reorder its existing highlights so the strongest match comes first. Check that role's `summary` for a technology the posting cares about that the surviving highlights no longer show, and fold it into a bullet where it is true — the Skills section says what I know, Experience has to show where I used it.",
              "4. Reorder `skills` keywords so overlap with the posting leads, but do not bury genuine strengths just because this posting emphasises something else.",
              "5. Adapt `basics.summary` into a short line framing me for this role. Framing only, no new facts, and nothing forward-looking about the company — that belongs in a cover email.",
              "6. Aim for one page: trim the least relevant bullets first. Let it run to two only if the posting genuinely has that many distinct important requirement areas.",
              "7. Call `render_resume_pdf` with the tailored resume" +
                (company ? ` and company: ${JSON.stringify(company)}` : "") +
                ". Pass `config` with a smaller `baseFontSize` (10-11) or a trimmed `sectionOrder` if it needs to fit.",
              "8. Give me the file path.",
              "",
              "Rules that do not bend:",
              "- Never invent or embellish a tool, metric, outcome, date or employer. Tailoring means selecting and reframing what is already there.",
              "- Name, contact details, employment dates, company names, job titles and education stay exactly as stored.",
              "- Plain language. No 'passionate', 'dynamic', 'results-driven', 'leverage', 'synergy', 'detail-oriented', 'team player'.",
              "- Do not call `update_master_resume` or `replace_master_resume` — a tailored resume is for this application, not a change to my master record.",
              "",
              "Job description:",
              "",
              jd,
            ].join("\n"),
          },
        },
      ],
    })
  );
}
