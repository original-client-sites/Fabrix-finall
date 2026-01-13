import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility function to format date in Indian Standard Time (IST)
export function formatInIST(date: Date, formatString: string): string {
  // Convert to IST (GMT+5:30)
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const istTime = new Date(utc + (5.5 * 3600000));
  
  // Parse format string and replace with IST values
  let formatted = formatString;
  
  // Replace common format tokens with IST equivalents
  formatted = formatted.replace(/yyyy/g, istTime.getFullYear().toString());
  formatted = formatted.replace(/yy/g, istTime.getFullYear().toString().slice(-2));
  
  const month = String(istTime.getMonth() + 1).padStart(2, '0');
  formatted = formatted.replace(/MM/g, month);
  
  const day = String(istTime.getDate()).padStart(2, '0');
  formatted = formatted.replace(/dd/g, day);
  
  const hours = String(istTime.getHours()).padStart(2, '0');
  formatted = formatted.replace(/HH/g, hours);
  
  const minutes = String(istTime.getMinutes()).padStart(2, '0');
  formatted = formatted.replace(/mm/g, minutes);
  
  const seconds = String(istTime.getSeconds()).padStart(2, '0');
  formatted = formatted.replace(/ss/g, seconds);
  
  // Month name abbreviations
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  formatted = formatted.replace(/MMM/g, monthNames[istTime.getMonth()]);
  
  return formatted;
}

// --- NEW: safe parse for MySQL/ISO date strings to local Date ---
// Handles:
// - "YYYY-MM-DD HH:mm:ss" (MySQL style) -> treated as local by replacing the space with 'T'
// - ISO strings (with 'T' and optional 'Z') -> pass through
export function parseOrderDate(input: string | Date | null | undefined): Date {
  if (!input) return new Date();
  if (input instanceof Date) return input;

  const s = String(input).trim();
  if (!s) return new Date();

  // MySQL timestamp "YYYY-MM-DD HH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(s)) {
    // Replace space with 'T' so it's parsed as local time
    return new Date(s.replace(' ', 'T'));
  }

  // ISO formats stay as-is
  return new Date(s);
}

// --- NEW: convenience to format any input in IST ---
export function formatISTFromInput(input: string | Date | null | undefined, pattern: string): string {
  return formatInIST(parseOrderDate(input), pattern);
}
