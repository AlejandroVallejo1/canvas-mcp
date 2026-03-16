import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import { CanvasQuiz, CanvasQuizSubmission } from '../types/canvas.js';

export function registerQuizTools(server: McpServer, client: CanvasClient) {
  server.tool(
    'canvas_list_quizzes',
    'List all quizzes in a course with their details and availability.',
    {
      course_id: z.number().describe('The Canvas course ID'),
    },
    async ({ course_id }) => {
      const quizzes = await client.paginate<CanvasQuiz>(
        `/courses/${course_id}/quizzes`,
        {},
      );

      const formatted = quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        quiz_type: q.quiz_type,
        points_possible: q.points_possible,
        question_count: q.question_count,
        time_limit: q.time_limit
          ? `${q.time_limit} minutes`
          : 'No limit',
        allowed_attempts: q.allowed_attempts === -1 ? 'Unlimited' : q.allowed_attempts,
        due_at: q.due_at,
        lock_at: q.lock_at,
        unlock_at: q.unlock_at,
        published: q.published,
        html_url: q.html_url,
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
    'canvas_get_quiz',
    'Get detailed information about a specific quiz.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      quiz_id: z.number().describe('The quiz ID'),
    },
    async ({ course_id, quiz_id }) => {
      const quiz = await client.get<CanvasQuiz>(
        `/courses/${course_id}/quizzes/${quiz_id}`,
        {},
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: quiz.id,
                title: quiz.title,
                description: quiz.description
                  ? stripHtml(quiz.description)
                  : null,
                quiz_type: quiz.quiz_type,
                points_possible: quiz.points_possible,
                question_count: quiz.question_count,
                time_limit: quiz.time_limit
                  ? `${quiz.time_limit} minutes`
                  : 'No limit',
                allowed_attempts:
                  quiz.allowed_attempts === -1
                    ? 'Unlimited'
                    : quiz.allowed_attempts,
                due_at: quiz.due_at,
                lock_at: quiz.lock_at,
                unlock_at: quiz.unlock_at,
                published: quiz.published,
                show_correct_answers: quiz.show_correct_answers,
                html_url: quiz.html_url,
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
    'canvas_get_quiz_submissions',
    'Get quiz submission results for the current user.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      quiz_id: z.number().describe('The quiz ID'),
    },
    async ({ course_id, quiz_id }) => {
      const result = await client.get<{
        quiz_submissions: CanvasQuizSubmission[];
      }>(
        `/courses/${course_id}/quizzes/${quiz_id}/submissions`,
        {},
      );

      const formatted = result.quiz_submissions.map((s) => ({
        id: s.id,
        attempt: s.attempt,
        started_at: s.started_at,
        finished_at: s.finished_at,
        score: s.score,
        kept_score: s.kept_score,
        state: s.workflow_state,
        time_spent: s.time_spent
          ? `${Math.round(s.time_spent / 60)} minutes`
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
