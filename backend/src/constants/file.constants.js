/**
 * Centralized file upload configuration.
 *
 * Keeping upload limits and allowed MIME types in one place
 * ensures consistency across the application.
 */

export const FILE = {
  // Maximum file sizes (bytes)
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5 MB
  MAX_DOCUMENT_SIZE: 20 * 1024 * 1024, // 20 MB

  // Allowed image MIME types
  IMAGE_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp",
  ],

  // Allowed document MIME types
  DOCUMENT_TYPES: [
    "application/pdf",
  ],
};