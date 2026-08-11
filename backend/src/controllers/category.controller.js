/**
 * @file category.controller.js
 * @description HTTP handlers for Category endpoints.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import categoryService from "../services/category.service.js";

/**
 * @desc    List categories (public)
 * @route   GET /api/v1/categories
 * @access  Public
 */
export const listCategories = asyncHandler(async (req, res) => {
  const result = await categoryService.listCategories(req.query, req.user);

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Categories retrieved successfully.", result)
    );
});

/**
 * @desc    Get a single category by id
 * @route   GET /api/v1/categories/:categoryId
 * @access  Public
 */
export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(
    req.params.categoryId,
    req.user
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Category retrieved successfully.", category));
});

/**
 * @desc    Create a category (admin)
 * @route   POST /api/v1/categories
 * @access  Private (Admin)
 */
export const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body, req.user);

  return res
    .status(201)
    .json(new ApiResponse(201, "Category created successfully.", category));
});

/**
 * @desc    Update a category (admin)
 * @route   PATCH /api/v1/categories/:categoryId
 * @access  Private (Admin)
 */
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(
    req.params.categoryId,
    req.body,
    req.user
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Category updated successfully.", category));
});

/**
 * @desc    Soft-delete a category (admin)
 * @route   DELETE /api/v1/categories/:categoryId
 * @access  Private (Admin)
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  const result = await categoryService.deleteCategory(
    req.params.categoryId,
    req.user
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Category deleted successfully.", result));
});
