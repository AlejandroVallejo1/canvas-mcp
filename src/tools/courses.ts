import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import {
  CanvasCourse,
  CanvasSection,
  CanvasEnrollment,
} from '../types/canvas.js';

export function registerCourseTools(server: McpServer, client: CanvasClient) {
  server.tool(
    'canvas_list_courses',
    'List all courses the user is enrolled in. Returns course names, codes, term info, and enrollment type.',
    {
      enrollment_state: z
        .enum(['active', 'completed', 'invited'])
        .optional()
        .describe('Filter by enrollment state. Defaults to active.'),
      include_total_students: z
        .boolean()
        .optional()
        .describe('Include total student count per course'),
    },
    async ({ enrollment_state, include_total_students }) => {
      const include: string[] = [
        'term',
        'teachers',
        'total_scores',
        'enrollments',
      ];
      if (include_total_students) include.push('total_students');

      const courses = await client.paginate<CanvasCourse>('/courses', {
        enrollment_state: enrollment_state ?? 'active',
        include,
        state: ['available', 'completed'],
      });

      const formatted = courses.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.course_code,
        term: c.term?.name ?? 'N/A',
        enrollment:
          c.enrollments?.map((e) => e.type).join(', ') ?? 'unknown',
        start: c.start_at,
        end: c.end_at,
        teachers: c.teachers?.map((t) => t.name).join(', ') ?? 'N/A',
        total_students: c.total_students,
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
    'canvas_get_course',
    'Get detailed information about a specific course including syllabus, description, instructor info, and dates.',
    {
      course_id: z.number().describe('The Canvas course ID'),
    },
    async ({ course_id }) => {
      const course = await client.get<CanvasCourse>(
        `/courses/${course_id}`,
        {
          include: [
            'syllabus_body',
            'term',
            'teachers',
            'total_students',
            'enrollments',
          ],
        },
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: course.id,
                name: course.name,
                code: course.course_code,
                term: course.term?.name ?? 'N/A',
                start: course.start_at,
                end: course.end_at,
                teachers:
                  course.teachers?.map((t) => t.name).join(', ') ?? 'N/A',
                total_students: course.total_students,
                syllabus: course.syllabus_body
                  ? stripHtml(course.syllabus_body)
                  : 'No syllabus available',
                default_view: course.default_view,
                time_zone: course.time_zone,
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
    'canvas_list_sections',
    'List all sections in a course.',
    {
      course_id: z.number().describe('The Canvas course ID'),
    },
    async ({ course_id }) => {
      const sections = await client.paginate<CanvasSection>(
        `/courses/${course_id}/sections`,
        { include: ['total_students'] },
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(sections, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'canvas_list_enrollments',
    'List enrollments in a course, optionally filtered by type (student, teacher, ta).',
    {
      course_id: z.number().describe('The Canvas course ID'),
      type: z
        .enum([
          'StudentEnrollment',
          'TeacherEnrollment',
          'TaEnrollment',
          'ObserverEnrollment',
        ])
        .optional()
        .describe('Filter by enrollment type'),
    },
    async ({ course_id, type }) => {
      const params: Record<string, string | string[]> = {};
      if (type) params['type'] = [type];

      const enrollments = await client.paginate<CanvasEnrollment>(
        `/courses/${course_id}/enrollments`,
        params,
      );

      const formatted = enrollments.map((e) => ({
        user_id: e.user_id,
        name: e.user?.name,
        role: e.role,
        state: e.enrollment_state,
        current_score: e.grades?.current_score,
        current_grade: e.grades?.current_grade,
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
