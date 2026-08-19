import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import courseService from "../services/course.service.js";

const createCourse = asyncHandler(async (req, res) => {
  const course = await courseService.createCourse(req.body, req.user);

  return res
    .status(201)
    .json(new ApiResponse(201, course, "Course created successfully."));
});

const updateCourse = asyncHandler(async (req, res) => {
  const course = await courseService.updateCourse(
    req.params.courseId,
    req.body,
    req.user
  );

  return res
    .status(200)
    .json(new ApiResponse(200, course, "Course updated successfully."));
});

const getCourseById = asyncHandler(async (req, res) => {
  const course = await courseService.getCourseById(req.params.courseId);

  return res
    .status(200)
    .json(new ApiResponse(200, course, "Course retrieved successfully."));
});

const getCourses = asyncHandler(async (req, res) => {
  const courses = await courseService.getCourses(req.query, req.user);

  return res
    .status(200)
    .json(new ApiResponse(200, courses, "Courses retrieved successfully."));
});

// ── Advanced Discovery rails (roadmap #8) ─────────────────────

/** GET /courses/featured */
const getFeaturedCourses = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const result = await courseService.getFeaturedCourses({ limit });
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Featured courses retrieved successfully."));
});

/** GET /courses/popular */
const getPopularCourses = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const result = await courseService.getPopularCourses({ limit });
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Popular courses retrieved successfully."));
});

/** GET /courses/trending */
const getTrendingCourses = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const result = await courseService.getTrendingCourses({ limit, days });
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Trending courses retrieved successfully."));
});

/** GET /courses/recommended (optional auth — personalized for logged-in student) */
const getRecommendedCourses = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const result = await courseService.getRecommendedCourses({
    studentId: req.user?._id || null,
    limit,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Recommended courses retrieved successfully."));
});

const publishCourse = asyncHandler(async (req, res) => {
  const course = await courseService.publishCourse(
    req.params.courseId,
    req.user
  );

  return res
    .status(200)
    .json(new ApiResponse(200, course, "Course published successfully."));
});

const archiveCourse = asyncHandler(async (req, res) => {
  const course = await courseService.archiveCourse(
    req.params.courseId,
    req.user
  );

  return res
    .status(200)
    .json(new ApiResponse(200, course, "Course archived successfully."));
});

const deleteCourse = asyncHandler(async (req, res) => {
  await courseService.deleteCourse(req.params.courseId, req.user);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Course deleted successfully."));
});


export {
  createCourse,
  updateCourse,
  getCourseById,
  getCourses,
  publishCourse,
  archiveCourse,
  deleteCourse,
  // Advanced discovery
  getFeaturedCourses,
  getPopularCourses,
  getTrendingCourses,
  getRecommendedCourses,
};