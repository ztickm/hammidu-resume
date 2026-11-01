/**
 * Store access for the MCP server.
 *
 * Reads and writes the same bun:sqlite key-value store Flouka Studio uses
 * (packages/flouka-studio/storage.ts), so a resume written here opens in the
 * web app and vice versa — both the master resume and the application list.
 *
 * Every write snapshots the previous value first. The browser keeps a
 * write-through cache of these keys, so an open tab can overwrite what we just
 * wrote; the snapshot makes that recoverable instead of fatal.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getAll, setValue, STORE_PATH, type StoreKey } from "flouka-studio/storage";
import type { ResumeSchema } from "json-resume-types";
import type { GenerateConfig, SectionName } from "xebec-render";

// ---------------------------------------------------------------------------
// Shapes the SPA persists (see public/js — Store / NewApp)
// ---------------------------------------------------------------------------

export interface JDAnalysisLike {
  company?: string;
  role_title?: string;
  [key: string]: unknown;
}

/**
 * An application's config is *settings*-shaped, not `GenerateConfig`-shaped: it
 * carries an extra `removedSections` that only the SPA uses, to remember which
 * sections were hidden so its layout editor can offer them back. The web app
 * strips it via `appRenderConfig()` before rendering. Writing it means the
 * application we create is fully editable rather than half-initialised.
 */
export interface AppConfig extends GenerateConfig {
  removedSections?: SectionName[];
}

export interface StoredApplication {
  id: string;
  name?: string;
  createdAt?: string;
  jd?: string;
  jdAnalysis?: JDAnalysisLike | null;
  tailoredResume?: ResumeSchema;
  chatHistory?: unknown[];
  config?: AppConfig;
}

/** Warning appended to every mutating tool result — the SPA won't notice our write. */
export const RELOAD_NOTICE =
  "If Flouka Studio is open in a browser, reload it: the page caches this data and would otherwise show stale state (and could overwrite this change on its next edit).";

/** Where the SPA serves an application from, so the model can hand over a link. */
export function applicationUrl(id: string): string {
  return `http://localhost:3020/#app/${id}`;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function readMaster(): ResumeSchema | null {
  return (getAll().flouka_master as ResumeSchema | null) ?? null;
}

/** The master resume's own layout config — distinct from `flouka_settings`. */
export function readMasterConfig(): GenerateConfig | null {
  return (getAll().flouka_master_config as GenerateConfig | null) ?? null;
}

export function readApplications(): StoredApplication[] {
  const apps = getAll().flouka_apps;
  return Array.isArray(apps) ? (apps as StoredApplication[]) : [];
}

export function findApplication(id: string): StoredApplication | undefined {
  return readApplications().find((app) => app.id === id);
}

/** `readMaster()` or a thrown error that tells the caller how to fix it. */
export function requireMaster(): ResumeSchema {
  const master = readMaster();
  if (!master) {
    throw new Error(
      `No master resume is stored (${STORE_PATH}). Onboard in Flouka Studio ` +
        "(run `bun run web`, open http://localhost:3020) or pass `resume` inline to this tool."
    );
  }
  return master;
}

// ---------------------------------------------------------------------------
// Patch merge
// ---------------------------------------------------------------------------

/**
 * Array sections replaced wholesale when present in a patch. `work` and
 * `volunteer` are handled separately because their entries carry hand-written
 * highlights worth merging rather than clobbering.
 */
const REPLACED_SECTIONS = [
  "education",
  "skills",
  "languages",
  "projects",
  "awards",
  "certificates",
  "publications",
  "interests",
  "references",
] as const satisfies readonly (keyof ResumeSchema)[];

type EntryKeyed = Record<string, unknown>;

/** Shallow-merge only the keys the patch actually provides. */
function mergeProvided(target: EntryKeyed, patch: EntryKeyed): string[] {
  const touched: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    target[key] = value;
    touched.push(key);
  }
  return touched;
}

/**
 * Merge a partial resume into the master, following the same conservative shape
 * as `applyChatEdit` in packages/flouka-studio/web-server.ts: entries are
 * matched on their identifying fields and only the provided keys are written.
 *
 * Unlike the chat path, an unmatched `work`/`volunteer` entry is appended
 * rather than dropped — "I started a new job" is a legitimate master edit — and
 * every addition is named in the returned summary so it can't happen quietly.
 */
