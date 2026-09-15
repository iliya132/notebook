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

    expect(result).toEqual({ status: 302, redirect: '/login?next=%2Fapp%2Fnotes%2F123%3Ffocus%3D1' })
  })

  it('prefetches private note and share data for the first server render', async () => {
    const fetchMock = vi.fn((input: URL | RequestInfo) => {
      const path = new URL(String(input)).pathname
      const data = path.endsWith('/auth/me')
        ? { id: 'user-1', name: 'Илья', email: 'user@example.com', createdAt: '2026-09-15T08:00:00Z' }
        : path.endsWith('/share')
          ? { enabled: false }
          : { id: 'note-1', notebookId: 'book-1', title: 'Быстрая заметка', content: 'Сразу с сервера', version: 2, createdAt: '2026-09-15T08:00:00Z', updatedAt: '2026-09-15T09:00:00Z' }
      return Promise.resolve(new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await render('/app/notes/note-1', { cookie: 'SESSION=valid' }, 'http://localhost:8080')

    expect(result.status).toBe(200)
    expect(result.html).toContain('value="Быстрая заметка"')
    expect(result.html).toContain('Сразу с сервера')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
