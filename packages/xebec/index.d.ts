/**
 * Type declarations for xebec package
 * Converts JSON Resume to styled HTML
 */

// Re-export all JSON Resume types from the source
export type {
  ISO8601,
  ResumeSchema,
  Basics,
  Location,
  Profile,
  Work,
  Volunteer,
  Education,
  Award,
  Certificate,
  Publication,
  Skill,
  Language,
  Interest,
  Reference,
  Project,
} from "./src/json-resume.d.ts";

// Re-export configuration types
export type {
  SectionName,
  GenerateConfig,
} from "./src/config.ts";

// Re-export constants
export { DEFAULT_SECTION_ORDER, DEFAULT_CONFIG } from "./src/config.ts";

// Re-export functions
export { generateHTML } from "./src/html-generator.ts";
export { formatDate, formatDateOrPresent, joinArray } from "./src/helpers.ts";

