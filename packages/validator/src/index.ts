import Ajv from "ajv";
import addFormats from "ajv-formats";
import schema from "@jsonresume/schema";
import type { ResumeSchema } from "@jsonresume/schema";

// Create AJV instance with formats support
const ajv = new Ajv({ 
  allErrors: true,
  verbose: true,
  strict: false,
});

// Add format validators (email, uri, date, etc.)
addFormats(ajv);

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
}

/**
 * Validate a JSON Resume against the official schema
 * @param resume - The resume object to validate
 * @returns ValidationResult with valid status and any errors
 */
export function validateResume(resume: unknown): ValidationResult {
  const valid = validate(resume);
  
  if (valid) {
    return { valid: true };
  }
  
  // Format errors for better readability
  const errors = (validate.errors || []).map(error => ({
    path: error.instancePath || "/",
    message: error.message || "Unknown error",
    keyword: error.keyword,
    params: error.params,
  }));
  
  return {
    valid: false,
    errors,
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
