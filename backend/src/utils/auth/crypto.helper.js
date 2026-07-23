import crypto from "crypto";

/**
 * Generates a secure random token.
 *
 * @param {number} size - Token size in bytes.
 * @returns {string}
 */
export const generateSecureToken = (size = 32) => {
  return crypto.randomBytes(size).toString("hex");
};

/**
 * Creates a SHA-256 hash of a token.
 *
 * @param {string} token
 * @returns {string}
 */
export const hashToken = (token) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};