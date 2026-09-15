import { StrictMode, type ReactNode } from 'react'
import { PassThrough } from 'node:stream'
import { renderToPipeableStream } from 'react-dom/server'
import { dehydrate, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import { createQueryClient } from './queryClient'
import type { ApiError, Note, Notebook, NotebookDetail, PublicNote, User } from './types'

type RequestHeaders = Record<string, string | string[] | undefined>

export type RenderResult = {
  html?: string
  state?: string
  head?: string
  status: number
  redirect?: string
  timings?: ServerTiming[]
}

export type ServerTiming = {
  name: string
  duration: number
  description?: string
}

class SsrApiError extends Error implements ApiError {
  code: string
  status: number
  fields?: Record<string, string>

  constructor(status: number, value?: Partial<ApiError>) {
    super(value?.message ?? 'Не удалось получить данные')
    this.name = 'SsrApiError'
    this.status = status
    this.code = value?.code ?? 'network_error'
    this.fields = value?.fields
  }

  toJSON(): ApiError {
    return { code: this.code, message: this.message, fields: this.fields, status: this.status }
  }
}

function header(headers: RequestHeaders, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()]
  return Array.isArray(value) ? value.join('; ') : value
}

function upstreamTiming(headerValue: string | null, prefix: string, timings: ServerTiming[]) {
  if (!headerValue) return
  for (const value of headerValue.split(',')) {
    const name = value.match(/^\s*([A-Za-z0-9_-]+)/)?.[1]
    const duration = Number(value.match(/;\s*dur=([0-9.]+)/)?.[1])
    if (name && Number.isFinite(duration)) timings.push({ name: `${prefix}_${name}`, duration })
  }
}

async function serverApi<T>(path: string, headers: RequestHeaders, apiOrigin: string, metric: string, timings: ServerTiming[]): Promise<T> {
  const started = performance.now()
  let response: Response
  try {
    response = await fetch(new URL(`/api/v1${path}`, apiOrigin), {
      headers: { accept: 'application/json', cookie: header(headers, 'cookie') ?? '' },
    })
  } catch {
    timings.push({ name: `api_${metric}`, duration: performance.now() - started, description: 'API request failed' })
    throw new SsrApiError(502, { code: 'api_unavailable', message: 'Сервис временно недоступен' })
  }

  const value = await response.json().catch(() => undefined) as Partial<ApiError> | T | undefined
  timings.push({ name: `api_${metric}`, duration: performance.now() - started, description: `API ${metric}` })
  upstreamTiming(response.headers.get('server-timing'), `api_${metric}`, timings)
  if (!response.ok) throw new SsrApiError(response.status, value as Partial<ApiError> | undefined)
  return value as T
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

function serialize(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function pageHead(title: string, description = 'Личные Markdown-заметки'): string {
  return `<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}" />`
}

function errorStatus(error: unknown): number {
  return error instanceof SsrApiError ? error.status : 500
}

function renderApp(element: ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = new PassThrough()
    const chunks: string[] = []
    let firstError: unknown
    output.setEncoding('utf8')
    output.on('data', chunk => chunks.push(String(chunk)))
    output.on('error', reject)
    output.on('end', () => firstError ? reject(firstError) : resolve(chunks.join('')))

    const stream = renderToPipeableStream(element, {
      onAllReady() {
        clearTimeout(timeout)
        stream.pipe(output)
      },
      onShellError: reject,
      onError(error) {
        firstError ??= error
      },
    })
    const timeout = setTimeout(() => stream.abort(), 10_000)
  })
}

