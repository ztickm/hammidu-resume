/// <reference lib="dom" />
import Ajv from "ajv";
import addFormats from "ajv-formats";
import jsonResumeSchema from "@jsonresume/schema";
import type { ResumeSchema } from "json-resume-types";

// The package exports { validate, schema, jobSchema } - we need the JSON Schema
// itself. Compiling the module object instead silently produces a validator that
// accepts everything (AJV treats unknown keywords as no-ops in non-strict mode).
const schema: object = (jsonResumeSchema as any).schema ?? jsonResumeSchema;

// Create AJV instance with formats support and strict validation
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
  validateFormats: true, // Enable format validation
  strictTypes: false, // Allow type coercion warnings
});

// Add format validators (email, uri, date, etc.) with strict mode
addFormats(ajv, { mode: "full", formats: ["email", "uri", "date"] });

// Compile the JSON Resume schema
const validate = ajv.compile(schema);

export interface ValidationIssue {
  /** Dotted path to the offending value, e.g. "work[0].startDate" ("" = whole document) */
  path: string;
  /** Human-readable explanation of what is wrong */
  message: string;
  severity: "error" | "warning";
  keyword?: string;
  params?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  /** Schema violations (the document does not match the JSON Resume schema) */
  errors?: ValidationIssue[];
  /** Practical problems, kept as strings for backwards compatibility */
  warnings?: string[];
  /** Every problem found, errors first — the full reason the resume is invalid */
  issues?: ValidationIssue[];
  /** Ready-to-print multi-line explanation of why the resume is invalid */
  summary?: string;
}

/**
 * Turn an AJV instancePath ("/work/0/startDate") into a readable dotted path
 * ("work[0].startDate"). Returns "" for the document root.
 */
function formatPath(instancePath: string): string {
  if (!instancePath) return "";
  return instancePath
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))
    .map((segment) => (/^\d+$/.test(segment) ? `[${segment}]` : `.${segment}`))
    .join("")
    .replace(/^\./, "");
}

/** Short, safe preview of an offending value for inclusion in a message */
function preview(value: unknown): string {
  if (value === undefined) return "";
  let rendered: string;
  try {
    rendered = JSON.stringify(value) ?? String(value);
  } catch {
    rendered = String(value);
  }
  if (rendered.length > 60) rendered = `${rendered.slice(0, 57)}...`;
  return ` (received ${rendered})`;
}

/** Name the runtime type of a value the way a user would describe it */
function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  switch (typeof value) {
    case "string": return "a string";
    case "number": return "a number";
    case "boolean": return "a boolean";
    case "object": return "an object";
    case "undefined": return "nothing";
    default: return typeof value;
  }
}

/** "array" -> "an array", "string" -> "a string" */
function withArticle(type: string): string {
  if (type === "null") return "null";
  return /^[aeiou]/i.test(type) ? `an ${type}` : `a ${type}`;
}

const FORMAT_HINTS: Record<string, string> = {
  email: "email address (e.g. \"you@example.com\")",
  uri: "absolute URL (e.g. \"https://example.com\")",
  date: "date in YYYY-MM-DD form",
};

/**
 * Rewrite a terse AJV error ("must match format \"email\"") into an
 * explanation that says what was expected and what was actually there.
 */
function describeSchemaError(error: any): string {
  const params = error.params || {};
  const value = "data" in error ? error.data : undefined;

  // Blank strings are the most common cause of format/pattern failures
  if (value === "" && (error.keyword === "format" || error.keyword === "pattern")) {
    return "is an empty string - remove the field instead of leaving it blank";
  }

  switch (error.keyword) {
    case "required":
      return `is missing the required property '${params.missingProperty}'`;
    case "type": {
      const types = Array.isArray(params.type) ? params.type : [params.type];
      const expected = types.map(withArticle).join(" or ");
      return `must be ${expected}, but it is ${typeName(value)}${preview(value)}`;
    }
    case "format": {
      const hint = FORMAT_HINTS[params.format] ?? `value of format "${params.format}"`;
      return `must be a valid ${hint}${preview(value)}`;
    }
    case "pattern": {
      // The schema's date pattern is unreadable as a regex - name it instead
      if (typeof params.pattern === "string" && params.pattern.includes("[1-2][0-9]{3}")) {
        return `must be a date in YYYY-MM-DD, YYYY-MM, or YYYY form${preview(value)}`;
      }
      return `does not match the required pattern ${params.pattern}${preview(value)}`;
    }
    case "enum":
      return `must be one of: ${(params.allowedValues || []).join(", ")}${preview(value)}`;
    case "additionalProperties":
      return `has an unknown property '${params.additionalProperty}'`;
    case "minItems":
      return `must have at least ${params.limit} item(s)`;
    case "maxItems":
      return `must have at most ${params.limit} item(s)`;
    case "minLength":
      return `must be at least ${params.limit} character(s) long${preview(value)}`;
    case "maxLength":
      return `must be at most ${params.limit} character(s) long${preview(value)}`;
    case "minimum":
    case "maximum":
    case "exclusiveMinimum":
    case "exclusiveMaximum":
      return `${error.message}${preview(value)}`;
    case "anyOf":
    case "oneOf":
      return `does not match any of the shapes the schema allows here${preview(value)}`;
    default:
      return `${error.message || "is invalid"}${preview(value)}`;
  }
}

