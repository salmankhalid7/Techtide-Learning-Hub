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
  const courses = await courseService.getCourses(req.query);

  return res
    .status(200)
    .json(new ApiResponse(200, courses, "Courses retrieved successfully."));
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
};