# Canvas MCP

An MCP (Model Context Protocol) server that connects Claude to your Canvas LMS account. Access your courses, assignments, grades, announcements, messages, files, and more — directly from Claude.

## Features

**Courses** — List enrolled courses, get syllabi, view sections and enrollments

**Assignments** — View all assignments with due dates, submit work (text or URL), check rubrics, track upcoming deadlines across all courses

**Grades** — Current grades per course, detailed grade breakdowns, what-if grade calculator

**Modules** — Browse module structure, view items and completion status, track prerequisites

**Announcements** — Read announcements per course or across all courses, view attachments

**Messages** — Full inbox access: read conversations, send messages, reply to threads, search recipients

**Files** — Browse course files and folders, download text files, upload files for submissions

**Pages** — Read wiki/course pages with full rendered content

**Calendar** — View events and assignment deadlines, get upcoming deadlines summary

**Discussions** — Read discussion topics and replies, post new replies

**Quizzes** — View quiz details, check submission results and scores

**People** — Course roster, instructor info, user profiles

**Notifications** — Activity stream, to-do items, unread counts

## Quick Start

### 1. Get Your Canvas API Token

1. Log into your Canvas account
2. Go to **Account** → **Settings**
3. Scroll to **Approved Integrations**
4. Click **+ New Access Token**
5. Give it a name (e.g., "Claude MCP") and click **Generate Token**
6. Copy the token immediately — it won't be shown again

### 2. Install in Claude Desktop

Add this to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "canvas": {
      "command": "npx",
      "args": ["-y", "canvas-mcp"],
      "env": {
        "CANVAS_API_TOKEN": "your_token_here",
        "CANVAS_BASE_URL": "https://yourschool.instructure.com"
      }
    }
  }
}
```

### 3. Install in Claude Code

```bash
claude mcp add canvas -e CANVAS_API_TOKEN=your_token_here -e CANVAS_BASE_URL=https://yourschool.instructure.com -- npx -y canvas-mcp
```

### 4. Verify Setup

```bash
export CANVAS_API_TOKEN="your_token_here"
export CANVAS_BASE_URL="https://yourschool.instructure.com"
npx canvas-mcp validate
```

## Available Tools

| Tool | Description |
|------|-------------|
| `canvas_list_courses` | List all enrolled courses |
| `canvas_get_course` | Get course details with syllabus |
| `canvas_list_sections` | List course sections |
| `canvas_list_enrollments` | List course enrollments |
| `canvas_list_assignments` | List assignments with due dates and status |
| `canvas_get_assignment` | Get full assignment details and rubric |
| `canvas_get_submission` | Get your submission with grade and feedback |
| `canvas_submit_assignment` | Submit text or URL to an assignment |
| `canvas_list_upcoming_assignments` | Upcoming assignments across all courses |
| `canvas_get_assignment_rubric` | Get the full rubric for an assignment |
| `canvas_list_modules` | List all modules in a course |
| `canvas_list_module_items` | List items in a module |
| `canvas_get_module_item` | Get module item details |
| `canvas_get_grades` | Current grades across all courses |
| `canvas_get_course_grades` | Detailed grade breakdown for a course |
| `canvas_whatif_grades` | Calculate what-if grades |
| `canvas_list_announcements` | List announcements |
| `canvas_get_announcement` | Get full announcement content |
| `canvas_list_conversations` | List inbox conversations |
| `canvas_get_conversation` | Read a full conversation thread |
| `canvas_send_message` | Send a new message |
| `canvas_reply_conversation` | Reply to a conversation |
| `canvas_search_recipients` | Search for people to message |
| `canvas_list_files` | List files in a course |
| `canvas_get_file` | Get file metadata |
| `canvas_download_file` | Download file content |
| `canvas_list_folders` | Browse folder structure |
| `canvas_upload_file` | Upload a file for submission |
| `canvas_submit_file_assignment` | Submit uploaded files |
| `canvas_list_pages` | List wiki pages |
| `canvas_get_page` | Read a wiki page |
| `canvas_list_calendar_events` | List calendar events |
| `canvas_get_upcoming_deadlines` | Get upcoming deadlines |
| `canvas_list_discussions` | List discussion topics |
| `canvas_get_discussion` | Read a discussion with replies |
| `canvas_post_discussion_reply` | Post a discussion reply |
| `canvas_list_quizzes` | List quizzes |
| `canvas_get_quiz` | Get quiz details |
| `canvas_get_quiz_submissions` | View quiz results |
| `canvas_list_course_users` | List people in a course |
| `canvas_get_user_profile` | Get a user's profile |
| `canvas_get_self` | Get your own profile |
| `canvas_get_activity_stream` | Get recent notifications |
| `canvas_get_todo_items` | Get to-do items |
| `canvas_get_unread_count` | Get unread message count |

## Example Conversations

**"What assignments do I have due this week?"**
> Claude uses `canvas_list_upcoming_assignments` to show all upcoming deadlines sorted by date.

**"What's my grade in Biology?"**
> Claude uses `canvas_get_course_grades` to show a detailed breakdown of all assignment scores.

**"Show me the syllabus for CS 101"**
> Claude uses `canvas_get_course` to retrieve and display the full syllabus.

**"If I get a 90 on the final, what will my grade be?"**
> Claude uses `canvas_whatif_grades` to calculate the hypothetical outcome.

**"Send a message to my professor asking about office hours"**
> Claude uses `canvas_search_recipients` then `canvas_send_message` to compose and send the message.

**"What did the latest announcement say?"**
> Claude uses `canvas_list_announcements` and `canvas_get_announcement` to fetch the full content.

## Development

```bash
# Clone the repo
git clone https://github.com/AlejandroVallejo1/canvas-mcp.git
cd canvas-mcp

# Install dependencies
npm install

# Build
npm run build

# Run type checking
npm run check

# Run tests
npm test

# Run in dev mode (watches for changes)
npm run dev
```

### Local Testing

```bash
# Set environment variables
export CANVAS_API_TOKEN="your_token"
export CANVAS_BASE_URL="https://yourschool.instructure.com"

# Run the server directly
node dist/index.js

# Or validate your setup
node dist/validate.js
```

## Security

- Your Canvas API token is **never logged**, stored on disk, or transmitted anywhere except to your Canvas instance
- The token is only used in the `Authorization` header of direct API calls to your `CANVAS_BASE_URL`
- All communication with Canvas uses HTTPS
- The server runs locally via stdio — no network server is exposed
- No telemetry or analytics

## Configuration

| Environment Variable | Required | Description |
|---|---|---|
| `CANVAS_API_TOKEN` | Yes | Your Canvas personal access token |
| `CANVAS_BASE_URL` | Yes | Your Canvas instance URL (e.g., `https://yourschool.instructure.com`) |

## Troubleshooting

**"CANVAS_API_TOKEN is required"**
Make sure you've set the environment variable either in your Claude Desktop config or in your shell.

**"401 Unauthorized"**
Your token may be expired or invalid. Generate a new one from Canvas Settings → Approved Integrations.

**"403 Forbidden"**
You may not have permission to access the requested resource, or Canvas rate limiting may be active. The server retries automatically on rate limits.

**"Cannot find module"**
Run `npm run build` to compile TypeScript before running.

**Tools not showing in Claude**
1. Restart Claude Desktop after changing the config
2. Verify the config file path is correct for your OS
3. Check that `npx canvas-mcp` runs without errors

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`npm test`) and type checking (`npm run check`)
5. Commit your changes
6. Push and open a Pull Request

## License

MIT — see [LICENSE](LICENSE)
