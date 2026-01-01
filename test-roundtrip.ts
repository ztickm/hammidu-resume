#!/usr/bin/env bun
/**
 * Round-trip test: JSON → HTML → PDF → JSON
 * 
 * This demonstrates the complete workflow:
 * 1. Start with JSON Resume data
 * 2. Generate HTML (xebec-render)
 * 3. Generate PDF with embedded metadata (flouka-studio)
 * 4. Extract JSON back from PDF (extractor)
 * 5. Verify extracted data matches original
 */

import { generateHTML } from "./packages/xebec-render/src/index";
import { generatePDF } from "./packages/flouka-studio/src/index";
import { extractResumeFromPDF } from "./packages/extractor/src/index";
import { validateResumeStrict } from "./packages/validator/src/index";
import type { ResumeSchema } from "@jsonresume/schema";

const originalResume: ResumeSchema = {
  basics: {
    name: "Ada Lovelace",
    label: "Mathematician & Computer Pioneer",
    email: "ada.lovelace@example.com",
    phone: "+44 20 1234 5678",
    url: "https://adalovelace.example.com",
    summary: "Visionary mathematician who created the first computer algorithm.",
    location: {
      city: "London",
      countryCode: "GB",
      region: "England"
    },
    profiles: [
      {
        network: "GitHub",
        username: "adalovelace",
        url: "https://github.com/adalovelace"
      }
    ]
  },
  work: [
    {
      name: "Charles Babbage's Analytical Engine Project",
      position: "Mathematical Contributor",
      startDate: "1842-01-01",
      endDate: "1843-12-31",
      summary: "Translated and extensively annotated Luigi Menabrea's memoir on the Analytical Engine",
      highlights: [
        "Created the first algorithm intended for machine processing",
        "Recognized the machine's potential beyond pure calculation",
        "Introduced concepts of looping and subroutines"
      ]
    }
  ],
  education: [
    {
      institution: "Private Tutors",
      area: "Mathematics",
      studyType: "Advanced Studies",
      startDate: "1828-01-01",
      endDate: "1835-12-31"
    }
  ],
  skills: [
    {
      name: "Mathematics",
      keywords: ["Calculus", "Algebra", "Logic"]
    },
    {
      name: "Computer Science",
      keywords: ["Algorithms", "Programming Concepts", "Machine Architecture"]
    }
  ]
};

async function roundTripTest() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║         JSON Resume Round-Trip Test                       ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  // Step 1: Validate original
  console.log("📋 Step 1: Validating original JSON Resume...");
  try {
    validateResumeStrict(originalResume);
    console.log("✅ Original resume is valid\n");
  } catch (error) {
    console.error("❌ Original resume is invalid!");
    console.error((error as Error).message);
    return;
  }

  // Step 2: Generate HTML
  console.log("🎨 Step 2: Generating HTML...");
  const html = generateHTML(originalResume);
  console.log(`✅ Generated ${html.length} bytes of HTML\n`);

  // Step 3: Generate PDF (which includes embedded metadata)
  console.log("📄 Step 3: Generating PDF with embedded metadata...");
  const pdfBytes = await generatePDF(originalResume);
  console.log(`✅ Generated PDF: ${pdfBytes.length} bytes\n`);

  // Step 4: Extract JSON from PDF
  console.log("🔍 Step 4: Extracting JSON from PDF...");
  const extractionResult = await extractResumeFromPDF(pdfBytes);
  
  if (!extractionResult.success) {
    console.error("❌ Extraction failed:", extractionResult.error);
    return;
  }
  
  const extractedResume = extractionResult.resume!;
  console.log("✅ Successfully extracted resume from PDF\n");

  // Step 5: Verify extracted data
  console.log("🔎 Step 5: Verifying extracted data...");
  
  const checks = [
    {
      name: "Name",
      original: originalResume.basics.name,
      extracted: extractedResume.basics.name
    },
    {
      name: "Email",
      original: originalResume.basics.email,
      extracted: extractedResume.basics.email
    },
    {
      name: "Work entries",
      original: originalResume.work?.length,
      extracted: extractedResume.work?.length
    },
    {
      name: "Education entries",
      original: originalResume.education?.length,
      extracted: extractedResume.education?.length
    },
    {
      name: "Skills",
      original: originalResume.skills?.length,
      extracted: extractedResume.skills?.length
    }
  ];

  let allMatch = true;
  for (const check of checks) {
    const matches = JSON.stringify(check.original) === JSON.stringify(check.extracted);
    const icon = matches ? "✅" : "❌";
    console.log(`${icon} ${check.name}: ${matches ? "MATCH" : "MISMATCH"}`);
    
    if (!matches) {
      console.log(`   Original: ${JSON.stringify(check.original)}`);
      console.log(`   Extracted: ${JSON.stringify(check.extracted)}`);
      allMatch = false;
    }
  }

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  if (allMatch) {
    console.log("║             ✅ ROUND-TRIP TEST PASSED! ✅                 ║");
  } else {
    console.log("║             ❌ ROUND-TRIP TEST FAILED! ❌                 ║");
  }
  console.log("╚═══════════════════════════════════════════════════════════╝");
}

roundTripTest().catch(console.error);
