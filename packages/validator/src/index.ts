import Ajv from "ajv";
import addFormats from "ajv-formats";
import schema from "@jsonresume/schema";
import type { ResumeSchema } from "@jsonresume/schema";

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

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    keyword?: string;
    params?: Record<string, unknown>;
  }>;
  warnings?: string[];
}

/**
 * Additional practical validations beyond the permissive JSON Resume schema
 */
function performPracticalValidation(resume: any): string[] {
  const warnings: string[] = [];

  // Check for basics
  if (!resume.basics) {
    warnings.push("Missing 'basics' section - this is highly recommended");
  } else {
    // Check for name (most important field)
    if (!resume.basics.name || resume.basics.name.trim() === "") {
      warnings.push("Missing or empty 'basics.name' - this is essential for a resume");
    }

    // Check for contact info
    if (!resume.basics.email && !resume.basics.phone) {
      warnings.push("Missing contact information (email or phone) - employers need a way to reach you");
    }

    // Validate email format if present
    if (resume.basics.email && typeof resume.basics.email === "string") {
      // Username: alphanumeric with optional dots and + in the middle
      // Domain: alphanumeric with optional .tld
      const emailRegex = /^[a-zA-Z0-9]+([.+][a-zA-Z0-9]+)*@[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/;
      if (!emailRegex.test(resume.basics.email)) {
        warnings.push(`Invalid email format: '${resume.basics.email}'`);
      }
    }

    // Validate URL format if present
    if (resume.basics.url && typeof resume.basics.url === "string") {
      try {
        new URL(resume.basics.url);
      } catch {
        warnings.push(`Invalid URL format: '${resume.basics.url}'`);
      }
    }
  }

  // Check for at least one of: work, education, projects
  if (!resume.work?.length && !resume.education?.length && !resume.projects?.length) {
    warnings.push("Resume has no work experience, education, or projects - add at least one section");
  }

  // Validate date formats in work experience
  if (resume.work && Array.isArray(resume.work)) {
    resume.work.forEach((job: any, index: number) => {
      if (job.startDate && !isValidISO8601(job.startDate)) {
        warnings.push(`work[${index}].startDate has invalid format: '${job.startDate}' (expected YYYY-MM-DD, YYYY-MM, or YYYY)`);
      }
      if (job.endDate && !isValidISO8601(job.endDate)) {
        warnings.push(`work[${index}].endDate has invalid format: '${job.endDate}' (expected YYYY-MM-DD, YYYY-MM, or YYYY)`);
      }
      if (!job.name && !job.position) {
        warnings.push(`work[${index}] is missing both company name and position`);
      }
    });
  }

  // Validate date formats in education
  if (resume.education && Array.isArray(resume.education)) {
    resume.education.forEach((edu: any, index: number) => {
      if (edu.startDate && !isValidISO8601(edu.startDate)) {
        warnings.push(`education[${index}].startDate has invalid format: '${edu.startDate}'`);
      }
      if (edu.endDate && !isValidISO8601(edu.endDate)) {
        warnings.push(`education[${index}].endDate has invalid format: '${edu.endDate}'`);
      }
      if (!edu.institution && !edu.area) {
        warnings.push(`education[${index}] is missing both institution and area of study`);
      }
    });
  }

  // Validate date formats in projects
  if (resume.projects && Array.isArray(resume.projects)) {
    resume.projects.forEach((project: any, index: number) => {
      if (project.startDate && !isValidISO8601(project.startDate)) {
        warnings.push(`projects[${index}].startDate has invalid format: '${project.startDate}'`);
      }
      if (project.endDate && !isValidISO8601(project.endDate)) {
        warnings.push(`projects[${index}].endDate has invalid format: '${project.endDate}'`);
      }
      if (!project.name) {
        warnings.push(`projects[${index}] is missing a name`);
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
          warnings.push(`basics.profiles[${index}].url has invalid format: '${profile.url}'`);
        }
      }
    });
  }

  // Check for type mismatches
  if (resume.work && !Array.isArray(resume.work)) {
    warnings.push("'work' should be an array");
  }
  if (resume.education && !Array.isArray(resume.education)) {
    warnings.push("'education' should be an array");
  }
  if (resume.skills && !Array.isArray(resume.skills)) {
    warnings.push("'skills' should be an array");
  }
  if (resume.projects && !Array.isArray(resume.projects)) {
    warnings.push("'projects' should be an array");
  }
  if (resume.languages && !Array.isArray(resume.languages)) {
    warnings.push("'languages' should be an array");
  }

  return warnings;
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

/**
 * Validate a JSON Resume against the official schema + practical checks
 * @param resume - The resume object to validate
 * @returns ValidationResult with valid status and any errors/warnings
 */
export function validateResume(resume: unknown): ValidationResult {
  const valid = validate(resume);
  
  // Always perform practical validation
  const warnings = performPracticalValidation(resume);
  
  if (valid && warnings.length === 0) {
    return { valid: true };
  }
  
  // Format schema errors for better readability
  const errors = (validate.errors || []).map((error: any) => ({
    path: error.instancePath || "/",
    message: error.message || "Unknown error",
    keyword: error.keyword,
    params: error.params,
  }));
  
  return {
    valid: valid && warnings.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
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
    const errorMessages = result.errors!
      .map(err => `  - ${err.path}: ${err.message}`)
      .join("\n");
    
    throw new Error(`Invalid JSON Resume:\n${errorMessages}`);
  }
  
  return resume as ResumeSchema;
}

/**
 * Validate a JSON string containing a resume
 * @param jsonString - JSON string to parse and validate
 * @returns ValidationResult
 */
export function validateResumeString(jsonString: string): ValidationResult {
  try {
    const resume = JSON.parse(jsonString);
    return validateResume(resume);
  } catch (error) {
    return {
      valid: false,
      errors: [{
        path: "/",
        message: `Invalid JSON: ${(error as Error).message}`,
      }],
    };
  }
}

/**
 * Validate a JSON file containing a resume
 * @param filePath - Path to the JSON file
 * @returns ValidationResult
 */
export async function validateResumeFile(filePath: string): Promise<ValidationResult> {
  try {
    const content = await Bun.file(filePath).text();
    return validateResumeString(content);
  } catch (error) {
    return {
      valid: false,
      errors: [{
        path: "/",
        message: `Failed to read file: ${(error as Error).message}`,
      }],
    };
  }
}

// Re-export types
export type { ResumeSchema } from "@jsonresume/schema";
