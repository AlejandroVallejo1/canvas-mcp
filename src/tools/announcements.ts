import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import { CanvasAnnouncement, CanvasCourse } from '../types/canvas.js';

export function registerAnnouncementTools(
  server: McpServer,
  client: CanvasClient,
) {
  server.tool(
    'canvas_list_announcements',
    'List announcements for a specific course or across all active courses.',
    {
      course_id: z
        .number()
        .optional()
        .describe(
          'Specific course ID. If omitted, lists announcements across all active courses.',
        ),
      only_unread: z
        .boolean()
        .optional()
        .describe('Only return unread announcements'),
    },
    async ({ course_id, only_unread }) => {
      let contextCodes: string[];

      if (course_id) {
        contextCodes = [`course_${course_id}`];
      } else {
        const courses = await client.paginate<CanvasCourse>('/courses', {
          enrollment_state: 'active',
          state: ['available'],
        });
        contextCodes = courses.map((c) => `course_${c.id}`);
      }

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

      const announcements = await client.paginate<CanvasAnnouncement>(
        '/announcements',
        {
          context_codes: contextCodes,
        },
      );

      let filtered = announcements;
      if (only_unread) {
        filtered = announcements.filter((a) => a.read_state !== 'read');
      }

      const formatted = filtered.map((a) => ({
        id: a.id,
        title: a.title,
        course: a.context_code,
        posted_at: a.posted_at,
        author: a.author?.display_name ?? 'Unknown',
        message: stripHtml(a.message).substring(0, 500),
        read_state: a.read_state,
        has_attachments: (a.attachments?.length ?? 0) > 0,
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
    'canvas_get_announcement',
    'Get the full content of a specific announcement including attachments.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      announcement_id: z.number().describe('The announcement/topic ID'),
    },
    async ({ course_id, announcement_id }) => {
      const announcement = await client.get<CanvasAnnouncement>(
        `/courses/${course_id}/discussion_topics/${announcement_id}`,
        {},
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: announcement.id,
                title: announcement.title,
                posted_at: announcement.posted_at,
                author: announcement.author?.display_name ?? 'Unknown',
                message: stripHtml(announcement.message),
                attachments: announcement.attachments?.map((a) => ({
                  id: a.id,
                  filename: a.display_name,
                  size: a.size,
                  content_type: a['content-type'],
                  url: a.url,
                })),
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