export function mergeResumePatch(
  master: ResumeSchema,
  patch: Partial<ResumeSchema>
): { merged: ResumeSchema; changes: string[] } {
  const merged: ResumeSchema = structuredClone(master);
  const changes: string[] = [];

  if (patch.basics) {
    merged.basics ??= {};
    const touched = mergeProvided(
      merged.basics as EntryKeyed,
      patch.basics as EntryKeyed
    );
    if (touched.length > 0) changes.push(`basics: updated ${touched.join(", ")}`);
  }

  if (patch.work) {
    merged.work ??= [];
    let updated = 0;
    const added: string[] = [];
    for (const entry of patch.work) {
      const match = merged.work.find(
        (w) => w.name === entry.name && w.position === entry.position
      );
      if (match) {
        mergeProvided(match as EntryKeyed, entry as EntryKeyed);
        updated++;
      } else {
        merged.work.push(entry);
        added.push(`${entry.position ?? "?"} @ ${entry.name ?? "?"}`);
      }
    }
    const parts: string[] = [];
    if (updated > 0) parts.push(`${updated} updated`);
    if (added.length > 0) parts.push(`${added.length} ADDED (${added.join("; ")})`);
    if (parts.length > 0) changes.push(`work: ${parts.join(", ")}`);
  }

  if (patch.volunteer) {
    merged.volunteer ??= [];
    let updated = 0;
    const added: string[] = [];
    for (const entry of patch.volunteer) {
      const match = merged.volunteer.find(
        (v) => v.organization === entry.organization && v.position === entry.position
      );
      if (match) {
        mergeProvided(match as EntryKeyed, entry as EntryKeyed);
        updated++;
      } else {
        merged.volunteer.push(entry);
        added.push(`${entry.position ?? "?"} @ ${entry.organization ?? "?"}`);
      }
    }
    const parts: string[] = [];
    if (updated > 0) parts.push(`${updated} updated`);
    if (added.length > 0) parts.push(`${added.length} ADDED (${added.join("; ")})`);
    if (parts.length > 0) changes.push(`volunteer: ${parts.join(", ")}`);
  }

  for (const section of REPLACED_SECTIONS) {
    const value = patch[section];
    if (value === undefined) continue;
    Object.assign(merged, { [section]: value });
    const count = Array.isArray(value) ? value.length : 0;
    changes.push(`${section}: replaced (${count} ${count === 1 ? "entry" : "entries"})`);
  }

  if (patch.meta) {
    merged.meta ??= {};
    const touched = mergeProvided(merged.meta as EntryKeyed, patch.meta as EntryKeyed);
    if (touched.length > 0) changes.push(`meta: updated ${touched.join(", ")}`);
  }

  return { merged, changes };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Backups sit beside the SQLite file, inside the already-gitignored data dir. */
const BACKUP_DIR = resolve(dirname(STORE_PATH), "backups");

/**
 * Copy a store key's current value to a timestamped file.
 * Returns the backup path, or null when there was nothing stored yet.
 */
export function backupKey(key: StoreKey): string | null {
  const current = getAll()[key];
  if (current == null) return null;

  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(BACKUP_DIR, `${key}_${stamp}.json`);
  writeFileSync(path, JSON.stringify(current, null, 2));
  return path;
}

/** Snapshot, then overwrite `flouka_master`. Callers validate first. */
export function writeMaster(resume: ResumeSchema): { backupPath: string | null } {
  const backupPath = backupKey("flouka_master");
  setValue("flouka_master", resume);
  return { backupPath };
}

// ---------------------------------------------------------------------------
// Application writes
// ---------------------------------------------------------------------------

/**
 * Every section the SPA knows about, in its own default order.
 *
 * Mirrors `ALL_SECTIONS` in public/js/constants.js — which is deliberately a
 * different order from xebec-render's `DEFAULT_SECTION_ORDER`. An application
 * config belongs to the web UI, so it follows the web UI's list.
 */
const ALL_SECTIONS: SectionName[] = [
  "summary",
  "work",
  "education",
  "volunteer",
  "skills",
  "languages",
  "awards",
  "publications",
  "projects",
  "certificates",
  "interests",
  "references",
];

/** Layout defaults new applications inherit — `flouka_settings`, as the SPA reads it. */
function readSettings(): AppConfig {
  const stored = (getAll().flouka_settings ?? {}) as Record<string, unknown>;
  return {
    sectionOrder: (stored.sectionOrder as SectionName[] | undefined) ?? [...ALL_SECTIONS],
    pageBreakBefore: (stored.pageBreakBefore as SectionName[] | undefined) ?? [],
    pageBreakAfter: (stored.pageBreakAfter as SectionName[] | undefined) ?? [],
    removedSections: (stored.removedSections as SectionName[] | undefined) ?? [],
    baseFontSize: (stored.baseFontSize as number | undefined) ?? 12,
    lineHeight: (stored.lineHeight as number | undefined) ?? 1.5,
    locale: (stored.locale as AppConfig["locale"]) ?? "en",
  };
}

/**
 * Build an application config: the stored settings, with the caller's overrides
 * on top. A caller who trims `sectionOrder` gets the sections they dropped
 * recorded in `removedSections`, so the web UI's layout editor offers them back
 * instead of losing them.
 */
export function buildAppConfig(overrides: AppConfig | undefined): AppConfig {
  const config: AppConfig = { ...readSettings(), ...(overrides ?? {}) };

  if (overrides?.sectionOrder && !overrides.removedSections) {
    const kept = new Set(overrides.sectionOrder);
    config.removedSections = ALL_SECTIONS.filter((section) => !kept.has(section));
  }

  return config;
}

/** The SPA's id scheme (public/js/utils.js — `uid()`), so ids look native. */
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** The SPA's naming scheme (public/js/utils.js — `deriveAppName()`). */
function deriveAppName(resume: ResumeSchema, analysis: JDAnalysisLike | null): string {
  const name = resume.basics?.name || "Resume";
  const role = analysis?.role_title || "";
  const company = analysis?.company || "";
  if (role && company) return `${name} — ${role} @ ${company}`;
  if (company) return `${name} @ ${company}`;
  if (role) return `${name} — ${role}`;
  return name;
}

export interface CreateApplicationInput {
  tailoredResume: ResumeSchema;
  jd?: string;
  company?: string;
  roleTitle?: string;
  name?: string;
  config?: AppConfig;
}

/**
 * Add an application to `flouka_apps`, newest first — `Store.addApp` in the SPA
 * unshifts, and the list page renders in stored order.
 */
export function createApplication(input: CreateApplicationInput): {
  app: StoredApplication;
  backupPath: string | null;
} {
  const analysis: JDAnalysisLike | null =
    input.company || input.roleTitle
      ? { company: input.company ?? "", role_title: input.roleTitle ?? "" }
      : null;

  const app: StoredApplication = {
    id: uid(),
    name: input.name || deriveAppName(input.tailoredResume, analysis),
    createdAt: new Date().toISOString(),
    jd: input.jd ?? "",
    jdAnalysis: analysis,
    tailoredResume: input.tailoredResume,
    chatHistory: [],
    config: buildAppConfig(input.config),
  };

  const backupPath = backupKey("flouka_apps");
  setValue("flouka_apps", [app, ...readApplications()]);
  return { app, backupPath };
}

export interface UpdateApplicationInput {
  tailoredResume?: ResumeSchema;
  jd?: string;
  company?: string;
  roleTitle?: string;
  name?: string;
  config?: AppConfig;
}

/** Patch one application in place, leaving the rest of the list untouched. */
export function updateApplication(
  id: string,
  patch: UpdateApplicationInput
): { app: StoredApplication; changed: string[]; backupPath: string | null } {
  const apps = readApplications();
  const index = apps.findIndex((app) => app.id === id);
  if (index === -1) {
    throw new Error(`No application with id "${id}". Call list_applications to see the stored ids.`);
  }

  const existing = apps[index]!;
  const next: StoredApplication = { ...existing };
  const changed: string[] = [];

  if (patch.tailoredResume) {
    next.tailoredResume = patch.tailoredResume;
    changed.push("tailoredResume");
  }
  if (patch.jd !== undefined) {
    next.jd = patch.jd;
    changed.push("jd");
  }
  if (patch.company !== undefined || patch.roleTitle !== undefined) {
    next.jdAnalysis = {
      ...(existing.jdAnalysis ?? {}),
      company: patch.company ?? existing.jdAnalysis?.company ?? "",
      role_title: patch.roleTitle ?? existing.jdAnalysis?.role_title ?? "",
    };
    changed.push("jdAnalysis");
  }
  if (patch.config) {
    next.config = { ...(existing.config ?? buildAppConfig(undefined)), ...patch.config };
    changed.push("config");
  }
  // An explicit name wins; otherwise re-derive it when the company/role moved.
  if (patch.name) {
    next.name = patch.name;
    changed.push("name");
  } else if (changed.includes("jdAnalysis") && next.tailoredResume) {
    next.name = deriveAppName(next.tailoredResume, next.jdAnalysis ?? null);
  }

  if (changed.length === 0) {
    throw new Error("Patch contained no recognised fields — nothing was written.");
  }

  const backupPath = backupKey("flouka_apps");
  apps[index] = next;
  setValue("flouka_apps", apps);
  return { app: next, changed, backupPath };
}
