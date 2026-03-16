import { describe, it, expect } from 'vitest';
import { formatError } from '../src/errors.js';
import { CanvasApiError } from '../src/api/client.js';

describe('formatError', () => {
  it('should format 401 as unauthorized', () => {
    const error = new CanvasApiError(401, 'Unauthorized', '{}');
    const result = formatError(error, 'canvas_list_courses');
    expect(result.code).toBe('unauthorized');
    expect(result.retryable).toBe(false);
    expect(result.suggestion).toContain('token');
  });

  it('should format 403 as forbidden', () => {
    const error = new CanvasApiError(403, 'Forbidden', '{}');
    const result = formatError(error, 'canvas_get_course');
    expect(result.code).toBe('forbidden');
    expect(result.retryable).toBe(false);
    expect(result.message).toContain('canvas_get_course');
  });

  it('should format 404 as not_found', () => {
    const error = new CanvasApiError(404, 'Not Found', '{}');
    const result = formatError(error, 'canvas_get_assignment');
    expect(result.code).toBe('not_found');
    expect(result.retryable).toBe(false);
  });

  it('should format 422 as validation_error', () => {
    const error = new CanvasApiError(
      422,
      'Unprocessable Entity',
      '{"errors":{"name":"is required"}}',
    );
    const result = formatError(error, 'canvas_submit_assignment');
    expect(result.code).toBe('validation_error');
    expect(result.retryable).toBe(false);
  });

  it('should format 429 as rate_limit', () => {
    const error = new CanvasApiError(429, 'Too Many Requests', '{}');
    const result = formatError(error, 'canvas_list_assignments');
    expect(result.code).toBe('rate_limit');
    expect(result.retryable).toBe(true);
  });

  it('should format 500+ as canvas_server_error', () => {
    const error = new CanvasApiError(502, 'Bad Gateway', '{}');
    const result = formatError(error, 'canvas_get_grades');
    expect(result.code).toBe('canvas_server_error');
    expect(result.retryable).toBe(true);
  });

  it('should format unknown errors gracefully', () => {
    const error = new Error('Something went wrong');
    const result = formatError(error, 'canvas_list_courses');
    expect(result.code).toBe('unknown_error');
    expect(result.message).toBe('Something went wrong');
  });

  it('should always return status: error', () => {
    const error = new Error('test');
    const result = formatError(error, 'test_tool');
    expect(result.status).toBe('error');
  });
});
