declare module "@jsonresume/schema" {
  const schema: any;
  export default schema;
}
// ISO8601 date string, e.g. "2014-06-29" or "2023-04"
export type ISO8601 = string;

export interface Profile {
  network: string;
  username: string;
  url: string;
}

export interface Location {
  address: string;
  postalCode: string;
  city: string;
  countryCode: string;
  region: string;
}

export interface Basics {
  name: string;
  label: string;
  image: string;
  email: string;
  phone: string;
  url: string;
  summary: string;
  location: Location;
  profiles: Profile[];
}

export interface Work {
  name: string;
  location: string;
  description: string;
  position: string;
  url: string;
  startDate: ISO8601;
  endDate: ISO8601;
  summary: string;
  highlights: string[];
}

export interface Volunteer {
  organization: string;
  position: string;
  url: string;
  startDate: ISO8601;
  endDate: ISO8601;
  summary: string;
  highlights: string[];
}

export interface Education {
  institution: string;
  url: string;
  area: string;
  studyType: string;
  startDate: ISO8601;
  endDate: ISO8601;
  score: string;
  courses: string[];
}

export interface Award {
  title: string;
  date: ISO8601;
  awarder: string;
  summary: string;
}

export interface Certificate {
  name: string;
  date: ISO8601;
  url: string;
  issuer: string;
}

export interface Publication {
  name: string;
  publisher: string;
  releaseDate: ISO8601;
  url: string;
  summary: string;
}

export interface Skill {
  name: string;
  level: string;
  keywords: string[];
}

export interface Language {
  language: string;
  fluency: string;
}

export interface Interest {
  name: string;
  keywords: string[];
}

export interface Reference {
  name: string;
  reference: string;
}

export interface Project {
  name: string;
  description: string;
  highlights: string[];
  keywords: string[];
  startDate: ISO8601;
  endDate: ISO8601;
  url: string;
  roles: string[];
  entity: string;
  type: string;
}

export interface Meta {
  canonical: string;
  version: string;
  lastModified: string;
}

export interface ResumeSchema {
  $schema: string;
  basics: Basics;
  work: Work[];
  volunteer: Volunteer[];
  education: Education[];
  awards: Award[];
  certificates: Certificate[];
  publications: Publication[];
  skills: Skill[];
  languages: Language[];
  interests: Interest[];
  references: Reference[];
  projects: Project[];
  meta: Meta;
}
