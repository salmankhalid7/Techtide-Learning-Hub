import multer from "multer";
import ApiError from "../utils/ApiError.js";

/**
 * Creates a configured Multer upload middleware.
 *
 * @param {string[]} allowedMimeTypes - Allowed MIME types.
 * @param {number} maxFileSize - Maximum file size in bytes.
 * @returns {import("multer").Multer}
 */
const createUploader = (
  allowedMimeTypes,
  maxFileSize
) => {
  return multer({
    storage: multer.memoryStorage(),

    limits: {
      fileSize: maxFileSize,
    },

    fileFilter(req, file, cb) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(
          new ApiError(
            400,
            "Unsupported file type."
          )
        );
      }

      cb(null, true);
    },
  });
};

const upload = {
  /**
   * Image uploader.
   */
  image() {
    return createUploader(
      [
        "image/jpeg",
        "image/png",
        "image/webp",
      ],
      2 * 1024 * 1024
    );
  },

  /**
   * PDF uploader.
   */
  pdf() {
    return createUploader(
      [
        "application/pdf",
      ],
      20 * 1024 * 1024
    );
  },

  /**
   * Video uploader.
   */
  video() {
    return createUploader(
      [
        "video/mp4",
        "video/webm",
        "video/quicktime",
      ],
      500 * 1024 * 1024
    );
  },

  /**
   * Generic document uploader.
   */
  document() {
    return createUploader(
      [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      25 * 1024 * 1024
    );
  },
};

export default upload;