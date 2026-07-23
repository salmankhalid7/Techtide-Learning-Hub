/**
 * Validates URL-friendly slugs.
 *
 * Example:
 * javascript-course
 * react-for-beginners
 */
export const isSlug = (value) => {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
};