export async function render(url: string, headers: RequestHeaders, apiOrigin: string): Promise<RenderResult> {
  const timings: ServerTiming[] = []
  const requestUrl = new URL(url, 'http://ssr.local')
  const path = requestUrl.pathname
  if (path === '/') return { status: 302, redirect: '/app' }
  const privateRoute = /^\/app\/?$/.test(path) || /^\/app\/(profile|settings)\/?$/.test(path) || /^\/app\/(notebooks|notes)\/[^/]+\/?$/.test(path)
  const publicRoute = /^\/share\/[^/]+\/?$/.test(path)
  if (!['/login', '/register'].includes(path) && !path.startsWith('/app') && !path.startsWith('/share/')) {
    return { status: 302, redirect: '/app' }
  }
  if ((path.startsWith('/app') && !privateRoute) || (path.startsWith('/share/') && !publicRoute)) {
    return { status: 302, redirect: '/app' }
  }

  const client = createQueryClient()
  let status = 200
  let title = path === '/register' ? 'Регистрация — Notebook' : path === '/login' ? 'Вход — Notebook' : 'Notebook'

  if (path.startsWith('/app')) {
    const notebookMatch = path.match(/^\/app\/notebooks\/([^/]+)\/?$/)
    const noteMatch = path.match(/^\/app\/notes\/([^/]+)\/?$/)
    const dataStarted = performance.now()
    let matchedKey: readonly unknown[] = ['notebooks']
    if (/^\/app\/?$/.test(path)) {
      await client.prefetchQuery({ queryKey: ['notebooks'], queryFn: () => serverApi<Notebook[]>('/notebooks', headers, apiOrigin, 'notebooks', timings) })
      title = 'Записные книжки — Notebook'
    } else if (notebookMatch) {
      const id = encodeURIComponent(notebookMatch[1])
      matchedKey = ['notebook', notebookMatch[1]]
      await client.prefetchQuery({ queryKey: matchedKey, queryFn: () => serverApi<NotebookDetail>(`/notebooks/${id}`, headers, apiOrigin, 'notebook', timings) })
    } else if (noteMatch) {
      const id = encodeURIComponent(noteMatch[1])
      matchedKey = ['note', noteMatch[1]]
      await client.prefetchQuery({ queryKey: matchedKey, queryFn: () => serverApi<Note>(`/notes/${id}`, headers, apiOrigin, 'note', timings) })
    } else if (/^\/app\/(profile|settings)\/?$/.test(path)) {
      matchedKey = ['account']
      await client.prefetchQuery({ queryKey: matchedKey, queryFn: () => serverApi<User>('/auth/me', headers, apiOrigin, 'account', timings) })
      title = path.startsWith('/app/profile') ? 'Профиль — Notebook' : 'Настройки — Notebook'
    }
    timings.push({ name: 'route_data', duration: performance.now() - dataStarted, description: 'Critical route data' })

    const matchedState = client.getQueryState(matchedKey)
    if (matchedState?.error) {
      status = errorStatus(matchedState.error)
      if (status === 401) return { status: 302, redirect: `/login?next=${encodeURIComponent(path + requestUrl.search)}`, timings }
    }

    // Every private data endpoint is protected by Spring Security. A successful
    // route request therefore proves the session without a second /auth/me trip.
    client.setQueryData(['session'], true)
    const notebook = notebookMatch ? client.getQueryData<NotebookDetail>(['notebook', notebookMatch[1]]) : undefined
    const note = noteMatch ? client.getQueryData<Note>(['note', noteMatch[1]]) : undefined
    if (notebook) title = `${notebook.title} — Notebook`
    if (note) title = `${note.title} — Notebook`
  }

  const publicMatch = path.match(/^\/share\/([^/]+)\/?$/)
  if (publicMatch) {
    const token = publicMatch[1]
    await client.prefetchQuery({ queryKey: ['public', token], queryFn: () => serverApi<PublicNote>(`/public/notes/${encodeURIComponent(token)}`, headers, apiOrigin, 'public_note', timings) })
    const state = client.getQueryState(['public', token])
    if (state?.error) status = errorStatus(state.error)
    const note = client.getQueryData<PublicNote>(['public', token])
    if (note) title = `${note.title} — Notebook`
  }

  const router = createMemoryRouter([{ path: '*', element: <App /> }], { initialEntries: [path + requestUrl.search] })
  const dehydrated = dehydrate(client, { shouldDehydrateQuery: () => true })
  const reactStarted = performance.now()
  const html = await renderApp(
    <StrictMode>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
  timings.push({ name: 'react', duration: performance.now() - reactStarted, description: 'React server render' })

  return {
    html,
    state: serialize(dehydrated),
    head: pageHead(title, publicMatch ? 'Публичная заметка только для чтения' : undefined),
    status,
    timings,
  }
}
