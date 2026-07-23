/**
 * Password Utils
 * Hash and compare passwords using bcrypt.
 */

import bcrypt from "bcrypt";
import { config } from "../config/index.js";
const SALT_ROUNDS = config.security.bcryptSaltRounds;

// Hash a plain-text password
export const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

// Compare a plain-text password with a stored hash
export const comparePassword = async (
  password,
  hashedPassword
) => {
  return bcrypt.compare(password, hashedPassword);
};