/**
 * Tool Input Validator — runtime validation for AI tool arguments.
 *
 * Validates tool input against declared inputSchema before execution.
 * Returns structured error messages for invalid inputs.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Validate tool input against its inputSchema.
 *
 * @param input - The tool arguments from LLM
 * @param schema - The tool's inputSchema definition
 * @param toolName - Tool name for error messages
 * @returns ValidationResult with valid flag and any errors
 */
export function validateToolInput(
  input: Record<string, unknown> | undefined | null,
  schema: Record<string, unknown>,
  toolName: string,
): ValidationResult {
  const errors: string[] = [];

  // 1. Object validation
  if (input === null || input === undefined) {
    return { valid: true, errors: [] }; // All fields optional, empty input is valid
  }

  if (typeof input !== 'object' || Array.isArray(input)) {
    return {
      valid: false,
      errors: [`Tool "${toolName}": arguments must be an object`],
    };
  }

  // 2. Validate known properties from schema
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties) {
    return { valid: true, errors: [] }; // No properties defined, accept anything
  }

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) {
      continue; // null/undefined values are acceptable (optional fields)
    }

    const propSchema = properties[key];
    if (!propSchema) {
      // Unknown field — reject for security
      errors.push(`Tool "${toolName}": unknown field "${key}"`);
      continue;
    }

    const propType = propSchema.type as string | undefined;

    // Type validation
    if (propType === 'string' && typeof value !== 'string') {
      errors.push(`Tool "${toolName}": "${key}" must be a string`);
      continue;
    }

    if (propType === 'number') {
      if (typeof value !== 'number') {
        errors.push(`Tool "${toolName}": "${key}" must be a number`);
        continue;
      }
      if (!Number.isFinite(value)) {
        errors.push(`Tool "${toolName}": "${key}" must be a finite number`);
        continue;
      }
      if (value < 0) {
        errors.push(`Tool "${toolName}": "${key}" must not be negative`);
        continue;
      }
    }

    if (propType === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Tool "${toolName}": "${key}" must be a boolean`);
      continue;
    }

    // Format validation for specific fields
    if (propType === 'string' && typeof value === 'string') {
      // UUID validation for warehouseId
      if (key === 'warehouseId' && !UUID_REGEX.test(value)) {
        errors.push(`Tool "${toolName}": "${key}" must be a valid UUID`);
        continue;
      }

      // Date validation for dateFrom/dateTo
      if ((key === 'dateFrom' || key === 'dateTo') && !ISO_DATE_REGEX.test(value)) {
        errors.push(`Tool "${toolName}": "${key}" must be a valid ISO date (YYYY-MM-DD)`);
        continue;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize tool input by converting numeric strings to numbers.
 * This handles the common case where LLM sends "10" instead of 10.
 */
export function sanitizeToolInput(
  input: Record<string, unknown> | undefined | null,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties) {
    return input;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) {
      sanitized[key] = value;
      continue;
    }

    const propSchema = properties[key];
    if (!propSchema) {
      continue; // Skip unknown fields
    }

    const propType = propSchema.type as string | undefined;

    // Convert string numbers to actual numbers
    if (propType === 'number' && typeof value === 'string') {
      const num = Number(value);
      if (Number.isFinite(num)) {
        sanitized[key] = num;
      } else {
        sanitized[key] = value; // Keep as-is, validation will catch it
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
