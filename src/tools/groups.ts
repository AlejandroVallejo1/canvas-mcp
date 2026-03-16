import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';

interface CanvasGroup {
  id: number;
  name: string;
  description: string | null;
  members_count: number;
  context_type: string;
  course_id?: number;
  group_category_id: number;
  created_at: string;
}

interface CanvasGroupMember {
  id: number;
  name: string;
  sortable_name: string;
  short_name: string;
}

interface CanvasGroupCategory {
  id: number;
  name: string;
  role: string | null;
  group_limit: number | null;
  auto_leader: string | null;
  context_type: string;
  course_id?: number;
  groups_count: number;
}

export function registerGroupTools(server: McpServer, client: CanvasClient) {
  server.tool(
    'canvas_list_groups',
    'List all groups the current user belongs to, or all groups in a course.',
    {
      course_id: z
        .number()
        .optional()
        .describe('Course ID to list groups for. If omitted, lists user\'s groups.'),
    },
    async ({ course_id }) => {
      const path = course_id
        ? `/courses/${course_id}/groups`
        : '/users/self/groups';

      const groups = await client.paginate<CanvasGroup>(path, {});

      const formatted = groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        members_count: g.members_count,
        group_category_id: g.group_category_id,
        course_id: g.course_id,
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
    'canvas_get_group_members',
    'List all members of a specific group.',
    {
      group_id: z.number().describe('The group ID'),
    },
    async ({ group_id }) => {
      const members = await client.paginate<CanvasGroupMember>(
        `/groups/${group_id}/users`,
        {},
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              members.map((m) => ({
                id: m.id,
                name: m.name,
                sortable_name: m.sortable_name,
              })),
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'canvas_list_group_categories',
    'List group categories (sets) in a course. Group categories organize how students are grouped.',
    {
      course_id: z.number().describe('The Canvas course ID'),
    },
    async ({ course_id }) => {
      const categories = await client.paginate<CanvasGroupCategory>(
        `/courses/${course_id}/group_categories`,
        {},
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              categories.map((c) => ({
                id: c.id,
                name: c.name,
                role: c.role,
                groups_count: c.groups_count,
                group_limit: c.group_limit,
                auto_leader: c.auto_leader,
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
