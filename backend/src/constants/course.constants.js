/**
 * Course difficulty levels.
 */
export const COURSE_LEVELS = Object.freeze({
  BEGINNER: "beginner",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
});

/**
 * Course publishing status.
 */
export const COURSE_STATUS = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
});

/**
 * Course visibility.
 */
export const COURSE_VISIBILITY = Object.freeze({
  PUBLIC: "public",
  PRIVATE: "private",
  UNLISTED: "unlisted",
});

/**
 * Supported currencies.
 * Expand as needed.
 */
export const COURSE_CURRENCIES = Object.freeze({
  USD: "USD",
  PKR: "PKR",
  EUR: "EUR",
  GBP: "GBP",
});

/**
 * Default course language.
 */
export const DEFAULT_COURSE_LANGUAGE = "English";

/**
 * Allowed fields for sorting the public course listing (`sortBy`).
 *
 * Only fields that exist on the Course model (and are backed by an index where
 * possible) are permitted. This allowlist prevents clients from passing
 * arbitrary sort keys (e.g. `__proto__`, random fields) into `.sort()`, which
 * could trigger inefficient or unexpected queries / errors.
 */
export const COURSE_SORT_FIELDS = Object.freeze([
  "title",
  "createdAt",
  "updatedAt",
  "statistics.totalEnrollments",
  "statistics.averageRating",
]);