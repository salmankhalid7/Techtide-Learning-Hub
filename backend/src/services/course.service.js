import Course from "../models/course.model.js";
import Enrollment from "../models/enrollment.model.js";
// Ensure the Tag model is registered so `populate("tags")` on discovery rails
// resolves (the Course schema references a "Tag" ref).
import "../models/tag.model.js";
import {
  COURSE_STATUS,
  COURSE_VISIBILITY,
} from "../constants/course.constants.js";
import { NotFoundError, ForbiddenError, BadRequestError } from "../errors/index.js";
import { notifyUser } from "./notification.service.js";
import { NOTIFICATION_TYPES } from "../constants/notification.constants.js";

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
    "featured",
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
    // Advanced discovery filters (roadmap #8)
    minPrice,
    maxPrice,
    free,
    minRating,
    maxRating,
    featured,
    tags,
  } = queryParams;

  const isAdmin = user?.role === "admin";
  const isOwner = !!user && !isAdmin && instructor === String(user._id);

  // Build the filter query dynamically
  const query = {};

  if (search) query.$text = { $search: search };
  if (category) query.category = category;
  if (level) query.level = level;

  // ── Price filtering ────────────────────────────────────
  // free=true -> price === 0 ; minPrice/maxPrice bound `pricing.price`.
  if (free === "true" || free === true) {
    query["pricing.price"] = 0;
  } else {
    const priceRange = {};
    if (minPrice !== undefined && minPrice !== "") priceRange.$gte = Number(minPrice);
    if (maxPrice !== undefined && maxPrice !== "") priceRange.$lte = Number(maxPrice);
    if (Object.keys(priceRange).length) query["pricing.price"] = priceRange;
  }

  // ── Rating filtering ───────────────────────────────────
  // Bounds `statistics.averageRating`.
  const ratingRange = {};
  if (minRating !== undefined && minRating !== "") ratingRange.$gte = Number(minRating);
  if (maxRating !== undefined && maxRating !== "") ratingRange.$lte = Number(maxRating);
  if (Object.keys(ratingRange).length) query["statistics.averageRating"] = ratingRange;

  // ── Tags / featured ────────────────────────────────────
  if (tags) {
    const tagIds = Array.isArray(tags) ? tags : [tags];
    query.tags = { $all: tagIds.filter(Boolean) };
  }
  if (featured === "true" || featured === true) query.featured = true;

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

// ── Advanced Discovery (roadmap #8) ─────────────────────────
// Marketplace rails: featured / popular / trending / recommended.
//
// All of these only ever return PUBLISHED + PUBLIC courses (the same scope
// guard as `getCourses`), so none of them leak drafts/private content.

/** Base query for marketplace rails: published + public + not deleted. */
const _railsQuery = (extra = {}) => ({
  status: COURSE_STATUS.PUBLISHED,
  visibility: COURSE_VISIBILITY.PUBLIC,
  ...extra,
});

/**
 * Popular courses — highest student count first (ranked by enrollments).
 */
const getPopularCourses = async ({ limit = 10 } = {}) => {
  const courses = await Course.find(_railsQuery())
    .populate("instructor", "fullName username avatar")
    .populate("category", "name slug")
    .populate("tags", "name slug")
    .sort({ "statistics.totalEnrollments": -1, "statistics.averageRating": -1 })
    .limit(Number(limit));
  return { courses };
};

/**
 * Trending courses — most-enrolled within a recent window (default 30 days).
 * A course is "trending" when it has real enrollment activity in the recent
 * period; ties fall back to rating.
 */
const getTrendingCourses = async ({ limit = 10, days = 30 } = {}) => {
  const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

  const recentEnrollments = await Enrollment.aggregate([
    {
      $match: {
        enrolledAt: { $gte: since },
        // Include ACTIVE + COMPLETED enrollments as recent activity.
        status: { $in: ["ACTIVE", "COMPLETED"] },
      },
    },
    { $group: { _id: "$course", recent: { $sum: 1 } } },
    { $sort: { recent: -1 } },
    { $limit: Number(limit) * 2 }, // over-fetch, then hydrate + filter
  ]);

  const courseIds = recentEnrollments.map((r) => r._id);
  if (!courseIds.length) return { courses: [] };

  const courses = await Course.find({
    ..._railsQuery(),
    _id: { $in: courseIds },
  })
    .populate("instructor", "fullName username avatar")
    .populate("category", "name slug")
    .populate("tags", "name slug")
    .sort({ "statistics.totalEnrollments": -1 })
    .limit(Number(limit));

  return { courses };
};

/**
 * Featured courses — explicitly flagged `featured: true` (merchandising rail).
 */
const getFeaturedCourses = async ({ limit = 10 } = {}) => {
  const courses = await Course.find(_railsQuery({ featured: true }))
    .populate("instructor", "fullName username avatar")
    .populate("category", "name slug")
    .populate("tags", "name slug")
    .sort({ "statistics.averageRating": -1, createdAt: -1 })
    .limit(Number(limit));
  return { courses };
};

/**
 * Recommended courses for a student.
 *
 * Heuristic (no ML): we look at the categories of courses the student has
 * enrolled in (or completed) and recommend other PUBLISHED/PUBLIC courses in
 * those categories that the student is NOT already enrolled in, ranked by
 * rating. Falls back to top-rated courses when the student has no signal or is
 * anonymous.
 *
 * @param {Object} opts { studentId, limit }
 */
const getRecommendedCourses = async ({ studentId, limit = 10 } = {}) => {
  let excludeCourseIds = [];
  let preferredCategories = [];

  if (studentId) {
    // Courses the student already interacts with (any enrollment status).
    const enrolled = await Enrollment.find({ student: studentId }).select("course").lean();
    excludeCourseIds = enrolled.map((e) => e.course);

    // Categories of the student's (non-dropped) enrollments -> preference signal.
    const active = enrolled.filter((e) => e.status !== "DROPPED");
    if (active.length) {
      const activeCourses = await Course.find({
        _id: { $in: active.map((e) => e.course) },
      })
        .select("category")
        .lean();
      preferredCategories = [
        ...new Set(activeCourses.map((c) => c.category && String(c.category)).filter(Boolean)),
      ];
    }
  }

  const q = _railsQuery();
  if (preferredCategories.length) q.category = { $in: preferredCategories };
  if (excludeCourseIds.length) q._id = { $nin: excludeCourseIds };

  const courses = await Course.find(q)
    .populate("instructor", "fullName username avatar")
    .populate("category", "name slug")
    .populate("tags", "name slug")
    .sort({ "statistics.averageRating": -1, "statistics.totalEnrollments": -1 })
    .limit(Number(limit));

  return { courses, sourceId: preferredCategories.length ? "category_affinity" : "top_rated" };
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

  // Notify the course owner that their course is now published (best effort).
  try {
    await notifyUser({
      recipient: course.instructor,
      type: NOTIFICATION_TYPES.COURSE_PUBLISHED,
      title: "Your course is live 🎉",
      body: `"${course.title}" has been published and is now available to students.`,
      data: { course: course._id },
    });
  } catch (e) {
    // Notification failure must not break publishing.
  }

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
  // Advanced discovery (roadmap #8)
  getPopularCourses,
  getTrendingCourses,
  getFeaturedCourses,
  getRecommendedCourses,
};

export default courseService;