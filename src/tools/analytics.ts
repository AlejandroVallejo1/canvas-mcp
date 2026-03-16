import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';

interface CanvasStudentSummary {
  id: number;
  page_views: number;
  max_page_views: number;
  page_views_level: number;
  participations: number;
  max_participations: number;
  participations_level: number;
  tardiness_breakdown: {
    total: number;
    on_time: number;
    late: number;
    missing: number;
    floating: number;
  };
}

interface CanvasAssignmentAnalytics {
  assignment_id: number;
  title: string;
  due_at: string | null;
  points_possible: number;
  max_score: number;
  min_score: number;
  first_quartile: number;
  median: number;
  third_quartile: number;
  submission?: {
    posted_at: string;
    score: number;
    submitted_at: string;
  };
}

interface CanvasStudentAnalytics {
  page_views: Record<string, number>;
  participations: Array<{
    created_at: string;
    url: string;
  }>;
}

export function registerAnalyticsTools(
  server: McpServer,
  client: CanvasClient,
) {
  server.tool(
    'canvas_get_course_analytics_summary',
    'Get analytics summary for a course: participation data, page views, and assignment statistics for the current student.',
    {
      course_id: z.number().describe('The Canvas course ID'),
    },
    async ({ course_id }) => {
      try {
        const self = await client.get<{ id: number }>('/users/self', {});

        const studentData = await client.get<CanvasStudentAnalytics>(
          `/courses/${course_id}/analytics/users/${self.id}/activity`,
          {},
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  page_views_by_date: studentData.page_views,
                  recent_participations: studentData.participations
                    ?.slice(0, 20)
                    .map((p) => ({
                      date: p.created_at,
                      url: p.url,
                    })),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Analytics not available for this course. Your institution may not have analytics enabled.',
            },
          ],
        };
      }
    },
  );

  server.tool(
    'canvas_get_assignment_statistics',
    'Get score statistics for assignments in a course: min, max, median, quartiles.',
    {
      course_id: z.number().describe('The Canvas course ID'),
    },
    async ({ course_id }) => {
      try {
        const self = await client.get<{ id: number }>('/users/self', {});

        const assignments = await client.get<CanvasAssignmentAnalytics[]>(
          `/courses/${course_id}/analytics/users/${self.id}/assignments`,
          {},
        );

        const formatted = assignments.map((a) => ({
          assignment_id: a.assignment_id,
          title: a.title,
          due_at: a.due_at,
          points_possible: a.points_possible,
          class_stats: {
            min: a.min_score,
            max: a.max_score,
            median: a.median,
            first_quartile: a.first_quartile,
            third_quartile: a.third_quartile,
          },
          your_score: a.submission?.score ?? null,
          your_submitted_at: a.submission?.submitted_at ?? null,
        }));

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(formatted, null, 2),
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Assignment statistics not available. Your institution may not have analytics enabled, or you may not have access.',
            },
          ],
        };
      }
    },
  );

  server.tool(
    'canvas_get_course_participation',
    'Get student participation summary for a course: page views, participations, and tardiness breakdown.',
    {
      course_id: z.number().describe('The Canvas course ID'),
    },
    async ({ course_id }) => {
      try {
        const summaries = await client.get<CanvasStudentSummary[]>(
          `/courses/${course_id}/analytics/student_summaries`,
          { sort_column: 'participations' },
        );

        // Find current user in the list
        const self = await client.get<{ id: number }>('/users/self', {});
        const myData = summaries.find((s) => s.id === self.id);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  your_summary: myData
                    ? {
                        page_views: myData.page_views,
                        participations: myData.participations,
                        tardiness: myData.tardiness_breakdown,
                      }
                    : 'Not found in analytics data',
                  class_size: summaries.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Course participation analytics not available.',
            },
          ],
        };
      }
    },
  );
}
