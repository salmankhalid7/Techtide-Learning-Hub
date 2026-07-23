import Module from "../models/module.model.js";
import Course from "../models/course.model.js";
import { NotFoundError, ForbiddenError, BadRequestError } from "../errors/index.js";

// ── Helpers ────────────────────────────────────────────────

/**
 * Verify the authenticated user owns the course (or is an admin).
 * @returns {import("mongoose").Document} course document
 */
const assertCourseOwnership = async (courseId, user) => {
  const course = await Course.findById(courseId);

  if (!course) {
    throw new NotFoundError("Course not found.");
  }

  // Admins bypass ownership checks; instructors must own the course
  if (
    user.role !== "admin" &&
    course.instructor.toString() !== user._id.toString()
  ) {
    throw new ForbiddenError(
      "You are not authorized to modify modules in this course."
    );
  }

  return course;
};

/**
 * Verify the module exists and the user owns its parent course.
 * @returns {import("mongoose").Document} module document
 */
const assertModuleOwnership = async (moduleId, user) => {
  const module = await Module.findById(moduleId);

  if (!module) {
    throw new NotFoundError("Module not found.");
  }

  // For ownership checks, load the course (not needed for reads)
  if (user) {
    await assertCourseOwnership(module.course, user);
  }

  return module;
};

// ── Allowed Fields ─────────────────────────────────────────

const ALLOWED_UPDATE_FIELDS = [
  "title",
  "description",
  "order",
  "status",
  "isPreview",
  "isLocked",
  "estimatedDuration",
  "releaseAt",
];

// ── Service Methods ────────────────────────────────────────

/**
 * Create a new module inside a course
 */
export const createModule = async (moduleData, user) => {
  const { course, title, description, estimatedDuration, isPreview } =
    moduleData;

  // Verify course exists and user owns it
  await assertCourseOwnership(course, user);

  // Auto-assign order: place after the last existing module
  const lastModule = await Module.findOne({ course })
    .sort({ order: -1 })
    .select("order");

  const order = moduleData.order ?? (lastModule ? lastModule.order + 1 : 1);

  const module = await Module.create({
    course,
    title,
    description,
    order,
    estimatedDuration,
    isPreview,
  });

  return module;
};

/**
 * Get module by ID
 */
export const getModuleById = async (moduleId) => {
  const module = await Module.findById(moduleId).populate(
    "course",
    "title slug"
  );

  if (!module) {
    throw new NotFoundError("Module not found.");
  }

  return module;
};

/**
 * Get all modules of a course
 */
export const getModulesByCourse = async (courseId) => {
  const course = await Course.findById(courseId);

  if (!course) {
    throw new NotFoundError("Course not found.");
  }

  const modules = await Module.find({ course: courseId })
    .sort({ order: 1 });

  return modules;
};

/**
 * Update module details
 */
export const updateModule = async (moduleId, updateData, user) => {
  // Verify ownership first
  const module = await assertModuleOwnership(moduleId, user);

  // Whitelist update fields — never allow direct overwrite of
  // protected fields like course, version, deletedAt, etc.
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (updateData[field] !== undefined) {
      module[field] = updateData[field];
    }
  }

  await module.save();

  return module;
};

/**
 * Publish module
 */
export const publishModule = async (moduleId, user) => {
  const module = await assertModuleOwnership(moduleId, user);

  module.status = "published";
  await module.save();

  return module;
};

/**
 * Archive module
 */
export const archiveModule = async (moduleId, user) => {
  const module = await assertModuleOwnership(moduleId, user);

  module.status = "archived";
  await module.save();

  return module;
};

/**
 * Soft delete module
 */
export const deleteModule = async (moduleId, user) => {
  const module = await assertModuleOwnership(moduleId, user);

  module.deletedAt = new Date();
  await module.save();

  return { id: moduleId, deleted: true };
};