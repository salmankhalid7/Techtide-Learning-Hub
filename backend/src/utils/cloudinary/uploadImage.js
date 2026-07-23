import { Readable } from "stream";
import cloudinary from "../../config/cloudinary.js";

/**
 * Uploads an image buffer to Cloudinary.
 *
 * @param {Buffer} fileBuffer - Raw image data to upload.
 * @param {string} [folder="learnx-ai"] - Cloudinary folder to store the image in.
 * @returns {Promise<object>} Cloudinary upload result (contains url, public_id, etc.).
 */
const uploadImage = (fileBuffer, folder = "learnx-ai") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    // Pipe the buffer into the upload stream
    Readable.from(fileBuffer).pipe(stream);
  });
};

export default uploadImage;