/**
 * Cloudinary Configuration Module
 *
 * This module initializes and exports the Cloudinary SDK (v2) instance
 * for cloud-based media (image/video) upload and transformation.
 *
 * Environment Variables (required):
 *   - CLOUDINARY_CLOUD_NAME – Your Cloudinary cloud name.
 *   - CLOUDINARY_API_KEY    – Your Cloudinary API key.
 *   - CLOUDINARY_API_SECRET – Your Cloudinary API secret.
 *
 * All uploads use HTTPS (secure: true) by default.
 */

import { v2 as cloudinary } from "cloudinary";

// ── Cloudinary SDK Configuration ──────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // Cloud name from env
  api_key: process.env.CLOUDINARY_API_KEY,       // API key from env
  api_secret: process.env.CLOUDINARY_API_SECRET, // API secret from env
  secure: true,                                   // Force HTTPS for all assets
});

export default cloudinary;