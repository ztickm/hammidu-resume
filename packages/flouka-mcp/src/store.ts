/**
 * Store access for the MCP server.
 *
 * Reads and writes the same bun:sqlite key-value store Flouka Studio uses
 * (packages/flouka-studio/storage.ts), so a resume edited here shows up in the
 * web app and vice versa. The master resume is read-write; applications
 * (`flouka_apps`) are deliberately read-only — the SPA owns that list.
 *
 * Every master write snapshots the previous value first. The browser keeps a
 * write-through cache of `flouka_master`, so an open tab can overwrite what we
 * just wrote; the snapshot makes that recoverable instead of fatal.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getAll, setValue, STORE_PATH } from "flouka-studio/storage";
import type { ResumeSchema } from "json-resume-types";
import type { GenerateConfig } from "xebec-render";

// ---------------------------------------------------------------------------
// Shapes the SPA persists (see public/index.html — Store / AppsPage.submit)
// ---------------------------------------------------------------------------

export interface JDAnalysisLike {
  company?: string;
  role_title?: string;
  [key: string]: unknown;
}

export interface StoredApplication {
  id: string;
  name?: string;
  createdAt?: string;
  jd?: string;
  jdAnalysis?: JDAnalysisLike | null;
  tailoredResume?: ResumeSchema;
  config?: GenerateConfig;
}

/** Warning appended to every mutating tool result — the SPA won't notice our write. */
export const RELOAD_NOTICE =
  "If Flouka Studio is open in a browser, reload it: the page caches the master resume and would otherwise show stale data (and could overwrite this change on its next edit).";

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
 * Copy the current master resume to a timestamped file.
 * Returns the backup path, or null when there was nothing stored yet.
 */
export function backupMaster(): string | null {
  const current = readMaster();
  if (!current) return null;

  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(BACKUP_DIR, `flouka_master_${stamp}.json`);
  writeFileSync(path, JSON.stringify(current, null, 2));
  return path;
}

/** Snapshot, then overwrite `flouka_master`. Callers validate first. */
export function writeMaster(resume: ResumeSchema): { backupPath: string | null } {
  const backupPath = backupMaster();
  setValue("flouka_master", resume);
  return { backupPath };
}
