import Handlebars from "handlebars";
import * as jsonT from "json-resume-types";
import { displayUrl, findProfile, formatDate, formatDateOrPresent, joinArray } from "./helpers";
import { readFileSync } from "fs";
import { join } from "path";
import type { GenerateConfig, SectionName } from "./config";
import type { ISO8601 } from "json-resume-types";
import { DEFAULT_CONFIG, LABELS } from "./config";
import { validateResumeStrict } from "validator";

// Load the Handlebars template
const templatePath = join(import.meta.dir, "templates", "harvard-configurable.hbs");
const templateSource = readFileSync(templatePath, "utf-8");
const template = Handlebars.compile(templateSource);

// Register Handlebars helpers
// The date helpers read the locale off the root context: entries sit inside two
// nested #each blocks, where "../_config" resolves against the section name.
Handlebars.registerHelper("formatDate", (date: ISO8601 | undefined, options: Handlebars.HelperOptions) =>
  formatDate(date, options.data.root._config.locale)
);
Handlebars.registerHelper("formatDateOrPresent", (date: ISO8601 | undefined, options: Handlebars.HelperOptions) =>
  formatDateOrPresent(date, options.data.root._config.locale)
);
Handlebars.registerHelper("join", joinArray);
Handlebars.registerHelper("findProfile", findProfile);
Handlebars.registerHelper("displayUrl", displayUrl);
Handlebars.registerHelper("eq", (a: string, b: string) => a === b);
Handlebars.registerHelper("hasPageBreak", (set: Set<SectionName>, section: SectionName) => {
  return set.has(section);
});

/**
 * Generate HTML from a JSON Resume with optional configuration
 * @throws Error if resume is invalid
 */
export function generateHTML(
  resume: jsonT.ResumeSchema,
  config: GenerateConfig = {}
): string {
  // Validate resume before generating HTML
  validateResumeStrict(resume);

  // Merge with defaults
  const finalConfig: Required<GenerateConfig> = {
    sectionOrder: config.sectionOrder ?? DEFAULT_CONFIG.sectionOrder,
    pageBreakBefore: config.pageBreakBefore ?? DEFAULT_CONFIG.pageBreakBefore,
    pageBreakAfter: config.pageBreakAfter ?? DEFAULT_CONFIG.pageBreakAfter,
    baseFontSize: config.baseFontSize ?? DEFAULT_CONFIG.baseFontSize,
    lineHeight: config.lineHeight ?? DEFAULT_CONFIG.lineHeight,
    locale: config.locale ?? DEFAULT_CONFIG.locale,
  };

  const labels = LABELS[finalConfig.locale] ?? LABELS.en;

  // Create a context object with resume data and configuration
  const context = {
    ...resume,
    _config: {
      sectionOrder: finalConfig.sectionOrder,
      pageBreakBefore: new Set(finalConfig.pageBreakBefore),
      pageBreakAfter: new Set(finalConfig.pageBreakAfter),
      baseFontSize: finalConfig.baseFontSize,
      lineHeight: finalConfig.lineHeight,
      locale: finalConfig.locale,
      rtl: finalConfig.locale === "ar",
      labels,
    },
  };

  return template(context);
}
