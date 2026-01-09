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
