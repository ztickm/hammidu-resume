import type { ISO8601 } from "./json-resume";

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
 * Format a date or show "Present" if undefined/empty
 */
export function formatDateOrPresent(dateString: ISO8601 | undefined): string {
  if (!dateString) return "Present";
  return formatDate(dateString);
}

/**
 * Join an array of strings with a separator
 */
export function joinArray(array: string[] | undefined, separator: string): string {
  if (!array || array.length === 0) return "";
  return array.join(separator);
}