/**
 * Additional practical validations beyond the permissive JSON Resume schema
 */
function performPracticalValidation(resume: any): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const warn = (path: string, message: string) =>
    issues.push({ path, message, severity: "warning" });

  // Check for basics
  if (!resume.basics) {
    warn("basics", "is missing - this section is highly recommended");
  } else {
    // Check for name (most important field)
    if (!resume.basics.name || resume.basics.name.trim() === "") {
      warn("basics.name", "is missing or empty - this is essential for a resume");
    }

    // Check for contact info
    if (!resume.basics.email && !resume.basics.phone) {
      warn(
        "basics",
        "has no contact information (email or phone) - employers need a way to reach you"
      );
    }

    // Validate email format if present
    if (resume.basics.email && typeof resume.basics.email === "string") {
      // Username: alphanumeric with optional dots and + in the middle
      // Domain: alphanumeric with optional .tld
      const emailRegex = /^[a-zA-Z0-9]+([.+][a-zA-Z0-9]+)*@[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/;
      if (!emailRegex.test(resume.basics.email)) {
        warn("basics.email", `is not a valid email address${preview(resume.basics.email)}`);
      }
    }

    // Validate URL format if present
    if (resume.basics.url && typeof resume.basics.url === "string") {
      try {
        new URL(resume.basics.url);
      } catch {
        warn(
          "basics.url",
          `is not a valid absolute URL - include the scheme, e.g. "https://"${preview(resume.basics.url)}`
        );
      }
    }
  }

  // Check for at least one of: work, education, projects
  if (!resume.work?.length && !resume.education?.length && !resume.projects?.length) {
    warn("", "Resume has no work experience, education, or projects - add at least one section");
  }

  // Validate date formats in work experience
  if (resume.work && Array.isArray(resume.work)) {
    resume.work.forEach((job: any, index: number) => {
      if (job.startDate && !isValidISO8601(job.startDate)) {
        warn(`work[${index}].startDate`, `has an invalid format${preview(job.startDate)} - expected YYYY-MM-DD, YYYY-MM, or YYYY`);
      }
      if (job.endDate && !isValidISO8601(job.endDate)) {
        warn(`work[${index}].endDate`, `has an invalid format${preview(job.endDate)} - expected YYYY-MM-DD, YYYY-MM, or YYYY`);
      }
      if (!job.name && !job.position) {
        warn(`work[${index}]`, "is missing both company name and position");
      }
    });
  }

  // Validate date formats in education
  if (resume.education && Array.isArray(resume.education)) {
    resume.education.forEach((edu: any, index: number) => {
      if (edu.startDate && !isValidISO8601(edu.startDate)) {
        warn(`education[${index}].startDate`, `has an invalid format${preview(edu.startDate)} - expected YYYY-MM-DD, YYYY-MM, or YYYY`);
      }
      if (edu.endDate && !isValidISO8601(edu.endDate)) {
        warn(`education[${index}].endDate`, `has an invalid format${preview(edu.endDate)} - expected YYYY-MM-DD, YYYY-MM, or YYYY`);
      }
      if (!edu.institution && !edu.area) {
        warn(`education[${index}]`, "is missing both institution and area of study");
      }
    });
  }

  // Validate date formats in projects
  if (resume.projects && Array.isArray(resume.projects)) {
    resume.projects.forEach((project: any, index: number) => {
      if (project.startDate && !isValidISO8601(project.startDate)) {
        warn(`projects[${index}].startDate`, `has an invalid format${preview(project.startDate)} - expected YYYY-MM-DD, YYYY-MM, or YYYY`);
      }
      if (project.endDate && !isValidISO8601(project.endDate)) {
        warn(`projects[${index}].endDate`, `has an invalid format${preview(project.endDate)} - expected YYYY-MM-DD, YYYY-MM, or YYYY`);
      }
      if (!project.name) {
        warn(`projects[${index}]`, "is missing a name");
      }
    });
  }

  // Validate profile URLs
  if (resume.basics?.profiles && Array.isArray(resume.basics.profiles)) {
    resume.basics.profiles.forEach((profile: any, index: number) => {
      if (profile.url) {
        try {
          new URL(profile.url);
        } catch {
          warn(
            `basics.profiles[${index}].url`,
            `is not a valid absolute URL${preview(profile.url)}`
          );
        }
      }
    });
  }

  // Check for type mismatches
  for (const section of ["work", "education", "skills", "projects", "languages"]) {
    if (resume[section] && !Array.isArray(resume[section])) {
      warn(section, `must be an array, but it is ${typeName(resume[section])}`);
    }
  }

  return issues;
}

