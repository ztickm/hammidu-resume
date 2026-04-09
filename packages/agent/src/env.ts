/**
 * Load environment variables from the monorepo root .env file.
 *
 * Bun auto-loads .env from the process cwd, but when the agent is invoked
 * from packages/agent/ (or any sub-directory) it misses the root .env.
 * This module resolves the root explicitly using import.meta.dir and calls
 * Bun's built-in dotenv loader so all subsequent `process.env` reads work
 * normally throughout the process.
 *
 * Import this as the very first side-effecting import in cli.ts / example.ts.
 */

import { resolve } from "path";
import { existsSync } from "fs";

// packages/agent/src/ → up three levels → monorepo root
const MONOREPO_ROOT = resolve(import.meta.dir, "../../..");
const ENV_PATH = resolve(MONOREPO_ROOT, ".env");

if (existsSync(ENV_PATH)) {
  // Bun's native dotenv — only sets vars that aren't already defined so
  // explicit shell env always takes precedence.
  const parsed = await Bun.file(ENV_PATH).text();
  for (const line of parsed.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const raw = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes if present
    const value = raw.replace(/^(['"])(.*)\1$/, "$2");
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}
