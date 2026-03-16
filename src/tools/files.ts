import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CanvasClient } from '../api/client.js';
import { CanvasFile, CanvasFolder } from '../types/canvas.js';

export function registerFileTools(server: McpServer, client: CanvasClient) {
  server.tool(
    'canvas_list_files',
    'List all files in a course, optionally within a specific folder.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      folder_id: z
        .number()
        .optional()
        .describe('Optional folder ID to list files from a specific folder'),
      search_term: z
        .string()
        .optional()
        .describe('Search for files by name'),
      sort: z
        .enum(['name', 'size', 'created_at', 'updated_at'])
        .optional()
        .describe('Sort files by field'),
    },
    async ({ course_id, folder_id, search_term, sort }) => {
      let path: string;
      const params: Record<string, string> = {};

      if (folder_id) {
        path = `/folders/${folder_id}/files`;
      } else {
        path = `/courses/${course_id}/files`;
      }

      if (search_term) params['search_term'] = search_term;
      if (sort) params['sort'] = sort;

      const files = await client.paginate<CanvasFile>(path, params);

      const formatted = files.map((f) => ({
        id: f.id,
        name: f.display_name,
        filename: f.filename,
        size: formatFileSize(f.size),
        size_bytes: f.size,
        content_type: f['content-type'],
        created_at: f.created_at,
        updated_at: f.updated_at,
        folder_id: f.folder_id,
        url: f.url,
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
    'canvas_get_file',
    'Get metadata and download URL for a specific file.',
    {
      file_id: z.number().describe('The file ID'),
    },
    async ({ file_id }) => {
      const file = await client.get<CanvasFile>(`/files/${file_id}`, {});

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: file.id,
                name: file.display_name,
                filename: file.filename,
                size: formatFileSize(file.size),
                content_type: file['content-type'],
                created_at: file.created_at,
                updated_at: file.updated_at,
                url: file.url,
                thumbnail_url: file.thumbnail_url,
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
    'canvas_download_file',
    'Download the content of a file. Works with text files, CSVs, and other text-based formats. Returns base64 preview for binary files.',
    {
      file_id: z.number().describe('The file ID'),
    },
    async ({ file_id }) => {
      // First get the file metadata to get the download URL
      const file = await client.get<CanvasFile>(`/files/${file_id}`, {});

      const { content, contentType } = await client.downloadFile(file.url);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                filename: file.display_name,
                content_type: contentType,
                size: formatFileSize(file.size),
                content,
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
    'canvas_list_folders',
    'List folders in a course to navigate the file structure.',
    {
      course_id: z.number().describe('The Canvas course ID'),
    },
    async ({ course_id }) => {
      const folders = await client.paginate<CanvasFolder>(
        `/courses/${course_id}/folders`,
        {},
      );

      const formatted = folders.map((f) => ({
        id: f.id,
        name: f.name,
        full_name: f.full_name,
        parent_folder_id: f.parent_folder_id,
        files_count: f.files_count,
        folders_count: f.folders_count,
        position: f.position,
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
    'canvas_upload_file',
    'Upload a file to a course for assignment submission. Returns the file ID to use when submitting.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      assignment_id: z.number().describe('The assignment ID to upload for'),
      file_name: z.string().describe('Name of the file'),
      file_content: z
        .string()
        .describe('File content as a string (for text files)'),
      content_type: z
        .string()
        .optional()
        .describe('MIME type of the file. Defaults to text/plain.'),
    },
    async ({
      course_id,
      assignment_id,
      file_name,
      file_content,
      content_type,
    }) => {
      // Step 1: Request upload URL
      const uploadRequest = await client.post<{
        upload_url: string;
        upload_params: Record<string, string>;
        file_param: string;
      }>(
        `/courses/${course_id}/assignments/${assignment_id}/submissions/self/files`,
        {
          name: file_name,
          size: Buffer.byteLength(file_content, 'utf-8'),
          content_type: content_type ?? 'text/plain',
        },
      );

      // Step 2: Upload file
      const result = await client.uploadFile(
        uploadRequest.upload_url,
        uploadRequest.upload_params,
        file_content,
        file_name,
        content_type ?? 'text/plain',
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                file_id: result.id,
                filename: result.display_name,
                size: formatFileSize(result.size),
                message:
                  'File uploaded successfully. Use the file_id with canvas_submit_file_assignment to submit.',
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
    'canvas_submit_file_assignment',
    'Submit a previously uploaded file as an assignment submission.',
    {
      course_id: z.number().describe('The Canvas course ID'),
      assignment_id: z.number().describe('The assignment ID'),
      file_ids: z
        .array(z.number())
        .describe(
          'Array of file IDs (from canvas_upload_file) to submit',
        ),
    },
    async ({ course_id, assignment_id, file_ids }) => {
      const result = await client.post<{ id: number; submitted_at: string }>(
        `/courses/${course_id}/assignments/${assignment_id}/submissions`,
        {
          submission: {
            submission_type: 'online_upload',
            file_ids,
          },
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
