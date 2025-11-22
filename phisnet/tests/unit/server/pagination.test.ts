/**
 * Unit tests for pagination utilities
 */

import { parsePaginationParams, buildPaginationMetadata } from '../../../server/utils/pagination';

describe('Pagination Utilities', () => {
  describe('parsePaginationParams', () => {
    it('should use default values when no parameters provided', () => {
      const result = parsePaginationParams();
      
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should parse valid string parameters', () => {
      const result = parsePaginationParams('3', '10');
      
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(result.offset).toBe(20); // (3-1) * 10
    });

    it('should parse valid number parameters', () => {
      const result = parsePaginationParams(5, 25);
      
      expect(result.page).toBe(5);
      expect(result.pageSize).toBe(25);
      expect(result.offset).toBe(100); // (5-1) * 25
    });

    it('should clamp page to minimum of 1', () => {
      const result = parsePaginationParams(0);
      expect(result.page).toBe(1);
      
      const result2 = parsePaginationParams(-5);
      expect(result2.page).toBe(1);
    });

    it('should clamp pageSize to minimum of 1', () => {
      // When 0 is passed as a number, String(0) = '0', parseInt('0') = 0
      // But then (parseInt || 20) means if parseInt result is falsy (0), use 20
      // So Math.max(1, 20) = 20
      const result = parsePaginationParams(1, 0);
      expect(result.pageSize).toBe(20); // 0 is falsy, so defaults to 20

      // When -10 is passed, String(-10) = '-10', parseInt('-10') = -10 (truthy)
      // Math.max(1, -10) = 1
      const result2 = parsePaginationParams(1, -10);
      expect(result2.pageSize).toBe(1); // Negative is clamped to minimum 1
    });    it('should clamp pageSize to maxPageSize (default 100)', () => {
      const result = parsePaginationParams(1, 150);
      expect(result.pageSize).toBe(100);
    });

    it('should respect custom maxPageSize', () => {
      const result = parsePaginationParams(1, 75, 50);
      expect(result.pageSize).toBe(50);
    });

    it('should handle invalid string inputs by defaulting', () => {
      const result = parsePaginationParams('invalid', 'notanumber');
      
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should handle NaN by defaulting', () => {
      const result = parsePaginationParams(NaN, NaN);
      
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should handle undefined parameters', () => {
      const result = parsePaginationParams(undefined, undefined);
      
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should calculate correct offset for various pages', () => {
      expect(parsePaginationParams(1, 10).offset).toBe(0);
      expect(parsePaginationParams(2, 10).offset).toBe(10);
      expect(parsePaginationParams(3, 10).offset).toBe(20);
      expect(parsePaginationParams(10, 25).offset).toBe(225);
    });

    it('should handle edge case of page 1 with large pageSize', () => {
      const result = parsePaginationParams(1, 1000, 1000);
      
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(1000);
      expect(result.offset).toBe(0);
    });
  });

  describe('buildPaginationMetadata', () => {
    it('should build correct metadata for first page', () => {
      const metadata = buildPaginationMetadata(100, 1, 20);
      
      expect(metadata.page).toBe(1);
      expect(metadata.pageSize).toBe(20);
      expect(metadata.total).toBe(100);
      expect(metadata.totalPages).toBe(5); // 100/20
    });

    it('should build correct metadata for middle page', () => {
      const metadata = buildPaginationMetadata(100, 3, 20);
      
      expect(metadata.page).toBe(3);
      expect(metadata.pageSize).toBe(20);
      expect(metadata.total).toBe(100);
      expect(metadata.totalPages).toBe(5);
    });

    it('should build correct metadata for last page', () => {
      const metadata = buildPaginationMetadata(100, 5, 20);
      
      expect(metadata.page).toBe(5);
      expect(metadata.pageSize).toBe(20);
      expect(metadata.total).toBe(100);
      expect(metadata.totalPages).toBe(5);
    });

    it('should handle partial last page', () => {
      const metadata = buildPaginationMetadata(95, 5, 20);
      
      expect(metadata.total).toBe(95);
      expect(metadata.totalPages).toBe(5); // 95/20 = 4.75, ceil = 5
    });

    it('should handle exactly divisible totals', () => {
      const metadata = buildPaginationMetadata(60, 1, 20);
      
      expect(metadata.totalPages).toBe(3); // 60/20 = 3
    });

    it('should handle zero total with minimum 1 page', () => {
      const metadata = buildPaginationMetadata(0, 1, 20);
      
      expect(metadata.total).toBe(0);
      expect(metadata.totalPages).toBe(1); // Minimum 1 page even with 0 items
    });

    it('should handle single item', () => {
      const metadata = buildPaginationMetadata(1, 1, 20);
      
      expect(metadata.total).toBe(1);
      expect(metadata.totalPages).toBe(1);
    });

    it('should handle large totals', () => {
      const metadata = buildPaginationMetadata(10000, 50, 100);
      
      expect(metadata.total).toBe(10000);
      expect(metadata.totalPages).toBe(100); // 10000/100
    });

    it('should handle pageSize of 1', () => {
      const metadata = buildPaginationMetadata(5, 3, 1);
      
      expect(metadata.totalPages).toBe(5); // 5 items, 1 per page = 5 pages
    });

    it('should return correct structure with all required fields', () => {
      const metadata = buildPaginationMetadata(50, 2, 10);
      
      expect(metadata).toHaveProperty('page');
      expect(metadata).toHaveProperty('pageSize');
      expect(metadata).toHaveProperty('total');
      expect(metadata).toHaveProperty('totalPages');
      expect(Object.keys(metadata).length).toBe(4);
    });
  });

  describe('Integration: parsePaginationParams + buildPaginationMetadata', () => {
    it('should work together for complete pagination flow', () => {
      const totalItems = 95;
      const params = parsePaginationParams('3', '20');
      const metadata = buildPaginationMetadata(totalItems, params.page, params.pageSize);
      
      expect(params.page).toBe(3);
      expect(params.offset).toBe(40); // Skip first 40 items
      expect(metadata.totalPages).toBe(5);
      expect(metadata.total).toBe(95);
    });

    it('should handle boundary case: requesting last page', () => {
      const totalItems = 100;
      const params = parsePaginationParams('5', '20');
      const metadata = buildPaginationMetadata(totalItems, params.page, params.pageSize);
      
      expect(params.page).toBe(5);
      expect(params.offset).toBe(80); // Skip first 80 items
      expect(metadata.page).toBe(5);
      expect(metadata.totalPages).toBe(5);
    });

    it('should handle boundary case: requesting beyond last page', () => {
      const totalItems = 50;
      const params = parsePaginationParams('10', '20'); // Page 10 doesn't exist
      const metadata = buildPaginationMetadata(totalItems, params.page, params.pageSize);
      
      expect(params.page).toBe(10);
      expect(params.offset).toBe(180);
      expect(metadata.totalPages).toBe(3); // Only 3 pages exist
    });
  });
});
