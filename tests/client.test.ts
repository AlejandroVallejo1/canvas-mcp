import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasClient, CanvasApiError } from '../src/api/client.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('CanvasClient', () => {
  let client: CanvasClient;

  beforeEach(() => {
    client = new CanvasClient('https://canvas.example.com', 'test-token-123');
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should normalize base URL by removing trailing slash', () => {
      const c = new CanvasClient('https://canvas.example.com/', 'token');
      // We can test this indirectly by checking the URL used in a request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
        headers: new Map(),
      });

      // The URL should not have double slashes
      c.get('/users/self');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://canvas.example.com/api/v1/users/self'),
        expect.any(Object),
      );
    });
  });

  describe('get', () => {
    it('should make GET request with auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 1, name: 'Test User' }),
        headers: new Map(),
      });

      const result = await client.get<{ id: number; name: string }>(
        '/users/self',
      );

      expect(result).toEqual({ id: 1, name: 'Test User' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users/self'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        }),
      );
    });

    it('should include query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
        headers: new Map(),
      });

      await client.get('/courses', { enrollment_state: 'active' });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('enrollment_state=active');
    });

    it('should handle array query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
        headers: new Map(),
      });

      await client.get('/courses', {
        include: ['term', 'teachers'],
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('include%5B%5D=term');
      expect(calledUrl).toContain('include%5B%5D=teachers');
    });
  });

  describe('error handling', () => {
    it('should throw CanvasApiError on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '{"errors":[{"message":"not found"}]}',
        headers: new Map([['X-Rate-Limit-Remaining', '100']]),
      });

      await expect(client.get('/nonexistent')).rejects.toThrow(
        CanvasApiError,
      );
    });

    it('should retry on 429 rate limit', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          text: async () => 'rate limited',
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
          headers: new Map(),
        });

      const result = await client.get<{ success: boolean }>('/test');
      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 1, name: 'Test' }),
        headers: new Map(),
      });

      const result = await client.validateToken();
      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'invalid token',
        headers: new Map(),
      });

      const result = await client.validateToken();
      expect(result).toBe(false);
    });
  });

  describe('paginate', () => {
    it('should follow Link header for pagination', async () => {
      const headers1 = new Headers();
      headers1.set(
        'Link',
        '<https://canvas.example.com/api/v1/courses?page=2&per_page=100>; rel="next"',
      );

      const headers2 = new Headers();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [{ id: 1 }, { id: 2 }],
          headers: headers1,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [{ id: 3 }],
          headers: headers2,
        });

      const result = await client.paginate<{ id: number }>('/courses');

      expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should stop at maxPages', async () => {
      const headers = new Headers();
      headers.set(
        'Link',
        '<https://canvas.example.com/api/v1/courses?page=2>; rel="next"',
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ id: 1 }],
        headers,
      });

      const result = await client.paginate<{ id: number }>(
        '/courses',
        {},
        2,
      );

      expect(result).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe('CanvasApiError', () => {
  it('should contain status code and body', () => {
    const error = new CanvasApiError(404, 'Not Found', '{"error":"missing"}');
    expect(error.statusCode).toBe(404);
    expect(error.statusText).toBe('Not Found');
    expect(error.body).toBe('{"error":"missing"}');
    expect(error.message).toContain('404');
  });
});
