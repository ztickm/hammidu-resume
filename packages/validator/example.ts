import { validateResume, validateResumeFile, validateResumeStrict } from "./src/index";

// Example 1: Validate an object
const validResume = {
  basics: {
    name: "John Doe",
    label: "Software Engineer",
    email: "john@example.com",
  },
};

console.log("=== Validating Resume Object ===");
const result1 = validateResume(validResume);
console.log("Valid:", result1.valid);
if (!result1.valid) {
  console.log("Errors:");
  result1.errors?.forEach(err => {
    console.log(`  ${err.path}: ${err.message}`);
  });
}

// Example 2: Validate with ACTUALLY invalid data
// Note: JSON Resume schema is very permissive:
// - Allows additional properties
// - Doesn't require most fields (even basics.name!)
// - Only validates types and formats when fields are present
//
// What it DOES validate:
// - Type correctness when field exists (string vs number)
// - Format validation for email, URL, ISO8601 dates when present
// - Array vs object types
console.log("\n=== Validating Invalid Resume (Type Errors) ===");
const invalidResume = {
  basics: {
    name: 123, // ERROR: Should be string
    email: "john@example.com", // Valid email
  },
  work: "should be array", // ERROR: Should be array
  education: [
    {
      startDate: "2020-13-45", // ERROR: Invalid ISO8601 date
    },
  ],
};

const result2 = validateResume(invalidResume);
console.log("Valid:", result2.valid);
if (!result2.valid) {
  console.log("Errors:");
  result2.errors?.forEach(err => {
    console.log(`  ${err.path}: ${err.message}`);
  });
} else {
  console.log("⚠️  Note: JSON Resume schema is permissive - missing required fields are allowed");
}

// Example 3: Invalid date format
console.log("\n=== Validating Invalid Date Format ===");
const invalidDateResume = {
  basics: {
    name: "Jane Doe",
  },
  work: [
    {
      name: "Tech Corp",
      position: "Engineer",
      startDate: "2020-13-01", // Invalid month (13)
    },
  ],
};

const result3 = validateResume(invalidDateResume);
console.log("Valid:", result3.valid);
if (!result3.valid) {
  console.log("Errors:");
  result3.errors?.forEach(err => {
    console.log(`  ${err.path}: ${err.message}`);
  });
}

// Example 4: Validate a file
console.log("\n=== Validating File ===");
const result4 = await validateResumeFile("../../resumes/example_input.json");
console.log("Valid:", result4.valid);
if (!result4.valid) {
  console.log("Errors:");
  result4.errors?.forEach(err => {
    console.log(`  ${err.path}: ${err.message}`);
  });
} else {
  console.log("✅ File is valid!");
}

// Example 5: Strict validation (throws on error)
console.log("\n=== Strict Validation ===");
try {
  const validated = validateResumeStrict(invalidResume);
  console.log("✅ Validated successfully:", validated.basics?.name);
} catch (error) {
  console.error("❌ Validation failed:", (error as Error).message);
}
