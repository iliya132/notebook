import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from './entry-server'

afterEach(() => vi.unstubAllGlobals())

describe('SSR renderer', () => {
  it('renders and safely serializes a public note before hydration', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      title: 'SSR <note>',
      content: 'Hello **server** </script><script>alert(1)</script>',
      updatedAt: '2026-09-15T09:30:00Z',
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    const result = await render('/share/token', {}, 'http://localhost:8080')

    expect(result.status).toBe(200)
    expect(result.head).toContain('SSR &lt;note&gt;')
    expect(result.html).toContain('<h1>SSR &lt;note&gt;</h1>')
    expect(result.html).toContain('<strong>server</strong>')
    expect(result.state).not.toContain('</script>')
    expect(result.state).toContain('\\u003c/script\\u003e')
  })

  it('redirects unauthenticated private requests without rendering the app shell', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'unauthorized',
      message: 'Требуется вход',
    }), { status: 401, headers: { 'content-type': 'application/json' } })))

    const result = await render('/app/notes/123?focus=1', { cookie: 'SESSION=expired' }, 'http://localhost:8080')

    expect(result.status).toBe(302)
    expect(result.redirect).toBe('/login?next=%2Fapp%2Fnotes%2F123%3Ffocus%3D1')
    expect(result.timings).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'api_note' })]))
  })

  it('loads a private note with one critical API request and exposes its timing', async () => {
    const fetchMock = vi.fn((input: URL | RequestInfo) => {
      const path = new URL(String(input)).pathname
      expect(path).toBe('/api/v1/notes/note-1')
      const data = { id: 'note-1', notebookId: 'book-1', title: 'Быстрая заметка', content: 'Сразу с сервера', version: 2, createdAt: '2026-09-15T08:00:00Z', updatedAt: '2026-09-15T09:00:00Z' }
      return Promise.resolve(new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'content-type': 'application/json', 'server-timing': 'app;dur=12.4' },
      }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await render('/app/notes/note-1', { cookie: 'SESSION=valid' }, 'http://localhost:8080')

    expect(result.status).toBe(200)
    expect(result.html).toContain('value="Быстрая заметка"')
    expect(result.html).toContain('Сразу с сервера')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result.timings).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'api_note' }),
      expect.objectContaining({ name: 'api_note_app', duration: 12.4 }),
      expect.objectContaining({ name: 'react' }),
    ]))
  })

  it('authenticates and renders the profile route on the server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'user-1', name: 'Анна Смирнова', email: 'anna@example.test', createdAt: '2026-09-15T00:00:00Z',
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await render('/app/profile', { cookie: 'SESSION=valid' }, 'http://localhost:8080')

    expect(result.status).toBe(200)
    expect(result.head).toContain('Профиль — Notebook')
    expect(result.html).toContain('Анна Смирнова')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('authenticates the settings route before server rendering', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'user-1', name: 'Анна Смирнова', email: 'anna@example.test', createdAt: '2026-09-15T00:00:00Z',
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    const result = await render('/app/settings', { cookie: 'SESSION=valid' }, 'http://localhost:8080')

    expect(result.status).toBe(200)
    expect(result.head).toContain('Настройки — Notebook')
    expect(result.html).toContain('Тема оформления')
  })
})
