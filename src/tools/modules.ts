import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import { CanvasModule, CanvasModuleItem } from '../types/canvas.js';

export function registerModuleTools(server: McpServer, client: CanvasClient) {
  server.tool(
    'canvas_list_modules',
    'List all modules in a course with their completion status and item counts.',
    {
      course_id: z.number().describe('The Canvas course ID'),
    },
    async ({ course_id }) => {
      const modules = await client.paginate<CanvasModule>(
        `/courses/${course_id}/modules`,
        {
          include: ['items', 'content_details'],
        },
      );

      const formatted = modules.map((m) => ({
        id: m.id,
        name: m.name,
        position: m.position,
        state: m.state,
        completed_at: m.completed_at,
        items_count: m.items_count,
        prerequisites: m.prerequisite_module_ids,
        unlock_at: m.unlock_at,
        require_sequential_progress: m.require_sequential_progress,
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
    'canvas_list_module_items',
    'List all items in a specific module: pages, assignments, files, links, external tools, etc.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      module_id: z.number().describe('The module ID'),
    },
    async ({ course_id, module_id }) => {
      const items = await client.paginate<CanvasModuleItem>(
        `/courses/${course_id}/modules/${module_id}/items`,
        {
          include: ['content_details'],
        },
      );

      const formatted = items.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        position: item.position,
        indent: item.indent,
        content_id: item.content_id,
        html_url: item.html_url,
        external_url: item.external_url,
        page_url: item.page_url,
        completion: item.completion_requirement
          ? {
              type: item.completion_requirement.type,
              completed: item.completion_requirement.completed,
              min_score: item.completion_requirement.min_score,
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
    'canvas_get_module_item',
    'Get detailed information about a specific module item.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      module_id: z.number().describe('The module ID'),
      item_id: z.number().describe('The module item ID'),
    },
    async ({ course_id, module_id, item_id }) => {
      const item = await client.get<CanvasModuleItem>(
        `/courses/${course_id}/modules/${module_id}/items/${item_id}`,
        {
          include: ['content_details'],
        },
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(item, null, 2),
          },
        ],
      };
    },
  );
}
