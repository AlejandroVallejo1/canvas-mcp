import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import { CanvasModuleItem, CanvasPage, CanvasFile, CanvasAssignment } from '../types/canvas.js';

export function registerResourceTools(
  server: McpServer,
  client: CanvasClient,
) {
  server.tool(
    'canvas_fetch_external_url',
    'Fetch and return the text content of an external URL referenced in a course. Useful for following links in assignments, module items, or announcements. Only fetches text-based content.',
    {
      url: z.string().describe('The URL to fetch content from'),
    },
    async ({ url }) => {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'CanvasMCP/1.0',
            Accept: 'text/html,text/plain,application/json,application/xml',
          },
          redirect: 'follow',
        });

        if (!response.ok) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Failed to fetch URL: ${response.status} ${response.statusText}`,
              },
            ],
          };
        }

        const contentType = response.headers.get('content-type') ?? '';

        if (
          contentType.includes('text/') ||
          contentType.includes('json') ||
          contentType.includes('xml')
        ) {
          const text = await response.text();
          const cleaned = contentType.includes('html')
            ? stripHtml(text)
            : text;

          // Truncate very long content
          const maxLength = 50000;
          const truncated = cleaned.length > maxLength
            ? cleaned.substring(0, maxLength) + '\n\n[Content truncated...]'
            : cleaned;

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    url,
                    content_type: contentType,
                    content: truncated,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  url,
                  content_type: contentType,
                  content: `[Binary content: ${contentType}. Cannot display in text format.]`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error fetching URL: ${(error as Error).message}`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    'canvas_get_module_item_content',
    'Get the full content of a module item by resolving its type. Automatically fetches the linked page, assignment, file, or external URL content.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      module_id: z.number().describe('The module ID'),
      item_id: z.number().describe('The module item ID'),
    },
    async ({ course_id, module_id, item_id }) => {
      const item = await client.get<CanvasModuleItem>(
        `/courses/${course_id}/modules/${module_id}/items/${item_id}`,
        { include: ['content_details'] },
      );

      const result: Record<string, unknown> = {
        title: item.title,
        type: item.type,
      };

      switch (item.type) {
        case 'Page': {
          if (item.page_url) {
            const page = await client.get<CanvasPage>(
              `/courses/${course_id}/pages/${item.page_url}`,
              {},
            );
            result['content'] = page.body ? stripHtml(page.body) : 'Empty page';
          }
          break;
        }
        case 'Assignment': {
          if (item.content_id) {
            const assignment = await client.get<CanvasAssignment>(
              `/courses/${course_id}/assignments/${item.content_id}`,
              { include: ['submission'] },
            );
            result['content'] = assignment.description
              ? stripHtml(assignment.description)
              : 'No description';
            result['due_at'] = assignment.due_at;
            result['points_possible'] = assignment.points_possible;
            result['submission_types'] = assignment.submission_types;
            result['submission_status'] = assignment.submission?.workflow_state;
          }
          break;
        }
        case 'File': {
          if (item.content_id) {
            const file = await client.get<CanvasFile>(
              `/files/${item.content_id}`,
              {},
            );
            result['file'] = {
              name: file.display_name,
              size: file.size,
              content_type: file['content-type'],
              url: file.url,
            };

            // Auto-download text-based files
            if (
              file['content-type']?.startsWith('text/') ||
              file['content-type']?.includes('json') ||
              file['content-type']?.includes('csv')
            ) {
              try {
                const downloaded = await client.downloadFile(file.url);
                result['file_content'] = downloaded.content;
              } catch {
                result['file_content'] = '[Could not download file content]';
              }
            }
          }
          break;
        }
        case 'ExternalUrl': {
          result['external_url'] = item.external_url;
          if (item.external_url) {
            try {
              const response = await fetch(item.external_url, {
                headers: { 'User-Agent': 'CanvasMCP/1.0' },
                redirect: 'follow',
              });
              if (response.ok) {
                const ct = response.headers.get('content-type') ?? '';
                if (ct.includes('text/') || ct.includes('json')) {
                  const text = await response.text();
                  result['external_content'] = ct.includes('html')
                    ? stripHtml(text).substring(0, 20000)
                    : text.substring(0, 20000);
                }
              }
            } catch {
              result['external_content'] = '[Could not fetch external URL]';
            }
          }
          break;
        }
        case 'ExternalTool': {
          result['external_url'] = item.external_url;
          result['note'] = 'External tools (LTI) cannot be accessed through the API. Visit the html_url to interact with this tool.';
          result['html_url'] = item.html_url;
          break;
        }
        default: {
          result['html_url'] = item.html_url;
          break;
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'canvas_get_full_module_content',
    'Get the complete content of ALL items in a module. Resolves pages, assignments, and files to their actual content. Useful for reading through an entire module at once.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      module_id: z.number().describe('The module ID'),
    },
    async ({ course_id, module_id }) => {
      const items = await client.paginate<CanvasModuleItem>(
        `/courses/${course_id}/modules/${module_id}/items`,
        { include: ['content_details'] },
      );

      const resolvedItems: Array<Record<string, unknown>> = [];

      for (const item of items) {
        const resolved: Record<string, unknown> = {
          title: item.title,
          type: item.type,
          position: item.position,
        };

        try {
          switch (item.type) {
            case 'Page': {
              if (item.page_url) {
                const page = await client.get<CanvasPage>(
                  `/courses/${course_id}/pages/${item.page_url}`,
                  {},
                );
                resolved['content'] = page.body
                  ? stripHtml(page.body)
                  : 'Empty page';
              }
              break;
            }
            case 'Assignment': {
              if (item.content_id) {
                const assignment = await client.get<CanvasAssignment>(
                  `/courses/${course_id}/assignments/${item.content_id}`,
                  {},
                );
                resolved['content'] = assignment.description
                  ? stripHtml(assignment.description)
                  : 'No description';
                resolved['due_at'] = assignment.due_at;
                resolved['points_possible'] = assignment.points_possible;
              }
              break;
            }
            case 'File': {
              if (item.content_id) {
                const file = await client.get<CanvasFile>(
                  `/files/${item.content_id}`,
                  {},
                );
                resolved['file_name'] = file.display_name;
                resolved['file_type'] = file['content-type'];
                resolved['file_url'] = file.url;
              }
              break;
            }
            case 'ExternalUrl': {
              resolved['url'] = item.external_url;
              break;
            }
            case 'SubHeader': {
              // Section header, no content to resolve
              break;
            }
            default: {
              resolved['html_url'] = item.html_url;
              break;
            }
          }
        } catch {
          resolved['error'] = 'Could not resolve content';
        }

        resolved['completion'] = item.completion_requirement
          ? {
              type: item.completion_requirement.type,
              completed: item.completion_requirement.completed,
            }
          : null;

        resolvedItems.push(resolved);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(resolvedItems, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'canvas_extract_links_from_content',
    'Extract all URLs/links from an assignment description, page, or announcement. Useful for finding embedded resources.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      content_type: z
        .enum(['assignment', 'page', 'announcement'])
        .describe('Type of content to extract links from'),
      content_id: z
        .string()
        .describe('The content ID (assignment_id, page_url, or announcement_id)'),
    },
    async ({ course_id, content_type, content_id }) => {
      let html = '';

      switch (content_type) {
        case 'assignment': {
          const assignment = await client.get<CanvasAssignment>(
            `/courses/${course_id}/assignments/${content_id}`,
            {},
          );
          html = assignment.description ?? '';
          break;
        }
        case 'page': {
          const page = await client.get<CanvasPage>(
            `/courses/${course_id}/pages/${encodeURIComponent(content_id)}`,
            {},
          );
          html = page.body ?? '';
          break;
        }
        case 'announcement': {
          const announcement = await client.get<{ message: string }>(
            `/courses/${course_id}/discussion_topics/${content_id}`,
            {},
          );
          html = announcement.message ?? '';
          break;
        }
      }

      // Extract URLs from href and src attributes
      const urlPattern = /(?:href|src)=["']([^"']+)["']/gi;
      const urls: string[] = [];
      let match;

      while ((match = urlPattern.exec(html)) !== null) {
        if (match[1] && !match[1].startsWith('#') && !match[1].startsWith('javascript:')) {
          urls.push(match[1]);
        }
      }

      // Also extract plain URLs from text
      const plainUrlPattern = /https?:\/\/[^\s<>"']+/gi;
      const plainText = stripHtml(html);
      let plainMatch;
      while ((plainMatch = plainUrlPattern.exec(plainText)) !== null) {
        if (plainMatch[0] && !urls.includes(plainMatch[0])) {
          urls.push(plainMatch[0]);
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                content_type,
                content_id,
                links_found: urls.length,
                links: urls,
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
