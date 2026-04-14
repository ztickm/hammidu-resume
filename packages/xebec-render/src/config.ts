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

export type Locale = "en" | "de" | "fr" | "ar";

export interface SectionLabels {
  education: string;
  work: string;
  volunteer: string;
  skills: string;
  languages: string;
  awards: string;
  publications: string;
  projects: string;
  certificates: string;
  interests: string;
  references: string;
  present: string;
}

export const LABELS: Record<Locale, SectionLabels> = {
  en: {
    education:    "Education",
    work:         "Experience",
    volunteer:    "Volunteer Work",
    skills:       "Skills",
    languages:    "Languages",
    awards:       "Awards & Honors",
    publications: "Publications",
    projects:     "Projects",
    certificates: "Certificates",
    interests:    "Interests",
    references:   "References",
    present:      "Present",
  },
  de: {
    education:    "Ausbildung",
    work:         "Berufserfahrung",
    volunteer:    "Ehrenamtliche Tätigkeit",
    skills:       "Fähigkeiten",
    languages:    "Sprachen",
    awards:       "Auszeichnungen",
    publications: "Publikationen",
    projects:     "Projekte",
    certificates: "Zertifikate",
    interests:    "Interessen",
    references:   "Referenzen",
    present:      "Heute",
  },
  fr: {
    education:    "Formation",
    work:         "Expérience professionnelle",
    volunteer:    "Bénévolat",
    skills:       "Compétences",
    languages:    "Langues",
    awards:       "Prix & Distinctions",
    publications: "Publications",
    projects:     "Projets",
    certificates: "Certifications",
    interests:    "Centres d'intérêt",
    references:   "Références",
    present:      "Aujourd'hui",
  },
  ar: {
    education:    "التعليم",
    work:         "الخبرة المهنية",
    volunteer:    "العمل التطوعي",
    skills:       "المهارات",
    languages:    "اللغات",
    awards:       "الجوائز والتكريمات",
    publications: "المنشورات",
    projects:     "المشاريع",
    certificates: "الشهادات",
    interests:    "الاهتمامات",
    references:   "المراجع",
    present:      "الآن",
  },
};

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

  /**
   * Base font size in pt
   * Default: 12
   */
  baseFontSize?: number;

  /**
   * Line height multiplier
   * Default: 1.5
   */
  lineHeight?: number;

  /**
   * Output language for section headings
   * Default: "en"
   */
  locale?: Locale;
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
  baseFontSize: 12,
  lineHeight: 1.5,
  locale: "en",
};
