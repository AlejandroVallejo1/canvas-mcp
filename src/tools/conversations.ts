import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import {
  CanvasConversation,
  CanvasRecipient,
} from '../types/canvas.js';

export function registerConversationTools(
  server: McpServer,
  client: CanvasClient,
) {
  server.tool(
    'canvas_list_conversations',
    'List inbox conversations. Shows subject, last message preview, participants, and unread status.',
    {
      scope: z
        .enum(['inbox', 'unread', 'starred', 'sent', 'archived'])
        .optional()
        .describe('Filter conversations by scope. Defaults to inbox.'),
    },
    async ({ scope }) => {
      const conversations = await client.paginate<CanvasConversation>(
        '/conversations',
        {
          scope: scope ?? 'inbox',
        },
      );

      const formatted = conversations.map((c) => ({
        id: c.id,
        subject: c.subject,
        state: c.workflow_state,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
        message_count: c.message_count,
        participants: c.participants.map((p) => p.name),
        context: c.context_name,
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
    'canvas_get_conversation',
    'Read a full conversation thread with all messages.',
    {
      conversation_id: z.number().describe('The conversation ID'),
    },
    async ({ conversation_id }) => {
      const conversation = await client.get<CanvasConversation>(
        `/conversations/${conversation_id}`,
        {},
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: conversation.id,
                subject: conversation.subject,
                state: conversation.workflow_state,
                participants: conversation.participants.map((p) => ({
                  id: p.id,
                  name: p.name,
                })),
                messages: conversation.messages?.map((m) => ({
                  id: m.id,
                  author_id: m.author_id,
                  author:
                    conversation.participants.find(
                      (p) => p.id === m.author_id,
                    )?.name ?? 'Unknown',
                  body: m.body,
                  created_at: m.created_at,
                  attachments: m.attachments?.map((a) => ({
                    id: a.id,
                    filename: a.display_name,
                    url: a.url,
                  })),
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

  server.tool(
    'canvas_send_message',
    'Send a new message to one or more recipients.',
    {
      recipients: z
        .array(z.string())
        .describe(
          'Array of recipient IDs (user IDs as strings, or course/group context codes like "course_123")',
        ),
      subject: z.string().describe('Message subject'),
      body: z.string().describe('Message body (supports HTML)'),
      course_id: z
        .number()
        .optional()
        .describe('Optional course context for the message'),
    },
    async ({ recipients, subject, body, course_id }) => {
      const params: Record<string, unknown> = {
        recipients,
        subject,
        body,
      };

      if (course_id) {
        params['context_code'] = `course_${course_id}`;
      }

      const result = await client.post<CanvasConversation[]>(
        '/conversations',
        params,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                conversations_created: result.length,
                ids: result.map((c) => c.id),
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
    'canvas_reply_conversation',
    'Reply to an existing conversation thread.',
    {
      conversation_id: z.number().describe('The conversation ID'),
      body: z.string().describe('Reply message body'),
    },
    async ({ conversation_id, body }) => {
      const result = await client.post<CanvasConversation>(
        `/conversations/${conversation_id}/add_message`,
        { body },
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                conversation_id: result.id,
                message_count: result.message_count,
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
    'canvas_search_recipients',
    'Search for message recipients by name. Useful for finding people to message.',
    {
      search: z.string().describe('Search query (name or email)'),
      course_id: z
        .number()
        .optional()
        .describe('Limit search to a specific course'),
      type: z
        .enum(['user', 'context'])
        .optional()
        .describe('Type of recipient to search for'),
    },
    async ({ search, course_id, type }) => {
      const params: Record<string, string> = { search };
      if (course_id) params['context'] = `course_${course_id}`;
      if (type) params['type'] = type;

      const recipients = await client.get<CanvasRecipient[]>(
        '/search/recipients',
        params,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              recipients.map((r) => ({
                id: r.id,
                name: r.name,
                full_name: r.full_name,
                common_courses: r.common_courses,
              })),
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
