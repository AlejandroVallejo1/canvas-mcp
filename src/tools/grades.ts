import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import {
  CanvasCourse,
  CanvasAssignment,
} from '../types/canvas.js';

export function registerGradeTools(server: McpServer, client: CanvasClient) {
  server.tool(
    'canvas_get_grades',
    'Get current grades across all enrolled courses. Shows current and final scores/grades.',
    {},
    async () => {
      const courses = await client.paginate<CanvasCourse>('/courses', {
        enrollment_state: 'active',
        include: ['total_scores', 'enrollments', 'term'],
        state: ['available'],
      });

      const grades = courses.map((c) => {
        const studentEnrollment = c.enrollments?.find(
          (e) =>
            e.type === 'StudentEnrollment' || e.type === 'student',
        );

        return {
          course_id: c.id,
          course_name: c.name,
          course_code: c.course_code,
          term: c.term?.name ?? 'N/A',
          current_score: studentEnrollment?.computed_current_score ?? studentEnrollment?.grades?.current_score ?? null,
          current_grade: studentEnrollment?.computed_current_grade ?? studentEnrollment?.grades?.current_grade ?? null,
          final_score: studentEnrollment?.computed_final_score ?? studentEnrollment?.grades?.final_score ?? null,
          final_grade: studentEnrollment?.computed_final_grade ?? studentEnrollment?.grades?.final_grade ?? null,
        };
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(grades, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'canvas_get_course_grades',
    'Get detailed grade breakdown for a specific course, showing all assignment grades.',
    {
      course_id: z.number().describe('The Canvas course ID'),
    },
    async ({ course_id }) => {
      const assignments = await client.paginate<CanvasAssignment>(
        `/courses/${course_id}/assignments`,
        {
          include: ['submission'],
          order_by: 'due_at',
        },
      );

      const gradeDetails = assignments.map((a) => ({
        id: a.id,
        name: a.name,
        due_at: a.due_at,
        points_possible: a.points_possible,
        score: a.submission?.score ?? null,
        grade: a.submission?.grade ?? null,
        state: a.submission?.workflow_state ?? 'unsubmitted',
        late: a.submission?.late ?? false,
        missing: a.submission?.missing ?? false,
        excused: a.submission?.excused ?? false,
      }));

      // Calculate summary
      const graded = gradeDetails.filter(
        (g) => g.score !== null && !g.excused,
      );
      const totalEarned = graded.reduce(
        (sum, g) => sum + (g.score ?? 0),
        0,
      );
      const totalPossible = graded.reduce(
        (sum, g) => sum + g.points_possible,
        0,
      );
      const percentage =
        totalPossible > 0
          ? ((totalEarned / totalPossible) * 100).toFixed(2)
          : 'N/A';

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                summary: {
                  total_earned: totalEarned,
                  total_possible: totalPossible,
                  percentage,
                  graded_count: graded.length,
                  total_assignments: gradeDetails.length,
                },
                assignments: gradeDetails,
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
    'canvas_whatif_grades',
    'Calculate what-if grades. Provide hypothetical scores for assignments to see how they would affect your grade.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      whatif_scores: z
        .array(
          z.object({
            assignment_id: z.number().describe('The assignment ID'),
            score: z.number().describe('The hypothetical score'),
          }),
        )
        .describe(
          'Array of assignment IDs and hypothetical scores to calculate',
        ),
    },
    async ({ course_id, whatif_scores }) => {
      const assignments = await client.paginate<CanvasAssignment>(
        `/courses/${course_id}/assignments`,
        {
          include: ['submission'],
        },
      );

      const whatifMap = new Map(
        whatif_scores.map((w) => [w.assignment_id, w.score]),
      );

      let totalEarned = 0;
      let totalPossible = 0;
      const details: Array<{
        name: string;
        points_possible: number;
        actual_score: number | null;
        whatif_score: number | null;
        used_score: number;
        is_whatif: boolean;
      }> = [];

      for (const a of assignments) {
        const isExcused = a.submission?.excused;
        if (isExcused) continue;

        const whatifScore = whatifMap.get(a.id);
        const actualScore = a.submission?.score ?? null;
        const usedScore = whatifScore ?? actualScore;

        if (usedScore !== null) {
          totalEarned += usedScore;
          totalPossible += a.points_possible;
          details.push({
            name: a.name,
            points_possible: a.points_possible,
            actual_score: actualScore,
            whatif_score: whatifScore ?? null,
            used_score: usedScore,
            is_whatif: whatifScore !== undefined,
          });
        }
      }

      const percentage =
        totalPossible > 0
          ? ((totalEarned / totalPossible) * 100).toFixed(2)
          : 'N/A';

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                whatif_result: {
                  total_earned: totalEarned,
                  total_possible: totalPossible,
                  percentage,
                },
                modified_assignments: details.filter((d) => d.is_whatif),
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
