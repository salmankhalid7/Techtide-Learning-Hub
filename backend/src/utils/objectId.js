import mongoose from "mongoose";

import { BadRequestError } from "../errors/index.js";

/**
 * ObjectId Utils
 * Validate and convert MongoDB ObjectIds.
 */

export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Safely converts a string into a MongoDB ObjectId.
 *
 * @param {string} id - MongoDB ObjectId as a string.
 * @returns {mongoose.Types.ObjectId}
 * @throws {BadRequestError} If the provided id is invalid.
 */
export const toObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestError("Invalid MongoDB ObjectId.");
  }

  return new mongoose.Types.ObjectId(id);
};