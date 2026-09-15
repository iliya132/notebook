import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import type { Note, Notebook, NotebookDetail } from '../types'
import { NotebookPage } from './NotebookPage'
import { NotebooksPage } from './NotebooksPage'

vi.mock('../api', async importOriginal => {
  const original = await importOriginal<typeof import('../api')>()
  return { ...original, api: vi.fn() }
})

const book: Notebook = {
  id: 'book-1',
  title: 'Новая записная книжка',
  version: 1,
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z',
}

const note: Note = {
  id: 'note-1',
  notebookId: book.id,
  title: 'Новая заметка',
  content: '',
  version: 1,
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z',
}

function renderRoute(routes: Parameters<typeof createMemoryRouter>[0], initialEntry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] })
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
}

describe('quick creation cards', () => {
  afterEach(() => vi.clearAllMocks())

  it('creates a default notebook and opens it', async () => {
    vi.mocked(api).mockImplementation(async (path, options = {}) => {
      if (path === '/notebooks' && !options.method) return []
      if (path === '/notebooks' && options.method === 'POST') return book
      throw new Error(`Unexpected API call: ${path}`)
    })
    renderRoute([
      { path: '/app', element: <NotebooksPage /> },
      { path: '/app/notebooks/:notebookId', element: <h1>Открытая книжка</h1> },
    ], '/app')

    fireEvent.click(await screen.findByRole('button', { name: 'Создать записную книжку' }))

    expect(await screen.findByRole('heading', { name: 'Открытая книжка' })).toBeInTheDocument()
    expect(api).toHaveBeenCalledWith('/notebooks', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: 'Новая записная книжка' }),
    }))
  })

  it('creates a default note and opens the editor route', async () => {
    const detail: NotebookDetail = { ...book, notes: [] }
    vi.mocked(api).mockImplementation(async (path, options = {}) => {
      if (path === '/notebooks/book-1' && !options.method) return detail
      if (path === '/notebooks/book-1/notes' && options.method === 'POST') return note
      throw new Error(`Unexpected API call: ${path}`)
    })
    renderRoute([
      { path: '/app/notebooks/:notebookId', element: <NotebookPage /> },
      { path: '/app/notes/:noteId', element: <h1>Открытая заметка</h1> },
    ], '/app/notebooks/book-1')

    fireEvent.click(await screen.findByRole('button', { name: 'Создать заметку' }))

    expect(await screen.findByRole('heading', { name: 'Открытая заметка' })).toBeInTheDocument()
    expect(api).toHaveBeenCalledWith('/notebooks/book-1/notes', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: 'Новая заметка', content: '' }),
    }))
  })
})
