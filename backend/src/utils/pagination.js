/**
 * Pagination Utils
 * Calculate pagination values and build paginated responses.
 */

import { config } from "../config/index.js";

export const getPagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);

  const limit = Math.min(
    Math.max(
      parseInt(query.limit, 10) || config.pagination.defaultPageSize,
      1
    ),
    config.pagination.maxPageSize
  );

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Builds a standardized pagination response.
 *
 * @param {number} totalItems - Total number of records.
 * @param {number} page - Current page.
 * @param {number} limit - Items per page.
 * @returns {{
 *   totalItems: number,
 *   totalPages: number,
 *   currentPage: number,
 *   pageSize: number,
 *   hasNextPage: boolean,
 *   hasPreviousPage: boolean
 * }}
 */
export const getPaginationMeta = (
  totalItems,
  page,
  limit
) => {
  const totalPages = Math.ceil(totalItems / limit);

  return {
    totalItems,
    totalPages,
    currentPage: page,
    pageSize: limit,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};