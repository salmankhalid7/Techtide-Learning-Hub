import cloudinary from "../../config/cloudinary.js";

/**
 * Deletes an image from Cloudinary by its public ID.
 *
 * @param {string} publicId - Cloudinary public_id of the image to delete.
 * @returns {Promise<object|undefined>} Deletion result, or undefined if no ID provided.
 */
const deleteImage = async (publicId) => {
  if (!publicId) return;

  return cloudinary.uploader.destroy(publicId);
};

export default deleteImage;