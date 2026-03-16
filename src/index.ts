#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CanvasClient } from './api/client.js';
import { registerCourseTools } from './tools/courses.js';
import { registerAssignmentTools } from './tools/assignments.js';
import { registerModuleTools } from './tools/modules.js';
import { registerGradeTools } from './tools/grades.js';
import { registerAnnouncementTools } from './tools/announcements.js';
import { registerConversationTools } from './tools/conversations.js';
import { registerFileTools } from './tools/files.js';
import { registerPageTools } from './tools/pages.js';
import { registerCalendarTools } from './tools/calendar.js';
import { registerDiscussionTools } from './tools/discussions.js';
import { registerQuizTools } from './tools/quizzes.js';
import { registerPeopleTools } from './tools/people.js';
import { registerNotificationTools } from './tools/notifications.js';
import { registerGroupTools } from './tools/groups.js';
import { registerOutcomeTools } from './tools/outcomes.js';
import { registerAnalyticsTools } from './tools/analytics.js';

function getConfig(): { baseUrl: string; token: string } {
  const token = process.env.CANVAS_API_TOKEN;
  const baseUrl = process.env.CANVAS_BASE_URL;

  if (!token) {
    console.error(
      'Error: CANVAS_API_TOKEN environment variable is required.\n' +
        'Generate a token at: <your-canvas-url>/profile/settings\n' +
        'Under "Approved Integrations", click "+ New Access Token"',
    );
    process.exit(1);
  }

  if (!baseUrl) {
    console.error(
      'Error: CANVAS_BASE_URL environment variable is required.\n' +
        'This should be your Canvas instance URL, e.g. https://myschool.instructure.com',
    );
    process.exit(1);
  }

  return { baseUrl, token };
}

async function main() {
  const { baseUrl, token } = getConfig();

  const client = new CanvasClient(baseUrl, token);

  const server = new McpServer(
    {
      name: 'canvas-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register all tool groups
  registerCourseTools(server, client);
  registerAssignmentTools(server, client);
  registerModuleTools(server, client);
  registerGradeTools(server, client);
  registerAnnouncementTools(server, client);
  registerConversationTools(server, client);
  registerFileTools(server, client);
  registerPageTools(server, client);
  registerCalendarTools(server, client);
  registerDiscussionTools(server, client);
  registerQuizTools(server, client);
  registerPeopleTools(server, client);
  registerNotificationTools(server, client);
  registerGroupTools(server, client);
  registerOutcomeTools(server, client);
  registerAnalyticsTools(server, client);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
