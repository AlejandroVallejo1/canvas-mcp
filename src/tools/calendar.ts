import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import { CanvasCalendarEvent, CanvasCourse } from '../types/canvas.js';

export function registerCalendarTools(
  server: McpServer,
  client: CanvasClient,
) {
  server.tool(
    'canvas_list_calendar_events',
    'List calendar events across all courses or for a specific course. Includes assignments and events.',
    {
      course_id: z
        .number()
        .optional()
        .describe(
          'Specific course ID. If omitted, returns events across all courses.',
        ),
      start_date: z
        .string()
        .optional()
        .describe('Start date filter (ISO 8601 format, e.g. 2024-01-01)'),
      end_date: z
        .string()
        .optional()
        .describe('End date filter (ISO 8601 format, e.g. 2024-12-31)'),
      type: z
        .enum(['event', 'assignment'])
        .optional()
        .describe('Filter by event type'),
    },
    async ({ course_id, start_date, end_date, type }) => {
      const params: Record<string, string | string[]> = {};

      if (course_id) {
        params['context_codes'] = [`course_${course_id}`];
      } else {
        const courses = await client.paginate<CanvasCourse>('/courses', {
          enrollment_state: 'active',
          state: ['available'],
        });
        params['context_codes'] = courses.map((c) => `course_${c.id}`);
      }

      if (start_date) params['start_date'] = start_date;
      if (end_date) params['end_date'] = end_date;
      if (type) params['type'] = type;
      params['all_events'] = 'true';

      const events = await client.paginate<CanvasCalendarEvent>(
        '/calendar_events',
        params,
      );

      const formatted = events.map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        start_at: e.start_at,
        end_at: e.end_at,
        all_day: e.all_day,
        context: e.context_code,
        description: e.description
          ? stripHtml(e.description).substring(0, 300)
          : null,
        html_url: e.html_url,
        assignment_id: e.assignment?.id,
      }));

      // Sort by start date
      formatted.sort((a, b) => {
        if (!a.start_at) return 1;
        if (!b.start_at) return -1;
        return (
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
        );
      });

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
    'canvas_get_upcoming_deadlines',
    'Get all upcoming assignment deadlines and events in the next N days, sorted by date.',
    {
      days_ahead: z
        .number()
        .optional()
        .describe('Number of days to look ahead. Defaults to 7.'),
    },
    async ({ days_ahead }) => {
      const lookAhead = days_ahead ?? 7;
      const now = new Date();
      const endDate = new Date(
        now.getTime() + lookAhead * 24 * 60 * 60 * 1000,
      );

      const courses = await client.paginate<CanvasCourse>('/courses', {
        enrollment_state: 'active',
        state: ['available'],
      });

      const contextCodes = courses.map((c) => `course_${c.id}`);
      if (contextCodes.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No active courses found.',
            },
          ],
        };
      }

      const events = await client.paginate<CanvasCalendarEvent>(
        '/calendar_events',
        {
          context_codes: contextCodes,
          start_date: now.toISOString(),
          end_date: endDate.toISOString(),
          type: 'assignment',
        },
      );

      const courseMap = new Map(courses.map((c) => [c.id, c.name]));

      const formatted = events.map((e) => {
        const courseId = parseInt(
          e.context_code.replace('course_', ''),
          10,
        );
        return {
          title: e.title,
          course: courseMap.get(courseId) ?? e.context_code,
          due_at: e.start_at,
          type: e.type,
          html_url: e.html_url,
        };
      });

      formatted.sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      });

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
