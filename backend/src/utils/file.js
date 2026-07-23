/**
 * File Utils
 * Common file system operations: delete, check, create directories, and filename helpers.
 */

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

/**
 * Deletes a file if it exists.
 *
 * This is primarily used to remove temporary files after
 * they have been uploaded to Cloudinary.
 *
 * @param {string} filePath - Absolute or relative file path.
 */
export const deleteFile = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
  } catch {
    // Ignore missing files to keep cleanup operations safe.
  }
};

/**
 * Checks whether a file exists.
 *
 * @param {string} filePath - File path to check.
 * @returns {Promise<boolean>}
 */
export const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Ensures a directory exists.
 * Creates it recursively if necessary.
 *
 * @param {string} directoryPath - Directory path.
 */
export const ensureDirectoryExists = async (directoryPath) => {
  await fs.mkdir(directoryPath, {
    recursive: true,
  });
};

/**
 * Returns a file's extension.
 *
 * @param {string} fileName
 * @returns {string}
 */
export const getFileExtension = (fileName) => {
  return path.extname(fileName).toLowerCase();
};

/**
 * Returns a filename without its extension.
 *
 * @param {string} fileName
 * @returns {string}
 */
export const getFileName = (fileName) => {
  return path.parse(fileName).name;
};

/**
 * Generates a unique filename while preserving the extension.
 *
 * @param {string} originalName
 * @returns {string}
 */
export const generateFileName = (originalName) => {
  const extension = path.extname(originalName);

  return `${Date.now()}-${crypto.randomUUID()}${extension}`;
};