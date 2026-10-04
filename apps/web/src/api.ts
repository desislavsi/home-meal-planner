export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...options, credentials: 'include', headers });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) throw new ApiError(body?.error ?? `Request failed with ${response.status}`, response.status);
  return body as T;
}
