import Handlebars from "handlebars";
import * as jsonT from "./json-resume";
import { formatDate, formatDateOrPresent, joinArray } from "./helpers";
import { readFileSync } from "fs";
import { join } from "path";
import type { GenerateConfig, SectionName } from "./config";
import { DEFAULT_CONFIG } from "./config";

// Load the Handlebars template
const templatePath = join(import.meta.dir, "templates", "harvard-configurable.hbs");
const templateSource = readFileSync(templatePath, "utf-8");
const template = Handlebars.compile(templateSource);

// Register Handlebars helpers
Handlebars.registerHelper("formatDate", formatDate);
Handlebars.registerHelper("formatDateOrPresent", formatDateOrPresent);
Handlebars.registerHelper("join", joinArray);
Handlebars.registerHelper("eq", (a: string, b: string) => a === b);
Handlebars.registerHelper("hasPageBreak", (set: Set<SectionName>, section: SectionName) => {
  return set.has(section);
});

/**
 * Generate HTML from a JSON Resume with optional configuration
 */
export function generateHTML(
  resume: jsonT.ResumeSchema,
  config: GenerateConfig = {}
): string {
  // Merge with defaults
  const finalConfig: Required<GenerateConfig> = {
    sectionOrder: config.sectionOrder ?? DEFAULT_CONFIG.sectionOrder,
    pageBreakBefore: config.pageBreakBefore ?? DEFAULT_CONFIG.pageBreakBefore,
    pageBreakAfter: config.pageBreakAfter ?? DEFAULT_CONFIG.pageBreakAfter,
  };

  // Create a context object with resume data and configuration
  const context = {
    ...resume,
    _config: {
      sectionOrder: finalConfig.sectionOrder,
      pageBreakBefore: new Set(finalConfig.pageBreakBefore),
      pageBreakAfter: new Set(finalConfig.pageBreakAfter),
    },
  };

  return template(context);
}
