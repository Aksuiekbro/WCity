/**
 * Date utilities for NASA GIBS layer dates
 * GIBS imagery typically has 1-2 day delay
 */

/**
 * Format date to YYYY-MM-DD format for GIBS
 */
export function formatDateForGIBS(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get date N days ago
 */
export function getDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Get yesterday's date (most GIBS products have 1-day delay)
 */
export function getYesterday() {
  return getDaysAgo(1);
}

/**
 * Get date 2 days ago (safer for products with longer delay)
 */
export function getTwoDaysAgo() {
  return getDaysAgo(2);
}

/**
 * Get the most recent available date for GIBS layers
 * Returns 2 days ago to ensure data availability
 */
export function getRecentGIBSDate() {
  return formatDateForGIBS(getTwoDaysAgo());
}

/**
 * Get date for 16-day products (e.g., NDVI)
 * These are composites, so we use a date that aligns with 16-day periods
 */
export function get16DayGIBSDate() {
  // Get a date that's a multiple of 16 days from Jan 1
  const now = getDaysAgo(3); // 3 days ago for safety
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));

  // Round down to nearest 16-day period
  const period = Math.floor(dayOfYear / 16) * 16;
  const periodDate = new Date(startOfYear);
  periodDate.setDate(periodDate.getDate() + period);

  return formatDateForGIBS(periodDate);
}

/**
 * Get date for monthly products
 */
export function getMonthlyGIBSDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1); // Last month
  date.setDate(1); // First day of last month
  return formatDateForGIBS(date);
}

/**
 * Get date for previous year (same day)
 */
export function getPreviousYearGIBSDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return formatDateForGIBS(date);
}

/**
 * Get appropriate date based on product type
 */
export function getGIBSDateByType(dateFormat) {
  switch (dateFormat) {
    case 'daily':
      return getRecentGIBSDate();
    case '16day':
      return get16DayGIBSDate();
    case 'monthly':
      return getMonthlyGIBSDate();
    case 'previousYear':
      return getPreviousYearGIBSDate();
    default:
      return getRecentGIBSDate();
  }
}

/**
 * Parse GIBS date string (YYYY-MM-DD) to Date object
 */
export function parseGIBSDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get date range for time series (last 30 days)
 */
export function getDateRange(days = 30) {
  const dates = [];
  for (let i = 2; i < days + 2; i++) {
    dates.push(formatDateForGIBS(getDaysAgo(i)));
  }
  return dates.reverse(); // Oldest to newest
}
