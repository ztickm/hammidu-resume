# JSON Resume Types

TypeScript type definitions for the [JSON Resume](https://jsonresume.org/) schema.

## Installation

Workspace package — it is not published to npm. Depend on it by name inside this monorepo:

```jsonc
// package.json
"dependencies": { "json-resume-types": "workspace:*" }
```

It is types only: `index.ts` contains no runtime code, so importing it costs nothing at run time.

## Usage

```typescript
import type { ResumeSchema, Basics, Work, Education } from "json-resume-types";

const resume: ResumeSchema = {
  basics: {
    name: "John Doe",
    label: "Software Engineer",
    email: "john@example.com",
    // ...
  },
  work: [
    {
      name: "Company Name",
      position: "Software Engineer",
      startDate: "2020-01-01",
      // ...
    }
  ],
  // ...
};
```

## Available Types

- `ResumeSchema` - Main resume interface
- `Basics` - Personal information
- `Work` - Work experience
- `Volunteer` - Volunteer experience
- `Education` - Educational background
- `Award` - Awards received
- `Certificate` - Certifications
- `Publication` - Publications
- `Skill` - Skills
- `Language` - Languages spoken
- `Interest` - Interests
- `Reference` - References
- `Project` - Projects
- `Profile` - Social media profiles
- `Location` - Location information
- `Meta` - Metadata
- `ISO8601` - Date string type

## Related Packages

This package is part of the [hammidu-resume](https://github.com/ztickm/hammidu-resume) monorepo:

- **xebec-render** - HTML generation from JSON Resume
- **flouka-studio** - PDF generation with web interface
- **validator** - JSON Resume schema validator
- **extractor** - Extract JSON Resume from PDFs
- **agent** - LangGraph resume tailoring

## Note on extra fields

Every field is optional, mirroring the permissive official schema. The Harvard template in
`xebec-render` additionally renders `basics.residencyStatus`, which is not part of the spec and so
is not declared here — set it on a plain object if you need it.

## License

MIT
