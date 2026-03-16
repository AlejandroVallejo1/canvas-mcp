import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { formatError } from './errors.js';

export function wrapHandler<T extends Record<string, unknown>>(
  toolName: string,
  handler: (args: T) => Promise<CallToolResult>,
): (args: T) => Promise<CallToolResult> {
  return async (args: T) => {
    try {
      return await handler(args);
    } catch (error) {
      const structured = formatError(error, toolName);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(structured, null, 2),
          },
        ],
      };
    }
  };
}
