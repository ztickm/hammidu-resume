# Validator

JSON Resume schema validator with **practical validation rules** using AJV.

## Features

- ✅ Validates JSON Resume files against the official schema
- ✅ **Enhanced practical validation** beyond the permissive official schema
- ✅ Checks for essential fields (name, contact info, content sections)
- ✅ Validates email and URL formats
- ✅ Validates ISO8601 date formats (YYYY-MM-DD, YYYY-MM, YYYY)
- ✅ Type checking for arrays and objects
- ✅ Detailed error messages with paths
- ✅ Multiple validation functions (object, string, file)
- ✅ CLI tool for easy validation
- ✅ Type-safe with TypeScript

## Why This Validator is Useful

**The official JSON Resume schema is intentionally very permissive:**
- ❌ No required fields (not even `basics.name`!)
- ✅ Allows additional properties everywhere
- ✅ All fields are optional

**This validator adds practical checks that catch real issues:**
- ✅ Missing name
- ✅ Missing contact information (email or phone)
- ✅ Invalid email formats
- ✅ Invalid URL formats  
- ✅ Invalid date formats (checks ISO8601: YYYY-MM-DD, YYYY-MM, YYYY)
- ✅ Empty resume (no work, education, or projects)
- ✅ Type mismatches (string instead of array, etc.)
- ✅ Missing required fields in sections (company name, institution, etc.)

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

## Testing

### Run Comprehensive Test Suite

```bash
bun run example.ts
```

The test suite includes:
- ✅ Valid resume validation with all best practices
- ✅ Email format validation (dots, plus signs, TLD optional)
- ✅ ISO8601 date format validation (YYYY, YYYY-MM, YYYY-MM-DD)
- ✅ File validation with test JSON files
- ✅ Strict validation (throws on error)
- ✅ Real-world example (Raïs Hamidou resume)

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

Uses the official JSON Resume schema from `@jsonresume/schema` package, which validates:
- Required fields (basics.name)
- Field formats (email, URL, dates)
- Data types and structures
- ISO8601 date patterns
