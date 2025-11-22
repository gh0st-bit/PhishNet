/**
 * Shared pagination utilities for admin endpoints
 */

export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

export interface PaginationMetadata {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Parse and clamp pagination parameters from query string
 * @param pageRaw - Raw page parameter (default 1)
 * @param pageSizeRaw - Raw pageSize parameter (default 20)
 * @param maxPageSize - Maximum allowed page size (default 100)
 * @returns PaginationParams with clamped values and calculated offset
 */
export function parsePaginationParams(
  pageRaw?: string | number,
  pageSizeRaw?: string | number,
  maxPageSize: number = 100
): PaginationParams {
  const page = Math.max(1, Number.parseInt(String(pageRaw ?? '1')) || 1);
  const pageSize = Math.min(
    Math.max(1, Number.parseInt(String(pageSizeRaw ?? '20')) || 20),
    maxPageSize
  );
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}

/**
 * Build pagination metadata from total count
 * @param total - Total number of items
 * @param page - Current page number
 * @param pageSize - Items per page
 * @returns PaginationMetadata object
 */
export function buildPaginationMetadata(
  total: number,
  page: number,
  pageSize: number
): PaginationMetadata {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}
