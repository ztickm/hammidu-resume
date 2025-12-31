/**
 * Type declarations for validator package
 * Validates JSON Resume files against the official schema
 */

export type { ResumeSchema } from "@jsonresume/schema";

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
 */
export function validateResume(resume: unknown): ValidationResult;

/**
 * Validate a JSON Resume and throw an error if invalid
 */
export function validateResumeStrict(resume: unknown): import("@jsonresume/schema").ResumeSchema;

/**
 * Validate a JSON string containing a resume
 */
export function validateResumeString(jsonString: string): ValidationResult;

/**
 * Validate a JSON file containing a resume
 */
export function validateResumeFile(filePath: string): Promise<ValidationResult>;
