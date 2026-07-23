import multer from "multer";

import { FILE } from "../constants/file.constants.js";
import { BadRequestError } from "../errors/index.js";

/**
 * Store files in memory before uploading them
 * to Cloudinary.
 */
const storage = multer.memoryStorage();

/**
 * Restrict uploads to approved image formats.
 */
const imageFileFilter = (req, file, cb) => {
  if (!FILE.IMAGE_TYPES.includes(file.mimetype)) {
    return cb(
      new BadRequestError(
        "Only JPEG, PNG and WEBP images are allowed."
      ),
      false
    );
  }

  cb(null, true);
};

/**
 * Multer instance for image uploads.
 * Naming follows the `typeUpload` convention so it scales cleanly
 * when documentUpload / videoUpload are introduced later.
 */
export const imageUpload = multer({
  storage,

  limits: {
    fileSize: FILE.MAX_IMAGE_SIZE,
  },

  fileFilter: imageFileFilter,
});