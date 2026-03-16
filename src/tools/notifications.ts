import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import {
  CanvasActivityStreamItem,
  CanvasTodoItem,
} from '../types/canvas.js';

export function registerNotificationTools(
  server: McpServer,
  client: CanvasClient,
) {
  server.tool(
    'canvas_get_activity_stream',
    'Get recent activity stream items (notifications) across all courses.',
    {
      only_unread: z
        .boolean()
        .optional()
        .describe('Only return unread items'),
    },
    async ({ only_unread }) => {
      const items = await client.paginate<CanvasActivityStreamItem>(
        '/users/self/activity_stream',
        {},
      );

      let filtered = items;
      if (only_unread) {
        filtered = items.filter((i) => !i.read_state);
      }

      const formatted = filtered.map((i) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        message: i.message
          ? stripHtml(i.message).substring(0, 300)
          : null,
        context_type: i.context_type,
        course_id: i.course_id,
        created_at: i.created_at,
        read: i.read_state,
        html_url: i.html_url,
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'canvas_get_todo_items',
    'Get to-do items that need attention: ungraded submissions, upcoming assignments, etc.',
    {},
    async () => {
      const todos = await client.get<CanvasTodoItem[]>(
        '/users/self/todo',
        {},
      );

      const formatted = todos.map((t) => ({
        type: t.type,
        context_type: t.context_type,
        course_id: t.course_id,
        assignment: t.assignment
          ? {
              id: t.assignment.id,
              name: t.assignment.name,
              due_at: t.assignment.due_at,
              points_possible: t.assignment.points_possible,
              html_url: t.assignment.html_url,
            }
          : null,
        html_url: t.html_url,
        needs_grading_count: t.needs_grading_count,
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'canvas_get_unread_count',
    'Get counts of unread items: conversations, notifications, etc.',
    {},
    async () => {
      const unreadCount = await client.get<{ unread_count: number }>(
        '/conversations/unread_count',
        {},
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                unread_conversations: unreadCount.unread_count,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
