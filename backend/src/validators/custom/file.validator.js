/**
 * Checks whether the uploaded file size
 * is within the allowed limit.
 *
 * @param {number} size
 * @param {number} maxSize
 */
export const isValidFileSize = (
  size,
  maxSize
) => {
  return size <= maxSize;
};

/**
 * Checks whether a MIME type
 * is allowed.
 *
 * @param {string} mimeType
 * @param {string[]} allowedTypes
 */
export const isAllowedFileType = (
  mimeType,
  allowedTypes
) => {
  return allowedTypes.includes(mimeType);
};