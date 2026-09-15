import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { GlobalNoteSearch } from './GlobalNoteSearch'

function Location() {
  return <output aria-label="Текущий путь">{useLocation().pathname}</output>
}

function renderSearch() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app']}>
        <Routes><Route path="*" element={<><GlobalNoteSearch /><Location /></>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('GlobalNoteSearch', () => {
  it('shows suggestions, highlights every matching fragment and opens one from the keyboard', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: 'note-1',
      notebookId: 'book-1',
      notebookTitle: 'Работа',
      title: 'Красная заметка',
      excerpt: 'Эта заметка содержит детали',
      updatedAt: '2026-09-15T09:30:00Z',
    }]), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    renderSearch()

    const input = screen.getByRole('searchbox', { name: 'Поиск заметок' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'заметка' } })

    const option = await screen.findByRole('option', { name: /Красная заметка/ })
    expect(option.querySelectorAll('mark')).toHaveLength(2)
    expect([...option.querySelectorAll('mark')]).toEqual(expect.arrayContaining([
      expect.objectContaining({ textContent: 'заметка' }),
      expect.objectContaining({ textContent: 'заметка' }),
    ]))
    expect(option.querySelector('mark')).toHaveClass('search-match')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/notes/search?q=%D0%B7%D0%B0%D0%BC%D0%B5%D1%82%D0%BA%D0%B0', expect.objectContaining({ credentials: 'include' }))

    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByLabelText('Текущий путь')).toHaveTextContent('/app/notes/note-1'))
  })

  it('reports an empty result without opening a note', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })))
    renderSearch()

    const input = screen.getByRole('searchbox', { name: 'Поиск заметок' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'ничего' } })

    expect(await screen.findByText('Подходящих заметок нет')).toBeInTheDocument()
  })
})
