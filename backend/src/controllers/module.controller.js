import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as moduleService from "../services/module.service.js";

/**
 * @desc    Create a new module
 * @route   POST /api/v1/modules
 * @access  Private (Teacher/Admin)
 */
export const createModuleController = asyncHandler(async (req, res) => {
  const module = await moduleService.createModule(req.body, req.user);

  return res
    .status(201)
    .json(new ApiResponse(201, module, "Module created successfully."));
});

/**
 * @desc    Get a module by ID
 * @route   GET /api/v1/modules/:moduleId
 * @access  Public
 */
export const getModuleController = asyncHandler(async (req, res) => {
  const module = await moduleService.getModuleById(req.params.moduleId);

  return res
    .status(200)
    .json(new ApiResponse(200, module, "Module retrieved successfully."));
});

/**
 * @desc    Get all modules of a course
 * @route   GET /api/v1/modules/course/:courseId
 * @access  Public
 */
export const getCourseModulesController = asyncHandler(async (req, res) => {
  const modules = await moduleService.getModulesByCourse(req.params.courseId);

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
  const module = await moduleService.updateModule(
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
  const module = await moduleService.publishModule(
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
  const module = await moduleService.archiveModule(
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
  await moduleService.deleteModule(req.params.moduleId, req.user);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Module deleted successfully."));
});
