import Course from "../models/course.model.js";
import {
  COURSE_STATUS,
  COURSE_VISIBILITY,
} from "../constants/course.constants.js";
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
//
// Access scoping (H1):
//  - Anonymous visitors and students: only `status: "published"` AND
//    `visibility: "public"` courses are returned. Client-supplied
//    `status` / `visibility` filters are IGNORED so draft/archived/private
//    courses cannot leak.
//  - Course instructors: may also see their own courses in any status via
//    `instructor` (their own id).
//  - Admins: may filter by any status/visibility (full management view).
const getCourses = async (queryParams, user) => {
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

  const isAdmin = user?.role === "admin";
  const isOwner = !!user && !isAdmin && instructor === String(user._id);

  // Build the filter query dynamically
  const query = {};

  if (search) query.$text = { $search: search };
  if (category) query.category = category;
  if (level) query.level = level;

  // Instructors may filter by their OWN instructor id to see their own
  // courses including drafts/archived (owner-scoped management view).
  if (instructor && isOwner) {
    query.instructor = instructor;
    if (status) query.status = status;
    if (queryParams.visibility) {
      query.visibility = queryParams.visibility;
    }
  } else {
    // Default scope for all other callers (anonymous, students, and
    // instructors without an owner filter): published + public only.
    // Clients cannot override this, preventing disclosure of drafts etc.
    query.status = COURSE_STATUS.PUBLISHED;
    query.visibility = COURSE_VISIBILITY.PUBLIC;

    if (isAdmin && status) query.status = status;
    if (isAdmin && queryParams.visibility) {
      query.visibility = queryParams.visibility;
    }
    if (instructor && isAdmin) query.instructor = instructor;
  }

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
//
// Optimized (M2): only the ownership-relevant `instructor` field is hydrated
// for the authorization check, then a single targeted `findByIdAndUpdate`
// flips the status to archived. `findByIdAndUpdate({ new: true })` returns
// the updated hydrated document so the API response shape is unchanged.
const archiveCourse = async (courseId, user) => {
  // Ownership/existence check — minimal projection. Explicit soft-delete
  // filter because findOne/update queries do not run the `pre(/^find/)`
  // middleware that normally excludes soft-deleted courses.
  const course = await Course.findOne({
    _id: courseId,
    isDeleted: { $ne: true },
  }).select("instructor");

  if (!course) {
    throw new NotFoundError("Course not found.");
  }

  // Only instructor or admin
  if (
    course.instructor.toString() !== user._id.toString() &&
    user.role !== "admin"
  ) {
    throw new ForbiddenError("You are not authorized to archive this course.");
  }

  const updated = await Course.findByIdAndUpdate(
    courseId,
    { $set: { status: COURSE_STATUS.ARCHIVED } },
    { new: true }
  );

  return updated;
};

// ── Delete Course (Soft) ───────────────────────────────────
// Marks the course as deleted so the find middleware excludes it by default.
//
// Optimized (M2): only the ownership-relevant `instructor` field is hydrated
// for the authorization check, then a single targeted `updateOne` performs the
// soft-delete. The controller returns `null`, so no updated document is needed.
const deleteCourse = async (courseId, user) => {
  // Ownership/existence check — minimal projection. Explicit soft-delete
  // filter because update queries do not run the `pre(/^find/)` middleware
  // that normally excludes soft-deleted courses.
  const course = await Course.findOne({
    _id: courseId,
    isDeleted: { $ne: true },
  }).select("instructor");

  if (!course) {
    throw new NotFoundError("Course not found.");
  }

  // Only instructor or admin
  if (
    course.instructor.toString() !== user._id.toString() &&
    user.role !== "admin"
  ) {
    throw new ForbiddenError("You are not authorized to delete this course.");
  }

  await Course.updateOne(
    { _id: courseId },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );
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