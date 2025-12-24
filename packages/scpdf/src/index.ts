// Export types
export type * as JsonResumeTypes from "./json-resume.d.ts";
export type { ResumeSchema } from "./json-resume.d.ts";
export type { GenerateConfig, SectionName } from "./config";

// Export functions
export { generateHTML } from "./html-generator";
export { formatDate, formatDateOrPresent, joinArray } from "./helpers";
export { DEFAULT_SECTION_ORDER, DEFAULT_CONFIG } from "./config";
