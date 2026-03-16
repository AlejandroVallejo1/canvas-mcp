import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import {
  CanvasAssignment,
  CanvasSubmission,
  CanvasCourse,
} from '../types/canvas.js';

export function registerAssignmentTools(
  server: McpServer,
  client: CanvasClient,
) {
  server.tool(
    'canvas_list_assignments',
    'List all assignments in a course with due dates, points, and submission status.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      order_by: z
        .enum(['due_at', 'name', 'position'])
        .optional()
        .describe('Sort order for assignments'),
      bucket: z
        .enum(['past', 'overdue', 'undated', 'ungraded', 'unsubmitted', 'upcoming', 'future'])
        .optional()
        .describe('Filter assignments by bucket'),
    },
    async ({ course_id, order_by, bucket }) => {
      const params: Record<string, string | string[]> = {
        include: ['submission', 'score_statistics'],
      };
      if (order_by) params['order_by'] = order_by;
      if (bucket) params['bucket'] = bucket;

      const assignments = await client.paginate<CanvasAssignment>(
        `/courses/${course_id}/assignments`,
        params,
      );

      const formatted = assignments.map((a) => ({
        id: a.id,
        name: a.name,
        due_at: a.due_at,
        points_possible: a.points_possible,
        submission_types: a.submission_types,
        grading_type: a.grading_type,
        published: a.published,
        submission_status: a.submission
          ? {
              state: a.submission.workflow_state,
              score: a.submission.score,
              grade: a.submission.grade,
              submitted_at: a.submission.submitted_at,
              late: a.submission.late,
              missing: a.submission.missing,
              excused: a.submission.excused,
            }
          : null,
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
    'canvas_get_assignment',
    'Get full details of a specific assignment including description, rubric, and submission status.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      assignment_id: z.number().describe('The assignment ID'),
    },
    async ({ course_id, assignment_id }) => {
      const assignment = await client.get<CanvasAssignment>(
        `/courses/${course_id}/assignments/${assignment_id}`,
        {
          include: ['submission', 'rubric_assessment'],
        },
      );

      const result: Record<string, unknown> = {
        id: assignment.id,
        name: assignment.name,
        description: assignment.description
          ? stripHtml(assignment.description)
          : null,
        due_at: assignment.due_at,
        lock_at: assignment.lock_at,
        unlock_at: assignment.unlock_at,
        points_possible: assignment.points_possible,
        grading_type: assignment.grading_type,
        submission_types: assignment.submission_types,
        allowed_extensions: assignment.allowed_extensions,
        html_url: assignment.html_url,
        published: assignment.published,
      };

      if (assignment.rubric) {
        result['rubric'] = assignment.rubric.map((r) => ({
          description: r.description,
          long_description: r.long_description,
          points: r.points,
          ratings: r.ratings.map((rt) => ({
            description: rt.description,
            points: rt.points,
          })),
        }));
      }

      if (assignment.submission) {
        result['submission'] = {
          state: assignment.submission.workflow_state,
          score: assignment.submission.score,
          grade: assignment.submission.grade,
          submitted_at: assignment.submission.submitted_at,
          late: assignment.submission.late,
          missing: assignment.submission.missing,
          excused: assignment.submission.excused,
          attempt: assignment.submission.attempt,
          body: assignment.submission.body,
          comments: assignment.submission.submission_comments?.map((c) => ({
            author: c.author_name,
            comment: c.comment,
            created_at: c.created_at,
          })),
          rubric_assessment: assignment.submission.rubric_assessment,
        };
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
    'canvas_get_submission',
    'Get submission details for an assignment, including grade, comments, and rubric feedback.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      assignment_id: z.number().describe('The assignment ID'),
    },
    async ({ course_id, assignment_id }) => {
      const submission = await client.get<CanvasSubmission>(
        `/courses/${course_id}/assignments/${assignment_id}/submissions/self`,
        {
          include: ['submission_comments', 'rubric_assessment'],
        },
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: submission.id,
                state: submission.workflow_state,
                score: submission.score,
                grade: submission.grade,
                submitted_at: submission.submitted_at,
                attempt: submission.attempt,
                late: submission.late,
                missing: submission.missing,
                excused: submission.excused,
                body: submission.body,
                url: submission.url,
                submission_type: submission.submission_type,
                comments: submission.submission_comments?.map((c) => ({
                  author: c.author_name,
                  comment: c.comment,
                  created_at: c.created_at,
                })),
                rubric_assessment: submission.rubric_assessment,
                attachments: submission.attachments?.map((a) => ({
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

  server.tool(
    'canvas_submit_assignment',
    'Submit an assignment. Supports text entry and URL submission types.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      assignment_id: z.number().describe('The assignment ID'),
      submission_type: z
        .enum(['online_text_entry', 'online_url'])
        .describe('Type of submission'),
      body: z
        .string()
        .optional()
        .describe(
          'The text body for online_text_entry submissions (supports HTML)',
        ),
      url: z
        .string()
        .optional()
        .describe('The URL for online_url submissions'),
    },
    async ({ course_id, assignment_id, submission_type, body, url }) => {
      const submissionData: Record<string, unknown> = {
        submission_type,
      };

      if (submission_type === 'online_text_entry' && body) {
        submissionData['body'] = body;
      } else if (submission_type === 'online_url' && url) {
        submissionData['url'] = url;
      }

      const result = await client.post<CanvasSubmission>(
        `/courses/${course_id}/assignments/${assignment_id}/submissions`,
        {
          submission: submissionData,
        },
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                submission_id: result.id,
                submitted_at: result.submitted_at,
                attempt: result.attempt,
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
    'canvas_list_upcoming_assignments',
    'List upcoming assignments across ALL courses, sorted by due date. Great for getting an overview of what is due soon.',
    {
      days_ahead: z
        .number()
        .optional()
        .describe(
          'Number of days ahead to look. Defaults to 14.',
        ),
    },
    async ({ days_ahead }) => {
      const lookAhead = days_ahead ?? 14;
      const courses = await client.paginate<CanvasCourse>('/courses', {
        enrollment_state: 'active',
        state: ['available'],
      });

      const now = new Date();
      const cutoff = new Date(
        now.getTime() + lookAhead * 24 * 60 * 60 * 1000,
      );

      const allAssignments: Array<{
        course_name: string;
        course_id: number;
        id: number;
        name: string;
        due_at: string | null;
        points_possible: number;
        submission_status: string | null;
        late: boolean;
        missing: boolean;
      }> = [];

      for (const course of courses) {
        try {
          const assignments = await client.paginate<CanvasAssignment>(
            `/courses/${course.id}/assignments`,
            {
              include: ['submission'],
              bucket: 'upcoming',
              order_by: 'due_at',
            },
          );

          for (const a of assignments) {
            if (a.due_at) {
              const dueDate = new Date(a.due_at);
              if (dueDate >= now && dueDate <= cutoff) {
                allAssignments.push({
                  course_name: course.name,
                  course_id: course.id,
                  id: a.id,
                  name: a.name,
                  due_at: a.due_at,
                  points_possible: a.points_possible,
                  submission_status:
                    a.submission?.workflow_state ?? null,
                  late: a.submission?.late ?? false,
                  missing: a.submission?.missing ?? false,
                });
              }
            }
          }
        } catch {
          // Skip courses where we can't fetch assignments
        }
      }

      allAssignments.sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(allAssignments, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'canvas_get_assignment_rubric',
    'Get the full rubric for an assignment including criteria, ratings, and point values.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      assignment_id: z.number().describe('The assignment ID'),
    },
    async ({ course_id, assignment_id }) => {
      const assignment = await client.get<CanvasAssignment>(
        `/courses/${course_id}/assignments/${assignment_id}`,
        {},
      );

      if (!assignment.rubric) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'This assignment does not have a rubric.',
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
                rubric_settings: assignment.rubric_settings,
                criteria: assignment.rubric.map((c) => ({
                  description: c.description,
                  long_description: c.long_description,
                  points: c.points,
                  ratings: c.ratings.map((r) => ({
                    description: r.description,
                    long_description: r.long_description,
                    points: r.points,
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
