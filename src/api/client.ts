import { PaginatedResponse } from '../types/canvas.js';

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

export class CanvasApiError extends Error {
  constructor(
    public statusCode: number,
    public statusText: string,
    public body: string,
  ) {
    super(`Canvas API error ${statusCode}: ${statusText}`);
    this.name = 'CanvasApiError';
  }
}

export class CanvasClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    // Normalize base URL: remove trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseLinkHeader(header: string | null): Record<string, string> {
    const links: Record<string, string> = {};
    if (!header) return links;

    const parts = header.split(',');
    for (const part of parts) {
      const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
      if (match) {
        links[match[2]] = match[1];
      }
    }
    return links;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | string[]>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/v1${path}`);

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            url.searchParams.append(`${key}[]`, v);
          }
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          method,
          headers: this.headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        // Handle rate limiting
        if (response.status === 403) {
          const rateLimitRemaining = response.headers.get(
            'X-Rate-Limit-Remaining',
          );
          if (rateLimitRemaining && parseFloat(rateLimitRemaining) <= 0) {
            const retryAfter = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
            await this.sleep(retryAfter);
            continue;
          }
        }

        if (response.status === 429) {
          const retryAfter = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await this.sleep(retryAfter);
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new CanvasApiError(
            response.status,
            response.statusText,
            errorBody,
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;
        if (error instanceof CanvasApiError) {
          // Don't retry client errors (except rate limits handled above)
          if (error.statusCode >= 400 && error.statusCode < 500) {
            throw error;
          }
        }
        // Retry on network errors and 5xx
        if (attempt < MAX_RETRIES - 1) {
          await this.sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  async get<T>(
    path: string,
    queryParams?: Record<string, string | number | boolean | string[]>,
  ): Promise<T> {
    return this.request<T>('GET', path, undefined, queryParams);
  }

  async post<T>(
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | string[]>,
  ): Promise<T> {
    return this.request<T>('POST', path, body, queryParams);
  }

  async put<T>(
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | string[]>,
  ): Promise<T> {
    return this.request<T>('PUT', path, body, queryParams);
  }

  async delete<T>(
    path: string,
    queryParams?: Record<string, string | number | boolean | string[]>,
  ): Promise<T> {
    return this.request<T>('DELETE', path, undefined, queryParams);
  }

  async paginate<T>(
    path: string,
    queryParams?: Record<string, string | number | boolean | string[]>,
    maxPages: number = 10,
  ): Promise<T[]> {
    const allItems: T[] = [];
    let url: string | null = `${this.baseUrl}/api/v1${path}`;

    const params = new URLSearchParams();
    params.set('per_page', '100');
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            params.append(`${key}[]`, v);
          }
        } else {
          params.set(key, String(value));
        }
      }
    }

    let pagesLoaded = 0;

    while (url && pagesLoaded < maxPages) {
      const fullUrl = pagesLoaded === 0 ? `${url}?${params.toString()}` : url;

      let lastError: Error | null = null;
      let response: Response | null = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          response = await fetch(fullUrl, {
            method: 'GET',
            headers: this.headers,
          });

          if (response.status === 429) {
            await this.sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
            continue;
          }

          if (response.status === 403) {
            const rateLimitRemaining = response.headers.get(
              'X-Rate-Limit-Remaining',
            );
            if (rateLimitRemaining && parseFloat(rateLimitRemaining) <= 0) {
              await this.sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
              continue;
            }
          }

          break;
        } catch (error) {
          lastError = error as Error;
          if (attempt < MAX_RETRIES - 1) {
            await this.sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
          }
        }
      }

      if (!response) {
        throw lastError ?? new Error('Pagination request failed');
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new CanvasApiError(
          response.status,
          response.statusText,
          errorBody,
        );
      }

      const data = (await response.json()) as T[];
      allItems.push(...data);

      const linkHeader = response.headers.get('Link');
      const links = this.parseLinkHeader(linkHeader);
      url = links['next'] ?? null;
      pagesLoaded++;
    }

    return allItems;
  }

  async paginateOnce<T>(
    path: string,
    queryParams?: Record<string, string | number | boolean | string[]>,
  ): Promise<PaginatedResponse<T>> {
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    url.searchParams.set('per_page', '50');

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            url.searchParams.append(`${key}[]`, v);
          }
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new CanvasApiError(
        response.status,
        response.statusText,
        errorBody,
      );
    }

    const data = (await response.json()) as T[];
    const linkHeader = response.headers.get('Link');
    const links = this.parseLinkHeader(linkHeader);

    return {
      data,
      nextPage: links['next'] ?? null,
    };
  }

  async downloadFile(fileUrl: string): Promise<{ content: string; contentType: string }> {
    const response = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new CanvasApiError(
        response.status,
        response.statusText,
        'Failed to download file',
      );
    }

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';

    if (
      contentType.startsWith('text/') ||
      contentType.includes('json') ||
      contentType.includes('xml') ||
      contentType.includes('javascript') ||
      contentType.includes('csv')
    ) {
      const text = await response.text();
      return { content: text, contentType };
    }

    // For binary files, return base64
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return {
      content: `[Binary file: ${contentType}, ${buffer.byteLength} bytes]\nBase64: ${base64.substring(0, 200)}...`,
      contentType,
    };
  }

  async uploadFile(
    uploadUrl: string,
    uploadParams: Record<string, string>,
    fileContent: Buffer | string,
    fileName: string,
    contentType: string,
  ): Promise<CanvasFileUploadResponse> {
    // Step 1: POST to upload URL to get the pre-signed URL
    const formData = new FormData();
    for (const [key, value] of Object.entries(uploadParams)) {
      formData.append(key, value);
    }

    const blob = typeof fileContent === 'string'
      ? new Blob([fileContent], { type: contentType })
      : new Blob([new Uint8Array(fileContent)], { type: contentType });
    formData.append('file', blob, fileName);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new CanvasApiError(
        response.status,
        response.statusText,
        errorBody,
      );
    }

    return (await response.json()) as CanvasFileUploadResponse;
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.get('/users/self');
      return true;
    } catch {
      return false;
    }
  }
}

interface CanvasFileUploadResponse {
  id: number;
  url: string;
  display_name: string;
  size: number;
}
