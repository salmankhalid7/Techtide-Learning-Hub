/**
 * Centralized validation rules used across the application.
 *
 * Keeping validation limits in one place ensures consistency,
 * simplifies maintenance, and prevents duplicated values.
 */
export const VALIDATION = {
  NAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
  },

  EMAIL: {
    MAX_LENGTH: 254,
  },

  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
  },

  TITLE: {
    MIN_LENGTH: 5,
    MAX_LENGTH: 150,
  },

  DESCRIPTION: {
    MAX_LENGTH: 5000,
  },

  BIO: {
    MAX_LENGTH: 500,
  },

  PHONE: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 15,
  },

  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },

  FILE: {
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5 MB
    MAX_DOCUMENT_SIZE: 20 * 1024 * 1024, // 20 MB
  },
};