/**
 * Validate ISO8601 date format (YYYY-MM-DD, YYYY-MM, or YYYY)
 */
function isValidISO8601(dateString: string): boolean {
  const pattern = /^([1-2][0-9]{3}(-[0-1][0-9](-[0-3][0-9])?)?)$/;
  if (!pattern.test(dateString)) {
    return false;
  }

  // Additional validation for month/day ranges
  const parts = dateString.split("-");
  if (parts.length >= 2) {
    const month = parseInt(parts[1]!, 10);
    if (month < 1 || month > 12) return false;
  }
  if (parts.length === 3) {
    const day = parseInt(parts[2]!, 10);
    if (day < 1 || day > 31) return false;
  }

  return true;
}

/** Render one issue as a single readable line */
export function formatIssue(issue: ValidationIssue): string {
  const label = issue.severity === "error" ? "error" : "warning";
  return issue.path
    ? `${label}: ${issue.path} ${issue.message}`
    : `${label}: ${issue.message}`;
}

/** Render every issue as a multi-line explanation */
export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `  - ${formatIssue(issue)}`).join("\n");
}

/** Build the result object shared by every entry point */
function buildResult(errors: ValidationIssue[], allWarnings: ValidationIssue[]): ValidationResult {
  // A schema error already explains the problem at that path; the equivalent
  // practical warning would just repeat it in slightly different words.
  const errorPaths = new Set(errors.map((issue) => issue.path).filter(Boolean));
  const warnings = allWarnings.filter((issue) => !issue.path || !errorPaths.has(issue.path));

  if (errors.length === 0 && warnings.length === 0) {
    return { valid: true };
  }

  const issues = [...errors, ...warnings];
  return {
    valid: false,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings.map(formatIssue) : undefined,
    issues,
    summary: formatIssues(issues),
  };
}

/**
 * Validate a JSON Resume against the official schema + practical checks
 * @param resume - The resume object to validate
 * @returns ValidationResult with valid status and any errors/warnings
 */
export function validateResume(resume: unknown): ValidationResult {
  if (resume === null || typeof resume !== "object" || Array.isArray(resume)) {
    return buildResult(
      [{
        path: "",
        message: `Resume must be a JSON object, but it is ${typeName(resume)}${preview(resume)}`,
        severity: "error",
        keyword: "type",
      }],
      []
    );
  }

  // Populates validate.errors; the pass/fail verdict is recomputed from the
  // collected issues below, since practical warnings also make a resume invalid.
  validate(resume);

  const errors: ValidationIssue[] = (validate.errors || []).map((error: any) => ({
    path: formatPath(error.instancePath),
    message: describeSchemaError(error),
    severity: "error" as const,
    keyword: error.keyword,
    params: error.params,
  }));

  // Always perform practical validation
  const warnings = performPracticalValidation(resume);

  return buildResult(errors, warnings);
}

/**
 * Validate a JSON Resume and throw an error if invalid
 * @param resume - The resume object to validate
 * @throws Error with validation details if invalid
 * @returns The validated resume
 */
export function validateResumeStrict(resume: unknown): ResumeSchema {
  const result = validateResume(resume);

  if (!result.valid) {
    throw new Error(`Invalid JSON Resume:\n${result.summary}`);
  }

  return resume as ResumeSchema;
}

/**
 * Turn a character offset into a "line X, column Y" location
 */
function locateOffset(text: string, offset: number): string {
  const upTo = text.slice(0, Math.max(0, offset));
  const line = upTo.split("\n").length;
  const column = offset - upTo.lastIndexOf("\n");
  return `line ${line}, column ${column}`;
}

/**
 * Validate a JSON string containing a resume
 * @param jsonString - JSON string to parse and validate
 * @returns ValidationResult
 */
export function validateResumeString(jsonString: string): ValidationResult {
  let resume: unknown;
  try {
    resume = JSON.parse(jsonString);
  } catch (error) {
    const raw = (error as Error).message;
    const offset = /position (\d+)/.exec(raw)?.[1];
    const where = offset ? ` at ${locateOffset(jsonString, Number(offset))}` : "";
    return buildResult(
      [{
        path: "",
        message: `File is not valid JSON${where}: ${raw}`,
        severity: "error",
        keyword: "json",
      }],
      []
    );
  }
  return validateResume(resume);
}

/**
 * Validate a JSON file containing a resume
 * @param filePath - Path to the JSON file
 * @returns ValidationResult
 */
export async function validateResumeFile(filePath: string): Promise<ValidationResult> {
  let content: string;
  try {
    content = await Bun.file(filePath).text();
  } catch (error) {
    return buildResult(
      [{
        path: "",
        message: `Failed to read file: ${(error as Error).message}`,
        severity: "error",
        keyword: "io",
      }],
      []
    );
  }
  return validateResumeString(content);
}

// Re-export types
export type { ResumeSchema } from "json-resume-types";
