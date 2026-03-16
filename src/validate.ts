#!/usr/bin/env node

import { CanvasClient } from './api/client.js';

async function validate() {
  const token = process.env.CANVAS_API_TOKEN;
  const baseUrl = process.env.CANVAS_BASE_URL;

  if (!token || !baseUrl) {
    console.error('Missing CANVAS_API_TOKEN or CANVAS_BASE_URL environment variables.');
    console.error('');
    console.error('Set them:');
    console.error('  export CANVAS_API_TOKEN="your-token-here"');
    console.error('  export CANVAS_BASE_URL="https://yourschool.instructure.com"');
    process.exit(1);
  }

  console.log(`Validating connection to ${baseUrl}...`);

  const client = new CanvasClient(baseUrl, token);

  try {
    const isValid = await client.validateToken();
    if (isValid) {
      console.log('Token is valid!');

      const user = await client.get<{ name: string; id: number }>(
        '/users/self',
        {},
      );
      console.log(`Authenticated as: ${user.name} (ID: ${user.id})`);

      const courses = await client.get<Array<{ id: number; name: string }>>(
        '/courses',
        { enrollment_state: 'active', per_page: '5' },
      );
      console.log(`\nFound ${courses.length} active course(s):`);
      for (const course of courses) {
        console.log(`  - ${course.name} (ID: ${course.id})`);
      }

      console.log('\nCanvas MCP server is ready to use!');
    } else {
      console.error('Token validation failed. Please check your token.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Connection failed:', (error as Error).message);
    process.exit(1);
  }
}

validate();
