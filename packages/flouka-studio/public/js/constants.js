/**
 * Shared constants: the section list, default settings, model options and the
 * example resume. MODEL_OPTIONS repeats the registry in packages/agent/src/model.ts,
 * so adding or renaming a model means editing both.
 */

const ALL_SECTIONS = ['summary','work','education','volunteer','skills','languages','awards','publications','projects','certificates','interests','references'];

const DEFAULT_SETTINGS = {
  modelKey: 'claude-opus-4-5',
  promptAddition: '',
  baseFontSize: 12,
  lineHeight: 1.5,
  locale: 'en',
  sectionOrder: [...ALL_SECTIONS],
  pageBreakBefore: [],
  pageBreakAfter: [],
  removedSections: [],
};

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-5',   label: 'Claude Opus 4.5' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { value: 'deepseek-flash',    label: 'DeepSeek Flash (V4.1)' },
  { value: 'deepseek-v4-pro',   label: 'DeepSeek V4 Pro' },
];

const EXAMPLE_RESUME = {
  basics: { name: "Alex Rivera", label: "Full-Stack Engineer", email: "alex@example.com", phone: "+1 (555) 987-6543", url: "https://alexrivera.dev", summary: "Full-stack engineer with 7+ years building scalable web applications and leading cross-functional teams.", location: { city: "Austin", countryCode: "US" } },
  work: [{ name: "CloudBase Inc.", position: "Senior Software Engineer", startDate: "2021-03", summary: "Led backend platform team", highlights: ["Architected microservices migration reducing latency by 40%", "Led team of 5 engineers to deliver 3 major product features", "Implemented CI/CD pipelines cutting release cycles from 2 weeks to 2 days"] }, { name: "DataPulse", position: "Software Engineer", startDate: "2018-06", endDate: "2021-02", highlights: ["Built real-time analytics dashboard serving 10k+ daily users", "Designed REST API consumed by 3 mobile apps"] }],
  education: [{ institution: "University of Texas at Austin", studyType: "Bachelor", area: "Computer Science", startDate: "2014-09", endDate: "2018-05" }],
  skills: [{ name: "Languages", keywords: ["TypeScript", "Python", "Go", "SQL"] }, { name: "Frameworks", keywords: ["React", "Node.js", "FastAPI", "PostgreSQL"] }]
};
