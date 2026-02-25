# JSON Resume Types

TypeScript type definitions for the [JSON Resume](https://jsonresume.org/) schema.

## Installation

In a Bun workspace:

```bash
bun add json-resume-types
```

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

## License

MIT
