import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import {
  CanvasDiscussionTopic,
  CanvasDiscussionEntry,
} from '../types/canvas.js';

export function registerDiscussionTools(
  server: McpServer,
  client: CanvasClient,
) {
  server.tool(
    'canvas_list_discussions',
    'List discussion topics in a course.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      only_unread: z
        .boolean()
        .optional()
        .describe('Only return discussions with unread entries'),
    },
    async ({ course_id, only_unread }) => {
      const discussions = await client.paginate<CanvasDiscussionTopic>(
        `/courses/${course_id}/discussion_topics`,
        {
          order_by: 'recent_activity',
        },
      );

      let filtered = discussions;
      if (only_unread) {
        filtered = discussions.filter((d) => d.unread_count > 0);
      }

      const formatted = filtered.map((d) => ({
        id: d.id,
        title: d.title,
        author: d.author?.display_name ?? 'Unknown',
        posted_at: d.posted_at,
        last_reply_at: d.last_reply_at,
        reply_count: d.discussion_subentry_count,
        unread_count: d.unread_count,
        read_state: d.read_state,
        published: d.published,
        assignment_id: d.assignment_id,
        html_url: d.html_url,
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
    'canvas_get_discussion',
    'Get a discussion topic with its entries and replies.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      topic_id: z.number().describe('The discussion topic ID'),
    },
    async ({ course_id, topic_id }) => {
      const topic = await client.get<CanvasDiscussionTopic>(
        `/courses/${course_id}/discussion_topics/${topic_id}`,
        {},
      );

      // Get the full view with all entries
      const fullView = await client.get<{
        participants: Array<{ id: number; display_name: string }>;
        unread_entries: number[];
        view: CanvasDiscussionEntry[];
      }>(
        `/courses/${course_id}/discussion_topics/${topic_id}/view`,
        {},
      );

      const participantMap = new Map(
        fullView.participants.map((p) => [p.id, p.display_name]),
      );

      const formatEntries = (
        entries: CanvasDiscussionEntry[],
      ): Array<Record<string, unknown>> => {
        return entries.map((e) => ({
          id: e.id,
          author: participantMap.get(e.user_id) ?? e.user_name ?? 'Unknown',
          message: stripHtml(e.message),
          created_at: e.created_at,
          read_state: e.read_state,
          replies: e.recent_replies
            ? formatEntries(e.recent_replies)
            : [],
        }));
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: topic.id,
                title: topic.title,
                author: topic.author?.display_name ?? 'Unknown',
                message: stripHtml(topic.message),
                posted_at: topic.posted_at,
                reply_count: topic.discussion_subentry_count,
                unread_count: topic.unread_count,
                entries: formatEntries(fullView.view ?? []),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'canvas_post_discussion_reply',
    'Post a reply to a discussion topic or to a specific entry.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      topic_id: z.number().describe('The discussion topic ID'),
      message: z.string().describe('The reply message (supports HTML)'),
      entry_id: z
        .number()
        .optional()
        .describe(
          'Optional: Reply to a specific entry. If omitted, replies to the main topic.',
        ),
    },
    async ({ course_id, topic_id, message, entry_id }) => {
      let path: string;
      if (entry_id) {
        path = `/courses/${course_id}/discussion_topics/${topic_id}/entries/${entry_id}/replies`;
      } else {
        path = `/courses/${course_id}/discussion_topics/${topic_id}/entries`;
      }

      const result = await client.post<CanvasDiscussionEntry>(path, {
        message,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                entry_id: result.id,
                created_at: result.created_at,
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
