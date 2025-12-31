# Validator

JSON Resume schema validator using AJV (Another JSON Schema Validator).

## Features

- ✅ Validates JSON Resume files against the official schema
- ✅ Detailed error messages with paths
- ✅ Multiple validation functions (object, string, file)
- ✅ Strict mode that throws on validation errors
- ✅ Format validation (email, URI, dates)
- ✅ Type-safe with TypeScript

## Installation

```bash
cd packages/validator
bun install
```

## Usage

### Validate an Object

```typescript
import { validateResume } from "validator";

const resume = {
  basics: {
    name: "John Doe",
    email: "john@example.com",
    // ...
  },
  // ...
};

const result = validateResume(resume);

if (result.valid) {
  console.log("✅ Valid resume!");
} else {
  console.log("❌ Invalid resume:");
  result.errors?.forEach(err => {
    console.log(`  ${err.path}: ${err.message}`);
  });
}
```

### Validate a File

```typescript
import { validateResumeFile } from "validator";

const result = await validateResumeFile("resume.json");

if (!result.valid) {
  console.log("Validation errors:");
  result.errors?.forEach(err => {
    console.log(`  ${err.path}: ${err.message}`);
  });
}
```

### Strict Validation (Throws on Error)

```typescript
import { validateResumeStrict } from "validator";

try {
  const validatedResume = validateResumeStrict(resume);
  // Resume is guaranteed to be valid here
  console.log(validatedResume.basics.name);
} catch (error) {
  console.error("Validation failed:", error.message);
}
```

### Validate JSON String

```typescript
import { validateResumeString } from "validator";

const jsonString = '{"basics": {"name": "John Doe"}}';
const result = validateResumeString(jsonString);
```

## Validation Errors

Errors include:
- `path`: JSON path to the invalid field (e.g., "/basics/email")
- `message`: Human-readable error message
- `keyword`: AJV error keyword (e.g., "required", "format")
- `params`: Additional error parameters

## Examples

```bash
bun run example.ts
```

## Schema

Uses the official JSON Resume schema from `@jsonresume/schema` package, which validates:
- Required fields (basics.name)
- Field formats (email, URL, dates)
- Data types and structures
- ISO8601 date patterns
