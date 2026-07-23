import Course from "../models/course.model.js";
import { COURSE_STATUS } from "../constants/course.constants.js";
import { NotFoundError, ForbiddenError, BadRequestError } from "../errors/index.js";

// ── Create Course ──────────────────────────────────────────
// Creates a new course as a draft owned by the authenticated user.
const createCourse = async (courseData, user) => {
  const course = await Course.create({
    ...courseData,
    instructor: user._id,
    status: COURSE_STATUS.DRAFT,
  });

  if (!course) {
    throw new BadRequestError("Failed to create course.");
  }

  return course;
};

// ── Update Course ──────────────────────────────────────────
// Updates allowed fields on a course. Only the instructor or an admin may update.
const updateCourse = async (courseId, updateData, user) => {
  const course = await Course.findById(courseId);

  if (!course) {
    throw new NotFoundError("Course not found.");
  }

  // Only the course instructor or admin can update
  if (
    course.instructor.toString() !== user._id.toString() &&
    user.role !== "admin"
  ) {
    throw new ForbiddenError("You are not authorized to update this course.");
  }

  // Whitelist of fields the client is allowed to modify
  const allowedFields = [
    "title",
    "shortDescription",
    "description",
    "courseLanguage",
    "level",
    "category",
    "tags",
    "thumbnail",
    "previewVideo",
    "pricing",
    "visibility",
    "seo",
    "settings",
  ];

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      course[field] = updateData[field];
    }
  });

  await course.save();

  return course;
};

// ── Get Course By ID ───────────────────────────────────────
// Fetches a single course with instructor, category, and tags populated.
const getCourseById = async (courseId) => {
  const course = await Course.findById(courseId)
    .populate("instructor", "fullName username avatar")
    .populate("category", "name slug");

  if (!course) {
    throw new NotFoundError("Course not found.");
  }

  return course;
};

// ── Get Courses (Paginated / Filtered) ─────────────────────
// Supports text search, category/level/status/instructor filters, and sorting.
const getCourses = async (queryParams) => {
  const {
    page = 1,
    limit = 10,
    search,
    category,
    level,
    status,
    instructor,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = queryParams;

  // Build the filter query dynamically
  const query = {};

  if (search) query.$text = { $search: search };
  if (category) query.category = category;
  if (level) query.level = level;
  if (status) query.status = status;
  if (instructor) query.instructor = instructor;

  const skip = (page - 1) * limit;

  const [courses, totalCourses] = await Promise.all([
    Course.find(query)
      .populate("instructor", "fullName username avatar")
      .populate("category", "name slug")
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(Number(limit)),
    Course.countDocuments(query),
  ]);

  return {
    courses,
    pagination: {
      totalCourses,
      currentPage: Number(page),
      totalPages: Math.ceil(totalCourses / limit),
      limit: Number(limit),
    },
  };
};

// ── Publish Course ─────────────────────────────────────────
// Validates that required fields are present before publishing.
const publishCourse = async (courseId, user) => {
  const course = await Course.findById(courseId);

  if (!course) {
    throw new NotFoundError("Course not found.");
  }

  // Only instructor or admin
  if (
    course.instructor.toString() !== user._id.toString() &&
    user.role !== "admin"
  ) {
    throw new ForbiddenError("You are not authorized to publish this course.");
  }

  // Basic publish checks — thumbnail and category are required
  if (!course.thumbnail?.url) {
    throw new BadRequestError("Course thumbnail is required.");
  }

  if (!course.category) {
    throw new BadRequestError("Course category is required.");
  }

  if (course.status === COURSE_STATUS.PUBLISHED) {
    throw new BadRequestError("Course is already published.");
  }

  course.status = COURSE_STATUS.PUBLISHED;
  course.publishedAt = new Date();

  await course.save();

  return course;
};

// ── Archive Course ─────────────────────────────────────────
// Moves a course to the archived status.
const archiveCourse = async (courseId, user) => {
  const course = await Course.findById(courseId);

  if (!course) {
    throw new NotFoundError("Course not found.");
  }

  if (
    course.instructor.toString() !== user._id.toString() &&
    user.role !== "admin"
  ) {
    throw new ForbiddenError("You are not authorized to archive this course.");
  }

  course.status = COURSE_STATUS.ARCHIVED;

  await course.save();

  return course;
};

// ── Delete Course (Soft) ───────────────────────────────────
// Marks the course as deleted so the find middleware excludes it by default.
const deleteCourse = async (courseId, user) => {
  const course = await Course.findById(courseId);

  if (!course) {
    throw new NotFoundError("Course not found.");
  }

  if (
    course.instructor.toString() !== user._id.toString() &&
    user.role !== "admin"
  ) {
    throw new ForbiddenError("You are not authorized to delete this course.");
  }

  course.isDeleted = true;
  course.deletedAt = new Date();

  await course.save();
};

// ── Service Object ─────────────────────────────────────────
const courseService = {
  createCourse,
  updateCourse,
  getCourseById,
  getCourses,
  publishCourse,
  archiveCourse,
  deleteCourse,
};

export default courseService;