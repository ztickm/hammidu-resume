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

// Example 2: Validate with invalid data
console.log("\n=== Validating Invalid Resume ===");
const invalidResume = {
  basics: {
    // Missing required name field
    email: 23,// Invalid email format
    inexistentField: "This should not be here",
  },
};

const result2 = validateResume(invalidResume);
console.log("Valid:", result2.valid);
if (!result2.valid) {
  console.log("Errors:");
  result2.errors?.forEach(err => {
    console.log(`  ${err.path}: ${err.message}`);
  });
}

// Example 3: Validate a file
console.log("\n=== Validating File ===");
const result3 = await validateResumeFile("../../resumes/example_input.json");
console.log("Valid:", result3.valid);
if (!result3.valid) {
  console.log("Errors:");
  result3.errors?.forEach(err => {
    console.log(`  ${err.path}: ${err.message}`);
  });
} else {
  console.log("✅ File is valid!");
}

// Example 4: Strict validation (throws on error)
console.log("\n=== Strict Validation ===");
try {
  const validated = validateResumeStrict(validResume);
  console.log("✅ Validated successfully:", validated.basics.name);
} catch (error) {
  console.error("❌ Validation failed:", (error as Error).message);
}
