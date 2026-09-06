import { validateToolInput, sanitizeToolInput } from '../tools/tool-input.validator';

const SALES_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    dateFrom: { type: 'string', description: 'Start date' },
    dateTo: { type: 'string', description: 'End date' },
    currency: { type: 'string', description: 'Currency code' },
    page: { type: 'number', description: 'Page number' },
    limit: { type: 'number', description: 'Items per page' },
  },
};

const LOW_STOCK_SCHEMA = {
  type: 'object',
  properties: {
    warehouseId: { type: 'string', description: 'Warehouse ID' },
    page: { type: 'number', description: 'Page number' },
    limit: { type: 'number', description: 'Items per page' },
  },
};

const DASHBOARD_SCHEMA = {
  type: 'object',
  properties: {
    currency: { type: 'string', description: 'Currency code' },
  },
};

describe('ToolInputValidator', () => {
  describe('validateToolInput', () => {
    describe('object validation', () => {
      it('returns valid for undefined input (all fields optional)', () => {
        const result = validateToolInput(undefined, SALES_SUMMARY_SCHEMA, 'test_tool');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('returns valid for null input', () => {
        const result = validateToolInput(null, SALES_SUMMARY_SCHEMA, 'test_tool');
        expect(result.valid).toBe(true);
      });

      it('returns valid for empty object', () => {
        const result = validateToolInput({}, SALES_SUMMARY_SCHEMA, 'test_tool');
        expect(result.valid).toBe(true);
      });

      it('rejects array arguments', () => {
        const result = validateToolInput(
          ['invalid'] as any,
          SALES_SUMMARY_SCHEMA,
          'test_tool',
        );
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('must be an object');
      });

      it('rejects string arguments', () => {
        const result = validateToolInput(
          'invalid' as any,
          SALES_SUMMARY_SCHEMA,
          'test_tool',
        );
        expect(result.valid).toBe(false);
      });

      it('rejects number arguments', () => {
        const result = validateToolInput(
          42 as any,
          SALES_SUMMARY_SCHEMA,
          'test_tool',
        );
        expect(result.valid).toBe(false);
      });

      it('rejects boolean arguments', () => {
        const result = validateToolInput(
          true as any,
          SALES_SUMMARY_SCHEMA,
          'test_tool',
        );
        expect(result.valid).toBe(false);
      });
    });

    describe('type validation', () => {
      it('accepts valid string input', () => {
        const result = validateToolInput(
          { dateFrom: '2026-09-01' },
          SALES_SUMMARY_SCHEMA,
          'get_sales_summary',
        );
        expect(result.valid).toBe(true);
      });

      it('accepts valid number input', () => {
        const result = validateToolInput(
          { page: 1, limit: 20 },
          SALES_SUMMARY_SCHEMA,
          'get_sales_summary',
        );
        expect(result.valid).toBe(true);
      });

      it('rejects string where number expected', () => {
        const result = validateToolInput(
          { page: 'abc' },
          SALES_SUMMARY_SCHEMA,
          'get_sales_summary',
        );
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('"page" must be a number');
      });

      it('rejects number where string expected', () => {
        const result = validateToolInput(
          { dateFrom: 12345 },
          SALES_SUMMARY_SCHEMA,
          'get_sales_summary',
        );
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('"dateFrom" must be a string');
      });

      it('rejects Infinity', () => {
        const result = validateToolInput(
          { page: Infinity },
          SALES_SUMMARY_SCHEMA,
          'get_sales_summary',
        );
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('must be a finite number');
      });

      it('rejects NaN', () => {
        const result = validateToolInput(
          { page: NaN },
          SALES_SUMMARY_SCHEMA,
          'get_sales_summary',
        );
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('must be a finite number');
      });

      it('rejects negative number for page', () => {
        const result = validateToolInput(
          { page: -1 },
          SALES_SUMMARY_SCHEMA,
          'get_sales_summary',
        );
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('must not be negative');
      });
    });

    describe('UUID validation', () => {
      it('accepts valid UUID', () => {
        const result = validateToolInput(
          { warehouseId: '550e8400-e29b-41d4-a716-446655440000' },
          LOW_STOCK_SCHEMA,
          'get_low_stock',
        );
        expect(result.valid).toBe(true);
      });

      it('rejects invalid UUID', () => {
        const result = validateToolInput(
          { warehouseId: 'not-a-uuid' },
          LOW_STOCK_SCHEMA,
          'get_low_stock',
        );
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('must be a valid UUID');
      });

      it('rejects empty string UUID', () => {
        const result = validateToolInput(
          { warehouseId: '' },
          LOW_STOCK_SCHEMA,
          'get_low_stock',
        );
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('must be a valid UUID');
      });
    });

    describe('date validation', () => {
      it('accepts ISO date', () => {
        const result = validateToolInput(
          { dateFrom: '2026-09-01' },
          SALES_SUMMARY_SCHEMA,
          'get_sales_summary',
        );
        expect(result.valid).toBe(true);
      });

      it('accepts ISO datetime', () => {
        const result = validateToolInput(
          { dateFrom: '2026-09-01T12:00:00Z' },
          SALES_SUMMARY_SCHEMA,
          'get_sales_summary',
        );
        expect(result.valid).toBe(true);
      });

      it('rejects non-date string', () => {
        const result = validateToolInput(
          { dateFrom: 'not-a-date' },
          SALES_SUMMARY_SCHEMA,
          'get_sales_summary',
        );
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('valid ISO date');
      });
    });

    describe('unknown fields', () => {
      it('rejects unknown field', () => {
        const result = validateToolInput(
          { companyId: 'evil-company-id' } as any,
          DASHBOARD_SCHEMA,
          'get_dashboard',
        );
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('unknown field "companyId"');
      });

      it('rejects userId override attempt', () => {
        const result = validateToolInput(
          { userId: 'evil-user-id', currency: 'KZT' } as any,
          DASHBOARD_SCHEMA,
          'get_dashboard',
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('userId'))).toBe(true);
        // currency should still be valid
        expect(result.errors.some((e) => e.includes('currency'))).toBe(false);
      });

      it('rejects multiple unknown fields', () => {
        const result = validateToolInput(
          { evil1: 'a', evil2: 'b', currency: 'KZT' } as any,
          DASHBOARD_SCHEMA,
          'get_dashboard',
        );
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(2);
      });
    });

    describe('valid inputs', () => {
      it('accepts all valid fields for sales summary', () => {
        const result = validateToolInput(
          {
            dateFrom: '2026-09-01',
            dateTo: '2026-09-30',
            currency: 'KZT',
            page: 1,
            limit: 20,
          },
          SALES_SUMMARY_SCHEMA,
          'get_sales_summary',
        );
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('null/undefined field values', () => {
      it('accepts null field values (optional)', () => {
        const result = validateToolInput(
          { dateFrom: null, page: 1 },
          SALES_SUMMARY_SCHEMA,
          'get_sales_summary',
        );
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('sanitizeToolInput', () => {
    it('returns empty object for null input', () => {
      expect(sanitizeToolInput(null, SALES_SUMMARY_SCHEMA)).toEqual({});
    });

    it('returns empty object for undefined input', () => {
      expect(sanitizeToolInput(undefined, SALES_SUMMARY_SCHEMA)).toEqual({});
    });

    it('converts string numbers to actual numbers', () => {
      const result = sanitizeToolInput(
        { page: '3', limit: '50' },
        SALES_SUMMARY_SCHEMA,
      );
      expect(result.page).toBe(3);
      expect(result.limit).toBe(50);
    });

    it('preserves already-correct types', () => {
      const result = sanitizeToolInput(
        { page: 3, limit: 50 },
        SALES_SUMMARY_SCHEMA,
      );
      expect(result.page).toBe(3);
      expect(result.limit).toBe(50);
    });

    it('strips unknown fields', () => {
      const result = sanitizeToolInput(
        { currency: 'KZT', evilField: 'bad' } as any,
        DASHBOARD_SCHEMA,
      );
      expect(result.currency).toBe('KZT');
      expect(result.evilField).toBeUndefined();
    });

    it('preserves string fields as-is', () => {
      const result = sanitizeToolInput(
        { dateFrom: '2026-09-01' },
        SALES_SUMMARY_SCHEMA,
      );
      expect(result.dateFrom).toBe('2026-09-01');
    });

    it('handles non-numeric string for number field gracefully', () => {
      const result = sanitizeToolInput(
        { page: 'abc' },
        SALES_SUMMARY_SCHEMA,
      );
      // NaN is not finite, so it stays as-is
      expect(result.page).toBe('abc');
    });

    it('preserves null values', () => {
      const result = sanitizeToolInput(
        { dateFrom: null, page: 1 },
        SALES_SUMMARY_SCHEMA,
      );
      expect(result.dateFrom).toBeNull();
      expect(result.page).toBe(1);
    });
  });
});
