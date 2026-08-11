import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  createModule,
  getModuleById,
  getModulesByCourse,
  updateModule,
  publishModule,
  archiveModule,
  deleteModule,
  reorderModules,
} from "../services/module.service.js";

/**
 * @desc    Create a new module
 * @route   POST /api/v1/modules
 * @access  Private (Teacher/Admin)
 */
export const createModuleController = asyncHandler(async (req, res) => {
  const module = await createModule(req.body, req.user);

  return res
    .status(201)
    .json(new ApiResponse(201, module, "Module created successfully."));
});

/**
 * @desc    Get a module by ID
 * @route   GET /api/v1/modules/:moduleId
 * @access  Public (owner/admin see all; public sees only published+public)
 */
export const getModuleController = asyncHandler(async (req, res) => {
  const module = await getModuleById(req.params.moduleId, req.user);

  return res
    .status(200)
    .json(new ApiResponse(200, module, "Module retrieved successfully."));
});

/**
 * @desc    Get all modules of a course
 * @route   GET /api/v1/modules/course/:courseId
 * @access  Public (owner/admin see all; public sees only published+public)
 */
export const getCourseModulesController = asyncHandler(async (req, res) => {
  const modules = await getModulesByCourse(req.params.courseId, req.user);

  return res
    .status(200)
    .json(new ApiResponse(200, modules, "Modules retrieved successfully."));
});

/**
 * @desc    Update a module
 * @route   PATCH /api/v1/modules/:moduleId
 * @access  Private (Teacher/Admin)
 */
export const updateModuleController = asyncHandler(async (req, res) => {
  const module = await updateModule(
    req.params.moduleId,
    req.body,
    req.user
  );

  return res
    .status(200)
    .json(new ApiResponse(200, module, "Module updated successfully."));
});

/**
 * @desc    Publish a module
 * @route   PATCH /api/v1/modules/:moduleId/publish
 * @access  Private (Teacher/Admin)
 */
export const publishModuleController = asyncHandler(async (req, res) => {
  const module = await publishModule(
    req.params.moduleId,
    req.user
  );

  return res
    .status(200)
    .json(new ApiResponse(200, module, "Module published successfully."));
});

/**
 * @desc    Archive a module
 * @route   PATCH /api/v1/modules/:moduleId/archive
 * @access  Private (Teacher/Admin)
 */
export const archiveModuleController = asyncHandler(async (req, res) => {
  const module = await archiveModule(
    req.params.moduleId,
    req.user
  );

  return res
    .status(200)
    .json(new ApiResponse(200, module, "Module archived successfully."));
});

/**
 * @desc    Soft-delete a module
 * @route   DELETE /api/v1/modules/:moduleId
 * @access  Private (Teacher/Admin)
 */
export const deleteModuleController = asyncHandler(async (req, res) => {
  await deleteModule(req.params.moduleId, req.user);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Module deleted successfully."));
});

/**
 * @desc    Reorder modules within a course
 * @route   PATCH /api/v1/modules/reorder
 * @access  Private (Instructor/Admin)
 */
export const reorderModuleController = asyncHandler(async (req, res) => {
  const { courseId, modules } = req.body;

  const updatedModules = await reorderModules(
    courseId,
    modules,
    req.user
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedModules, "Modules reordered successfully."));
});
