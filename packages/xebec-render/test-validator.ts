/**
 * Test xebec with validator integration
 */
import { generateHTML, validateResume } from "./src/index";

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║          Xebec with Validator Integration Test              ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

// Test 1: Valid resume
console.log("Test 1: Valid Resume");
console.log("=".repeat(60));
const validResume = {
  basics: {
    name: "John Doe",
    label: "Software Engineer",
    email: "john.doe@example.com",
    phone: "+1-555-0123",
  },
  work: [
    {
      name: "Tech Corp",
      position: "Engineer",
      startDate: "2020-01",
      endDate: "2023-12",
    },
  ],
};

try {
  const html = generateHTML(validResume);
  console.log("✅ Successfully generated HTML for valid resume");
  console.log(`   HTML length: ${html.length} characters\n`);
} catch (error) {
  console.error("❌ Error:", (error as Error).message);
}

// Test 2: Invalid resume - empty name
console.log("Test 2: Invalid Resume (Empty Name)");
console.log("=".repeat(60));
const invalidResume1 = {
  basics: {
    name: "",
    email: "test@example.com",
  },
};

try {
  const html = generateHTML(invalidResume1);
  console.error("❌ Should have thrown validation error");
} catch (error) {
  console.log("✅ Correctly rejected invalid resume");
  console.log(`   Error: ${(error as Error).message.split('\n')[0]}\n`);
}

// Test 3: Invalid resume - bad email
console.log("Test 3: Invalid Resume (Bad Email Format)");
console.log("=".repeat(60));
const invalidResume2 = {
  basics: {
    name: "Test User",
    email: "invalid..email@test.com",
  },
};

try {
  const html = generateHTML(invalidResume2);
  console.error("❌ Should have thrown validation error");
} catch (error) {
  console.log("✅ Correctly rejected invalid resume");
  console.log(`   Error: ${(error as Error).message.split('\n')[0]}\n`);
}

// Test 4: Invalid resume - bad date
console.log("Test 4: Invalid Resume (Invalid Date Format)");
console.log("=".repeat(60));
const invalidResume3 = {
  basics: {
    name: "Test User",
    email: "test@example.com",
  },
  work: [
    {
      name: "Company",
      startDate: "2023-13-45", // Invalid date
    },
  ],
};

try {
  const html = generateHTML(invalidResume3);
  console.error("❌ Should have thrown validation error");
} catch (error) {
  console.log("✅ Correctly rejected invalid resume");
  console.log(`   Error: ${(error as Error).message.split('\n')[0]}\n`);
}

// Test 5: Using validateResume directly
console.log("Test 5: Using validateResume Directly");
console.log("=".repeat(60));
const result = validateResume(invalidResume1);
console.log(`Valid: ${result.valid}`);
if (result.warnings) {
  console.log("Warnings:");
  result.warnings.forEach(w => console.log(`  • ${w}`));
}

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║                    All Tests Completed!                      ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
