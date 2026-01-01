import { validateResume, validateResumeFile, validateResumeStrict } from "./src/index";

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║          JSON Resume Validator - Comprehensive Tests        ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

// Helper function to display results
function displayResult(title: string, result: any) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(60));
  
  if (result.valid) {
    console.log("✅ Valid JSON Resume!");
  } else {
    console.log("❌ Invalid JSON Resume\n");
    
    if (result.errors && result.errors.length > 0) {
      console.log("Schema Errors:");
      result.errors.forEach((err: any) => {
        console.log(`  • ${err.path || "/"}: ${err.message}`);
      });
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log("\nWarnings:");
      result.warnings.forEach((warning: string) => {
        console.log(`  ⚠️  ${warning}`);
      });
    }
  }
}

// =============================================================================
// Test 1: Valid Resume with All Best Practices
// =============================================================================
const validResume = {
  basics: {
    name: "John Doe",
    label: "Software Engineer",
    email: "john.doe@example.com",
    phone: "+1-555-0123",
    url: "https://johndoe.dev",
    summary: "Experienced software engineer specializing in web technologies",
    location: {
      city: "San Francisco",
      countryCode: "US",
    },
    profiles: [
      {
        network: "GitHub",
        username: "johndoe",
        url: "https://github.com/johndoe",
      },
    ],
  },
  work: [
    {
      name: "Tech Corp",
      position: "Senior Engineer",
      startDate: "2020-01",
      endDate: "2023-12",
      summary: "Led development of core products",
    },
  ],
  education: [
    {
      institution: "University of Technology",
      area: "Computer Science",
      studyType: "Bachelor",
      startDate: "2016",
      endDate: "2020",
    },
  ],
  skills: [
    {
      name: "JavaScript",
      level: "Expert",
      keywords: ["TypeScript", "React", "Node.js"],
    },
  ],
};

displayResult("Test 1: Valid Resume (All Best Practices)", validateResume(validResume));

// =============================================================================
// Test 2: Email Format Validation
// =============================================================================
console.log("\n\n" + "=".repeat(60));
console.log("  Test 2: Email Format Validation");
console.log("=".repeat(60));

const emailTests = [
  { email: "john.doe@company.com", desc: "Standard with dot" },
  { email: "user+tag@domain.com", desc: "With plus sign" },
  { email: "john.doe+work@company.co.uk", desc: "Dot and plus" },
  { email: "simple@localhost", desc: "No TLD" },
  { email: "test123@domain456", desc: "Alphanumeric" },
  { email: "invalid..email@test.com", desc: "Consecutive dots (INVALID)" },
  { email: ".user@domain.com", desc: "Leading dot (INVALID)" },
  { email: "user.@domain.com", desc: "Trailing dot (INVALID)" },
  { email: "not-an-email", desc: "No @ symbol (INVALID)" },
];

emailTests.forEach(({ email, desc }) => {
  const testResume = {
    basics: { name: "Test User", email },
  };
  const result = validateResume(testResume);
  const status = result.valid ? "✅" : "❌";
  console.log(`${status} ${desc}: "${email}"`);
  if (!result.valid && result.warnings) {
    result.warnings.forEach(w => console.log(`     ${w}`));
  }
});

// =============================================================================
// Test 3: Date Format Validation
// =============================================================================
console.log("\n\n" + "=".repeat(60));
console.log("  Test 3: ISO8601 Date Format Validation");
console.log("=".repeat(60));

const dateTests = [
  { date: "2023", desc: "Year only (VALID)" },
  { date: "2023-06", desc: "Year-Month (VALID)" },
  { date: "2023-06-15", desc: "Full date (VALID)" },
  { date: "2023-13-01", desc: "Invalid month 13 (INVALID)" },
  { date: "2023-06-32", desc: "Invalid day 32 (INVALID)" },
  { date: "2023/06/15", desc: "Wrong separator (INVALID)" },
  { date: "June 2023", desc: "Text format (INVALID)" },
];

dateTests.forEach(({ date, desc }) => {
  const testResume = {
    basics: { name: "Test User" },
    work: [{ name: "Company", startDate: date }],
  };
  const result = validateResume(testResume);
  const status = result.valid ? "✅" : "❌";
  console.log(`${status} ${desc}: "${date}"`);
  if (!result.valid && result.warnings) {
    result.warnings.forEach(w => console.log(`     ${w}`));
  }
});

// =============================================================================
// Test 4: Test JSON Files
// =============================================================================
console.log("\n\n" + "=".repeat(60));
console.log("  Test 4: Validating Test JSON Files");
console.log("=".repeat(60));

const testFiles = [
  "test-valid.json",
  "test-invalid.json",
];

for (const file of testFiles) {
  try {
    const result = await validateResumeFile(file);
    displayResult(`File: ${file}`, result);
  } catch (error) {
    console.log(`\n❌ Error reading ${file}: ${(error as Error).message}`);
  }
}

// =============================================================================
// Test 5: Strict Validation (Throws on Error)
// =============================================================================
displayResult(
  "Test 5: Strict Validation - Valid Resume",
  { valid: true }
);

try {
  const validated = validateResumeStrict(validResume);
  console.log("✅ Strict validation passed");
  console.log(`   Name: ${validated.basics?.name}`);
} catch (error) {
  console.error("❌ Unexpected error:", (error as Error).message);
}

console.log("\n" + "=".repeat(60));
displayResult(
  "Test 6: Strict Validation - Invalid Resume",
  { valid: false }
);

const invalidResume = {
  basics: {
    name: "", // Empty name
    email: "invalid-email", // Invalid format
  },
};

try {
  validateResumeStrict(invalidResume);
  console.error("❌ Should have thrown an error");
} catch (error) {
  console.log("✅ Correctly threw validation error");
  console.log(`   ${(error as Error).message.split("\n")[0]}`);
}

// =============================================================================
// Test 7: Validate Main Example Resume
// =============================================================================
console.log("\n\n" + "=".repeat(60));
console.log("  Test 7: Validating Main Example Resume (Raïs Hamidou)");
console.log("=".repeat(60));

const mainResult = await validateResumeFile("../../resumes/example_input.json");
displayResult("Main Example: example_input.json", mainResult);

console.log("\n\n╔══════════════════════════════════════════════════════════════╗");
console.log("║                    All Tests Completed!                      ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");
