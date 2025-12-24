import Handlebars from "handlebars";
import * as jsonT from "./json-resume";
import { formatDate, formatDateOrPresent, joinArray } from "./helpers";
import { readFileSync } from "fs";
import { join } from "path";

// Load the Handlebars template
const templatePath = join(import.meta.dir, "templates", "harvard.hbs");
const templateSource = readFileSync(templatePath, "utf-8");
const template = Handlebars.compile(templateSource);

// Register Handlebars helpers
Handlebars.registerHelper("formatDate", formatDate);
Handlebars.registerHelper("formatDateOrPresent", formatDateOrPresent);
Handlebars.registerHelper("join", joinArray);

/**
 * Generate HTML from a JSON Resume
 */
export function generateHTML(resume: jsonT.ResumeSchema): string {
  return template(resume);
}
