# Validator

JSON Resume schema validator with **practical validation rules**, built on AJV.

## Features

- ✅ Validates JSON Resume files against the official schema (`@jsonresume/schema`)
- ✅ **Enhanced practical validation** beyond the permissive official schema
- ✅ Rewrites terse AJV messages into readable explanations that quote the offending value
- ✅ Readable dotted paths (`work[0].startDate`) instead of JSON pointers
- ✅ Validates email and URL formats, and ISO8601 dates (YYYY-MM-DD, YYYY-MM, YYYY)
- ✅ A ready-to-print `summary` string listing every problem
- ✅ Multiple entry points (object, string, file) plus a strict variant that throws
- ✅ CLI tool for validating a file

## Why This Validator is Useful

**The official JSON Resume schema is intentionally very permissive:**
- ❌ No required fields (not even `basics.name`!)
- ✅ Allows additional properties everywhere
- ✅ All fields are optional

**This validator adds practical checks that catch real issues:**
- ✅ Missing name
- ✅ Missing contact information (email or phone)
- ✅ Invalid email formats
- ✅ Invalid URL formats (including `basics.profiles[].url`)
- ✅ Invalid date formats in `work`, `education` and `projects`
- ✅ Empty resume (no work, education, or projects)
- ✅ Type mismatches (string instead of array, etc.)
- ✅ Work entries missing both company and position, education missing both institution and area, projects missing a name

## Important: warnings also fail validation

`valid` is `true` only when there are **zero** issues — schema errors *and* practical warnings. A resume missing a phone number is reported as `valid: false` with a warning, which is why `generateHTML` and the `/api/generate-pdf` endpoint reject it. The severity is preserved on each issue so callers can present errors and warnings differently.

Practical warnings whose path duplicates a schema error are dropped, so each problem is reported once.

## Installation

Workspace package — depend on it by name inside this monorepo:

```jsonc
// package.json
"dependencies": { "validator": "workspace:*" }
```

## Usage

### Validate an Object

```typescript
import { validateResume } from "validator";

const result = validateResume(resume);

if (result.valid) {
  console.log("✅ Valid resume!");
} else {
  console.log(result.summary);          // ready-to-print multi-line explanation
  result.issues?.forEach(issue => {
    console.log(`${issue.severity}: ${issue.path} ${issue.message}`);
  });
}
```

### Validate a File

```typescript
import { validateResumeFile } from "validator";

const result = await validateResumeFile("resume.json");
if (!result.valid) console.log(result.summary);
```

### Validate JSON String

```typescript
import { validateResumeString } from "validator";

const result = validateResumeString('{"basics": {"name": "John Doe"}}');
```

Malformed JSON is reported as a single error that names the line and column of the syntax problem.

### Strict Validation (Throws on Error)

```typescript
import { validateResumeStrict } from "validator";

try {
  const validatedResume = validateResumeStrict(resume);
  console.log(validatedResume.basics?.name);
} catch (error) {
  console.error(error.message);   // "Invalid JSON Resume:\n<summary>"
}
```

### CLI

```bash
bun cli.ts ../../resumes/example_input.json
# or, from the repo root:
bun run validator:validate ../../resumes/example_input.json
```

Exits `0` when valid, `1` otherwise, printing schema errors and practical warnings in separate blocks.

## Result shape

```typescript
interface ValidationIssue {
  path: string;                     // "work[0].startDate", "" = whole document
  message: string;                  // human-readable explanation
  severity: "error" | "warning";
  keyword?: string;                 // AJV keyword, e.g. "required", "format"
  params?: Record<string, unknown>;
}

interface ValidationResult {
  valid: boolean;
  errors?: ValidationIssue[];       // schema violations
  warnings?: string[];              // practical problems, pre-formatted strings
  issues?: ValidationIssue[];       // everything, errors first
  summary?: string;                 // formatIssues(issues)
}
```

`formatIssue(issue)` and `formatIssues(issues)` are exported if you want to render them yourself.

## Testing

```bash
bun run example.ts
```

The example suite covers:
- ✅ Valid resume validation with all best practices
- ✅ Email format validation (dots, plus signs, TLD optional)
- ✅ ISO8601 date format validation (YYYY, YYYY-MM, YYYY-MM-DD)
- ✅ File validation with the test JSON files
- ✅ Strict validation (throws on error)
- ✅ A real-world example resume

### Test Files

- **test-valid.json**: Comprehensive valid resume with all sections (Jane Smith)
- **test-invalid.json**: Resume with multiple validation errors for testing

### Email Validation

The validator uses a permissive email regex that:
- ✅ Allows dots in username: `john.doe@company.com`
- ✅ Allows plus signs: `user+tag@domain.com`
- ✅ Combines both: `john.doe+work@company.com`
- ✅ Optional TLD: `user@domain` or `user@domain.com`
- ❌ Rejects consecutive dots: `user..name@domain.com`
- ❌ Rejects leading/trailing dots or plus signs

Regex: `/^[a-zA-Z0-9]+([.+][a-zA-Z0-9]+)*@[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/`

## Schema

Uses the official JSON Resume schema from the `@jsonresume/schema` package. That package exports `{ validate, schema, jobSchema }`, so `src/index.ts` reaches for `.schema` explicitly — compiling the module object instead silently produces a validator that accepts everything.
