import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import { CanvasPage } from '../types/canvas.js';

export function registerPageTools(server: McpServer, client: CanvasClient) {
  server.tool(
    'canvas_list_pages',
    'List all wiki pages in a course.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      sort: z
        .enum(['title', 'created_at', 'updated_at'])
        .optional()
        .describe('Sort pages by field'),
      published: z
        .boolean()
        .optional()
        .describe('Filter by published status'),
    },
    async ({ course_id, sort, published }) => {
      const params: Record<string, string | boolean> = {};
      if (sort) params['sort'] = sort;
      if (published !== undefined) params['published'] = published;

      const pages = await client.paginate<CanvasPage>(
        `/courses/${course_id}/pages`,
        params,
      );

      const formatted = pages.map((p) => ({
        url: p.url,
        title: p.title,
        created_at: p.created_at,
        updated_at: p.updated_at,
        published: p.published,
        front_page: p.front_page,
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
    'canvas_get_page',
    'Get the full content of a wiki page rendered as text.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      page_url: z
        .string()
        .describe('The page URL slug (from canvas_list_pages)'),
    },
    async ({ course_id, page_url }) => {
      const page = await client.get<CanvasPage>(
        `/courses/${course_id}/pages/${encodeURIComponent(page_url)}`,
        {},
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                title: page.title,
                url: page.url,
                created_at: page.created_at,
                updated_at: page.updated_at,
                published: page.published,
                body: page.body ? stripHtml(page.body) : 'Empty page',
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
