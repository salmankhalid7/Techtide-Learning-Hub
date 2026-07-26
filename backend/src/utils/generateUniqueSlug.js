/**
 * @file generateUniqueSlug.js
 * @description Reusable utility for generating unique slugs across models.
 *
 * Usage:
 *   import generateUniqueSlug from "../utils/generateUniqueSlug.js";
 *
 *   const slug = await generateUniqueSlug(Title, Lesson);
 *   const slug = await generateUniqueSlug(Title, Lesson, excludeId);
 *
 * Used by: Course, Module, Lesson, Quiz, Assignment, Category, etc.
 */

import slugify from "slugify";

/**
 * Generates a unique slug from a title for the given Mongoose model.
 *
 * If the base slug already exists in the collection, a numeric suffix
 * is appended (e.g. `my-title-1`, `my-title-2`) until a unique value
 * is found.
 *
 * @param   {string}       title       - The source string to slugify.
 * @param   {Model}        model       - The Mongoose model to check against.
 * @param   {string|null}  [excludeId] - Optional document _id to exclude (for updates).
 * @returns {Promise<string>}          A unique slug string.
 */
const generateUniqueSlug = async (title, model, excludeId = null) => {
    const baseSlug = slugify(title, {
        lower: true,
        strict: true,
        trim: true,
    });

    let candidate = baseSlug;
    let counter = 0;

    const filter = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };

    while (await model.exists(filter)) {
        counter += 1;
        candidate = `${baseSlug}-${counter}`;
        filter.slug = candidate;
    }

    return candidate;
};

export default generateUniqueSlug;
