import type { ApiError } from './types'

let csrfToken: string | undefined

function metricPath(path: string): string {
  return path
    .replace(/^\/public\/notes\/[^/]+$/, '/public/notes/:token')
    .replace(/^\/notes\/[^/]+\/share$/, '/notes/:id/share')
    .replace(/^\/notes\/[^/]+$/, '/notes/:id')
    .replace(/^\/notebooks\/[^/]+\/notes$/, '/notebooks/:id/notes')
    .replace(/^\/notebooks\/[^/]+$/, '/notebooks/:id')
}

async function csrf(): Promise<string> {
  if (csrfToken) return csrfToken
  const response = await fetch('/api/v1/auth/csrf', { credentials: 'include', cache: 'no-store' })
  if (!response.ok) throw await error(response)
  csrfToken = (await response.json() as { token: string }).token
  return csrfToken
}

async function error(response: Response): Promise<ApiError> {
  try { return { ...await response.json() as ApiError, status: response.status } } catch { return { code: 'network_error', message: 'Не удалось выполнить запрос', status: response.status } }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method?.toUpperCase() ?? 'GET'
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method)
  const started = typeof performance === 'undefined' ? undefined : performance.now()
  const request = async () => {
    const headers = new Headers(options.headers)
    if (options.body) headers.set('Content-Type', 'application/json')
    if (mutating) headers.set('X-XSRF-TOKEN', await csrf())
    return fetch(`/api/v1${path}`, { ...options, headers, credentials: 'include' })
  }
  try {
    let response = await request()
    if (response.status === 403 && mutating) {
      csrfToken = undefined
      response = await request()
    }
    if (!response.ok) {
      throw await error(response)
    }
    if (path === '/auth/logout') csrfToken = undefined
    if (response.status === 204) return undefined as T
    return await response.json() as T
  } finally {
    if (started !== undefined) {
      performance.measure(`notebook:api:${method} ${metricPath(path)}`, { start: started, end: performance.now() })
    }
  }
}

export function message(value: unknown): string {
  return typeof value === 'object' && value !== null && 'message' in value ? String(value.message) : 'Произошла ошибка'
}
