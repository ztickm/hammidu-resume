/**
 * Configuration for HTML/PDF generation
 */

export type SectionName = 
  | "summary"
  | "education"
  | "work"
  | "volunteer"
  | "skills"
  | "languages"
  | "awards"
  | "publications"
  | "projects"
  | "certificates"
  | "interests"
  | "references";

export interface GenerateConfig {
  /**
   * Order of sections in the resume. Sections not listed will not be included.
   * Default order: ["summary", "education", "work", "skills", "languages", "volunteer", 
   *                "awards", "publications", "projects", "certificates", "interests", "references"]
   */
  sectionOrder?: SectionName[];

  /**
   * Sections that should have a page break before them
   * Default: [] (no forced page breaks)
   */
  pageBreakBefore?: SectionName[];

  /**
   * Sections that should have a page break after them
   * Default: [] (no forced page breaks)
   */
  pageBreakAfter?: SectionName[];
}

export const DEFAULT_SECTION_ORDER: SectionName[] = [
  "summary",
  "education",
  "work",
  "skills",
  "languages",
  "volunteer",
  "awards",
  "publications",
  "projects",
  "certificates",
  "interests",
  "references",
];

export const DEFAULT_CONFIG: Required<GenerateConfig> = {
  sectionOrder: DEFAULT_SECTION_ORDER,
  pageBreakBefore: [],
  pageBreakAfter: [],
};
