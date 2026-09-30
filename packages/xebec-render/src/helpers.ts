import type { ISO8601, Profile } from "json-resume-types";

/**
 * Format an ISO8601 date string to a human-readable format
 * Examples:
 *   "2019-01-15" -> "January 2019"
 *   "2019-01" -> "January 2019"
 *   "2019" -> "2019"
 */
export function formatDate(dateString: ISO8601 | undefined): string {
  if (!dateString) return "";
  
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  // Handle different ISO8601 formats
  const parts = dateString.split("-");
  
  if (parts.length === 1) {
    // Year only: "2019"
    return parts[0] ?? dateString;
  } else if (parts.length === 2) {
    // Year-Month: "2019-01"
    const year = parts[0] ?? "";
    const month = parts[1] ?? "";
    const monthIndex = parseInt(month, 10) - 1;
    return `${months[monthIndex]} ${year}`;
  } else if (parts.length === 3) {
    // Year-Month-Day: "2019-01-15" - just show month and year
    const year = parts[0] ?? "";
    const month = parts[1] ?? "";
    const monthIndex = parseInt(month, 10) - 1;
    return `${months[monthIndex]} ${year}`;
  }
  
  return dateString;
}

/**
 * Format a date or show a localised "present" label if undefined/empty
 */
export function formatDateOrPresent(dateString: ISO8601 | undefined, presentLabel?: string): string {
  if (!dateString) return presentLabel ?? "Present";
  return formatDate(dateString);
}

/**
 * Join an array of strings with a separator
 */
export function joinArray(array: string[] | undefined, separator: string): string {
  if (!array || array.length === 0) return "";
  return array.join(separator);
}

/**
 * Find a profile by network name, case-insensitively — the header pulls out
 * GitHub and LinkedIn by name and Handlebars has no way to filter an array.
 */
export function findProfile(
  profiles: Profile[] | undefined,
  network: string
): Profile | undefined {
  if (!profiles || !Array.isArray(profiles)) return undefined;
  const wanted = network.toLowerCase();
  return profiles.find((p) => p?.network?.toLowerCase() === wanted);
}

/**
 * Strip a URL down to what belongs on a printed page — no scheme, no "www.",
 * no trailing slash: "https://www.linkedin.com/in/jane/" -> "linkedin.com/in/jane"
 */
export function displayUrl(url: string | undefined): string {
  if (!url) return "";
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}
