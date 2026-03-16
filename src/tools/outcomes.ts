import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';

interface CanvasOutcome {
  id: number;
  title: string;
  display_name: string;
  description: string | null;
  points_possible: number;
  mastery_points: number;
  calculation_method: string;
  calculation_int: number | null;
  ratings: Array<{
    description: string;
    points: number;
  }>;
}

interface CanvasOutcomeGroup {
  id: number;
  title: string;
  description: string | null;
  url: string;
  subgroups_url: string;
  outcomes_url: string;
  can_edit: boolean;
}

interface CanvasOutcomeLink {
  outcome: CanvasOutcome;
  outcome_group: { id: number; title: string };
}

interface CanvasOutcomeResult {
  id: number;
  score: number | null;
  submitted_or_assessed_at: string;
  links: {
    user: string;
    learning_outcome: string;
    assignment: string;
  };
  percent: number | null;
  mastery: boolean | null;
}

export function registerOutcomeTools(server: McpServer, client: CanvasClient) {
  server.tool(
    'canvas_list_outcome_groups',
    'List learning outcome groups for a course. Outcomes are organized into groups/folders.',
    {
      course_id: z.number().describe('The Canvas course ID'),
    },
    async ({ course_id }) => {
      // Get the root outcome group first
      const rootGroup = await client.get<CanvasOutcomeGroup>(
        `/courses/${course_id}/root_outcome_group`,
        {},
      );

      // Then list subgroups
      const subgroups = await client.paginate<CanvasOutcomeGroup>(
        `/courses/${course_id}/outcome_groups/${rootGroup.id}/subgroups`,
        {},
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                root: {
                  id: rootGroup.id,
                  title: rootGroup.title,
                },
                subgroups: subgroups.map((g) => ({
                  id: g.id,
                  title: g.title,
                  description: g.description,
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
    'canvas_list_outcomes',
    'List learning outcomes in an outcome group for a course.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      outcome_group_id: z
        .number()
        .optional()
        .describe('Outcome group ID. If omitted, lists outcomes from the root group.'),
    },
    async ({ course_id, outcome_group_id }) => {
      let groupId = outcome_group_id;
      if (!groupId) {
        const root = await client.get<CanvasOutcomeGroup>(
          `/courses/${course_id}/root_outcome_group`,
          {},
        );
        groupId = root.id;
      }

      const links = await client.paginate<CanvasOutcomeLink>(
        `/courses/${course_id}/outcome_groups/${groupId}/outcomes`,
        {},
      );

      const formatted = links.map((l) => ({
        id: l.outcome.id,
        title: l.outcome.title,
        display_name: l.outcome.display_name,
        description: l.outcome.description
          ? stripHtml(l.outcome.description)
          : null,
        points_possible: l.outcome.points_possible,
        mastery_points: l.outcome.mastery_points,
        calculation_method: l.outcome.calculation_method,
        ratings: l.outcome.ratings,
        group: l.outcome_group.title,
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
    'canvas_get_outcome_results',
    'Get outcome results for the current user in a course. Shows mastery status for each learning outcome.',
    {
      course_id: z.number().describe('The Canvas course ID'),
    },
    async ({ course_id }) => {
      // Get current user ID first
      const self = await client.get<{ id: number }>('/users/self', {});

      const results = await client.get<{
        outcome_results: CanvasOutcomeResult[];
        linked: {
          outcomes: Array<{ id: string; title: string }>;
          assignments: Array<{ id: string; name: string }>;
        };
      }>(
        `/courses/${course_id}/outcome_results`,
        {
          user_ids: [String(self.id)],
          include: ['outcomes', 'assignments'],
        },
      );

      const outcomeMap = new Map(
        results.linked?.outcomes?.map((o) => [o.id, o.title]) ?? [],
      );
      const assignmentMap = new Map(
        results.linked?.assignments?.map((a) => [a.id, a.name]) ?? [],
      );

      const formatted = results.outcome_results.map((r) => ({
        id: r.id,
        outcome: outcomeMap.get(r.links.learning_outcome) ?? r.links.learning_outcome,
        assignment: assignmentMap.get(r.links.assignment) ?? r.links.assignment,
        score: r.score,
        percent: r.percent,
        mastery: r.mastery,
        assessed_at: r.submitted_or_assessed_at,
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
