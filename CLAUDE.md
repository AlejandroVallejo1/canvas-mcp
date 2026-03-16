# Canvas MCP Server - AI Agent Guide

## What This Server Does

This MCP server connects to the Canvas LMS REST API. It provides 54+ tools
for accessing university course data: courses, assignments, grades, modules,
announcements, messages, files, pages, calendar, discussions, quizzes, people,
groups, learning outcomes, analytics, and notifications.

## Authentication

The server requires two environment variables:
- `CANVAS_API_TOKEN` - A personal access token from Canvas
- `CANVAS_BASE_URL` - The Canvas instance URL (e.g., https://school.instructure.com)

## Tool Naming Convention

All tools use the pattern: `canvas_{action}_{resource}`

Examples: `canvas_list_courses`, `canvas_get_assignment`, `canvas_submit_assignment`

## Common Workflows

### Student checking upcoming work
1. `canvas_list_upcoming_assignments` (all courses, sorted by date)
2. Or `canvas_get_upcoming_deadlines` for calendar-based view
3. `canvas_get_todo_items` for Canvas's to-do list

### Reading course content
1. `canvas_list_modules` to see course structure
2. `canvas_get_full_module_content` to read all items in a module
3. `canvas_get_page` for individual wiki pages
4. `canvas_get_module_item_content` to resolve specific items

### Checking grades
1. `canvas_get_grades` for overview across all courses
2. `canvas_get_course_grades` for detailed breakdown per course
3. `canvas_whatif_grades` for hypothetical score calculations

### Submitting work
1. `canvas_get_assignment` to read instructions and rubric
2. `canvas_submit_assignment` for text or URL submissions
3. `canvas_upload_file` then `canvas_submit_file_assignment` for file uploads

### Communication
1. `canvas_list_conversations` to check inbox
2. `canvas_search_recipients` to find people
3. `canvas_send_message` to compose new messages
4. `canvas_reply_conversation` to respond to threads

## Important Notes

- All list endpoints handle pagination automatically (up to 10 pages)
- HTML content is stripped to plain text for readability
- Rate limits are handled with automatic retry and exponential backoff
- The `canvas_get_full_module_content` tool can be slow for large modules
- File downloads work for text-based files; binary files return metadata
- Some endpoints require instructor permissions and will return 403

## Error Handling

Tools return structured JSON. On errors, the response includes an error code,
message, whether the error is retryable, and a suggestion for resolution.

## Build & Development

```
npm install     # Install dependencies
npm run build   # Compile TypeScript
npm run check   # Type check without emitting
npm test        # Run tests
```
