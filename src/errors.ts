import { CanvasApiError } from './api/client.js';

export interface StructuredError {
  status: 'error';
  code: string;
  message: string;
  retryable: boolean;
  suggestion: string;
}

export function formatError(error: unknown, toolName: string): StructuredError {
  if (error instanceof CanvasApiError) {
    switch (error.statusCode) {
      case 401:
        return {
          status: 'error',
          code: 'unauthorized',
          message: 'Invalid or expired Canvas API token.',
          retryable: false,
          suggestion:
            'Generate a new token at Canvas → Settings → Approved Integrations → + New Access Token.',
        };
      case 403:
        return {
          status: 'error',
          code: 'forbidden',
          message: `Access denied for ${toolName}. You may not have permission for this resource.`,
          retryable: false,
          suggestion:
            'Check that your Canvas role has access to this resource. Some endpoints require instructor or admin permissions.',
        };
      case 404:
        return {
          status: 'error',
          code: 'not_found',
          message: `Resource not found for ${toolName}.`,
          retryable: false,
          suggestion:
            'Verify the IDs are correct. The course, assignment, or resource may have been deleted or you may not be enrolled.',
        };
      case 422:
        return {
          status: 'error',
          code: 'validation_error',
          message: `Invalid request parameters for ${toolName}: ${error.body}`,
          retryable: false,
          suggestion: 'Check the parameter values and try again.',
        };
      case 429:
        return {
          status: 'error',
          code: 'rate_limit',
          message: 'Canvas API rate limit exceeded.',
          retryable: true,
          suggestion: 'Wait a moment and try again. The server automatically retries on rate limits.',
        };
      default:
        if (error.statusCode >= 500) {
          return {
            status: 'error',
            code: 'canvas_server_error',
            message: `Canvas server error (${error.statusCode}): ${error.statusText}`,
            retryable: true,
            suggestion: 'Canvas may be experiencing issues. Try again in a few moments.',
          };
        }
        return {
          status: 'error',
          code: 'canvas_api_error',
          message: `Canvas API error ${error.statusCode}: ${error.statusText}`,
          retryable: false,
          suggestion: 'Check the Canvas API documentation for this endpoint.',
        };
    }
  }

  if (error instanceof TypeError && (error as Error).message.includes('fetch')) {
    return {
      status: 'error',
      code: 'network_error',
      message: 'Network error connecting to Canvas.',
      retryable: true,
      suggestion:
        'Check your internet connection and verify CANVAS_BASE_URL is correct.',
    };
  }

  return {
    status: 'error',
    code: 'unknown_error',
    message: (error as Error).message ?? 'An unknown error occurred.',
    retryable: false,
    suggestion: 'Check the error message and try again.',
  };
}
