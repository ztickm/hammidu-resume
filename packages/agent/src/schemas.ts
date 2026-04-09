/**
 * Zod schemas mirroring `json-resume-types` — used by LangChain's
 * `.with_structured_output()` to enforce JSON-Resume–compliant output.
 *
 * We intentionally keep every field optional to match the permissive
 * JSON-Resume spec, but the `TailoredResumeSchema` narrows the fields
 * the agent is allowed to rewrite.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const iso8601 = z
  .string()
  .describe("ISO-8601 date (e.g. '2024-06' or '2024-06-15')");

// ---------------------------------------------------------------------------
// Sub-objects
// ---------------------------------------------------------------------------

export const ProfileSchema = z.object({
  network: z.string().optional(),
  username: z.string().optional(),
  url: z.string().optional(),
});

export const LocationSchema = z.object({
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryCode: z.string().optional(),
  region: z.string().optional(),
});

export const BasicsSchema = z.object({
  name: z.string().optional(),
  label: z.string().optional(),
  image: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  url: z.string().optional(),
  summary: z.string().optional().describe("Professional summary paragraph tailored to the target role"),
  location: LocationSchema.optional(),
  profiles: z.array(ProfileSchema).optional(),
});

export const WorkSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  position: z.string().optional(),
  url: z.string().optional(),
  startDate: iso8601.optional(),
  endDate: iso8601.optional(),
  summary: z.string().optional(),
  highlights: z
    .array(z.string())
    .optional()
    .describe("Bullet points rewritten to emphasise relevance to the target JD"),
});

export const VolunteerSchema = z.object({
  organization: z.string().optional(),
  position: z.string().optional(),
  url: z.string().optional(),
  startDate: iso8601.optional(),
  endDate: iso8601.optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
});

export const EducationSchema = z.object({
  institution: z.string().optional(),
  url: z.string().optional(),
  area: z.string().optional(),
  studyType: z.string().optional(),
  startDate: iso8601.optional(),
  endDate: iso8601.optional(),
  score: z.string().optional(),
  courses: z.array(z.string()).optional(),
});

export const AwardSchema = z.object({
  title: z.string().optional(),
  date: iso8601.optional(),
  awarder: z.string().optional(),
  summary: z.string().optional(),
});

export const CertificateSchema = z.object({
  name: z.string().optional(),
  date: iso8601.optional(),
  url: z.string().optional(),
  issuer: z.string().optional(),
});

export const PublicationSchema = z.object({
  name: z.string().optional(),
  publisher: z.string().optional(),
  releaseDate: iso8601.optional(),
  url: z.string().optional(),
  summary: z.string().optional(),
});

export const SkillSchema = z.object({
  name: z.string().optional(),
  level: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

export const LanguageSchema = z.object({
  language: z.string().optional(),
  fluency: z.string().optional(),
});

export const InterestSchema = z.object({
  name: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

export const ReferenceSchema = z.object({
  name: z.string().optional(),
  reference: z.string().optional(),
});

export const ProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  startDate: iso8601.optional(),
  endDate: iso8601.optional(),
  url: z.string().optional(),
  roles: z.array(z.string()).optional(),
  entity: z.string().optional(),
  type: z.string().optional(),
});

export const MetaSchema = z.object({
  canonical: z.string().optional(),
  version: z.string().optional(),
  lastModified: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Full Resume (for validation / round-trip safety)
// ---------------------------------------------------------------------------

export const ResumeZodSchema = z.object({
  $schema: z.string().optional(),
  basics: BasicsSchema.optional(),
  work: z.array(WorkSchema).optional(),
  volunteer: z.array(VolunteerSchema).optional(),
  education: z.array(EducationSchema).optional(),
  awards: z.array(AwardSchema).optional(),
  certificates: z.array(CertificateSchema).optional(),
  publications: z.array(PublicationSchema).optional(),
  skills: z.array(SkillSchema).optional(),
  languages: z.array(LanguageSchema).optional(),
  interests: z.array(InterestSchema).optional(),
  references: z.array(ReferenceSchema).optional(),
  projects: z.array(ProjectSchema).optional(),
  meta: MetaSchema.optional(),
});

export type ResumeZod = z.infer<typeof ResumeZodSchema>;

// ---------------------------------------------------------------------------
// Tailored output — only the fields the agent is allowed to rewrite
// ---------------------------------------------------------------------------

export const TailoredResumeSchema = z
  .object({
    basics: z
      .object({
        summary: z
          .string()
          .describe(
            "Rewritten professional summary emphasising alignment with the target JD"
          ),
      })
      .describe("Only the basics.summary is rewritten; other basics fields are preserved"),
    work: z
      .array(
        z.object({
          name: z
            .string()
            .describe("Company name — must match the original exactly"),
          position: z
            .string()
            .describe("Job title — must match the original exactly"),
          highlights: z
            .array(z.string())
            .describe(
              "Bullet points rewritten to align with the target JD while preserving factual accuracy"
            ),
        })
      )
      .describe(
        "One entry per work experience in the master resume, same order"
      ),
  })
  .describe(
    "Tailored portions of the resume — will be merged back into the master resume"
  );

export type TailoredResume = z.infer<typeof TailoredResumeSchema>;
