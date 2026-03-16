import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import { CanvasUser } from '../types/canvas.js';

export function registerPeopleTools(server: McpServer, client: CanvasClient) {
  server.tool(
    'canvas_list_course_users',
    'List all people in a course: students, TAs, and professors.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      enrollment_type: z
        .enum(['student', 'teacher', 'ta', 'observer', 'designer'])
        .optional()
        .describe('Filter by enrollment type'),
      search_term: z
        .string()
        .optional()
        .describe('Search users by name or email'),
    },
    async ({ course_id, enrollment_type, search_term }) => {
      const params: Record<string, string | string[]> = {
        include: ['email', 'enrollments', 'bio', 'avatar_url'],
      };

      if (enrollment_type) {
        params['enrollment_type'] = [enrollment_type];
      }
      if (search_term) {
        params['search_term'] = search_term;
      }

      const users = await client.paginate<CanvasUser>(
        `/courses/${course_id}/users`,
        params,
      );

      const formatted = users.map((u) => ({
        id: u.id,
        name: u.name,
        sortable_name: u.sortable_name,
        email: u.email ?? 'N/A',
        bio: u.bio,
        avatar_url: u.avatar_url,
        roles: u.enrollments?.map((e) => e.role) ?? [],
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
    'canvas_get_user_profile',
    'Get the profile of a specific user.',
    {
      user_id: z
        .number()
        .describe('The user ID. Use "self" concept by passing 0 to get your own profile.'),
    },
    async ({ user_id }) => {
      const path = user_id === 0 ? '/users/self/profile' : `/users/${user_id}/profile`;
      const user = await client.get<CanvasUser & { primary_email?: string; login_id?: string }>(
        path,
        {},
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: user.id,
                name: user.name,
                short_name: user.short_name,
                sortable_name: user.sortable_name,
                email: user.login_id ?? user.email ?? 'N/A',
                bio: user.bio,
                avatar_url: user.avatar_url,
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
    'canvas_get_self',
    'Get your own Canvas user profile and account information.',
    {},
    async () => {
      const user = await client.get<
        CanvasUser & { primary_email?: string; login_id?: string; locale?: string }
      >('/users/self', {});

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: user.id,
                name: user.name,
                short_name: user.short_name,
                sortable_name: user.sortable_name,
                email: user.login_id ?? user.email ?? 'N/A',
                bio: user.bio,
                avatar_url: user.avatar_url,
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
