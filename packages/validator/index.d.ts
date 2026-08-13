/**
 * Type declarations for validator package
 * Validates JSON Resume files against the official schema
 */

export type { ResumeSchema } from "@jsonresume/schema";

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

/** Render one issue as a single readable line */
export function formatIssue(issue: ValidationIssue): string;

/** Render every issue as a multi-line explanation */
export function formatIssues(issues: ValidationIssue[]): string;

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
