import {
  generateSecureToken,
  hashToken,
} from "./crypto.helper.js";

/**
 * Generates a raw token and its hashed version.
 *
 * The raw token is sent to the user.
 * The hashed token is stored in the database.
 */
export const generateEmailToken = () => {
  const token = generateSecureToken();
  const hashedToken = hashToken(token);

  return {
    token,
    hashedToken,
  };
};