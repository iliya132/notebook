import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import type { Note, NotebookDetail } from '../types'
import { NotePage } from './NotePage'

vi.mock('../api', async importOriginal => {
  const original = await importOriginal<typeof import('../api')>()
  return { ...original, api: vi.fn() }
})

const initial: Note = {
  id: 'note-1',
  notebookId: 'notebook-1',
  title: 'Заметка',
  content: 'Исходный текст',
  version: 1,
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z',
}

const notebook: NotebookDetail = {
  id: 'notebook-1',
  title: 'Рабочие заметки',
  version: 1,
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z',
  notes: [{ id: initial.id, title: initial.title, version: initial.version, updatedAt: initial.updatedAt }],
}

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([
    { path: '/app/notes/:noteId', element: <NotePage /> },
    { path: '/app/notebooks/:notebookId', element: <h1>Список заметок</h1> },
  ], { initialEntries: ['/app/notes/note-1'] })
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
}

describe('NotePage autosave', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('keeps edits made while an earlier save is in flight', async () => {
    let finishFirstSave: (note: Note) => void = () => undefined
    const firstSave = new Promise<Note>(resolve => { finishFirstSave = resolve })
    const savedRequests: Array<{ title: string; content: string; version: number }> = []

    vi.mocked(api).mockImplementation(async (path, options = {}) => {
      if (path === '/notes/note-1' && !options.method) return initial
      if (path === '/notebooks/notebook-1') return notebook
      if (path === '/notes/note-1/share') return { enabled: false }
      if (path === '/notes/note-1' && options.method === 'PUT') {
        const request = JSON.parse(String(options.body)) as { title: string; content: string; version: number }
        savedRequests.push(request)
        if (savedRequests.length === 1) return firstSave
        return { ...initial, ...request, version: request.version + 1 }
      }
      throw new Error(`Unexpected API call: ${path}`)
    })

    renderEditor()

    const editor = await screen.findByLabelText('Markdown')
    vi.useFakeTimers()

    fireEvent.change(editor, { target: { value: 'Первая версия' } })
    await act(() => vi.advanceTimersByTimeAsync(900))
    expect(savedRequests).toEqual([{ title: 'Заметка', content: 'Первая версия', version: 1 }])

    fireEvent.change(editor, { target: { value: 'Новый текст во время сохранения' } })
    await act(async () => {
      finishFirstSave({ ...initial, content: 'Первая версия', version: 2 })
      await firstSave
    })

    expect(screen.getByLabelText('Markdown')).toHaveValue('Новый текст во время сохранения')

    await act(() => vi.advanceTimersByTimeAsync(900))
    expect(savedRequests[1]).toEqual({ title: 'Заметка', content: 'Новый текст во время сохранения', version: 2 })
  })

  it('saves pending edits before an in-app navigation', async () => {
    let finishSave: (note: Note) => void = () => undefined
    const pendingSave = new Promise<Note>(resolve => { finishSave = resolve })
    const savedRequests: Array<{ title: string; content: string; version: number }> = []

    vi.mocked(api).mockImplementation(async (path, options = {}) => {
      if (path === '/notes/note-1' && !options.method) return initial
      if (path === '/notebooks/notebook-1') return notebook
      if (path === '/notes/note-1/share') return { enabled: false }
      if (path === '/notes/note-1' && options.method === 'PUT') {
        const request = JSON.parse(String(options.body)) as { title: string; content: string; version: number }
        savedRequests.push(request)
        return pendingSave
      }
      throw new Error(`Unexpected API call: ${path}`)
    })

    renderEditor()
    const editor = await screen.findByLabelText('Markdown')
    fireEvent.change(editor, { target: { value: 'Текст перед переходом' } })
    fireEvent.click(await screen.findByRole('link', { name: 'Рабочие заметки' }))

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Сохраняем заметку перед переходом')
    expect(savedRequests).toEqual([{ title: 'Заметка', content: 'Текст перед переходом', version: 1 }])
    expect(screen.queryByRole('heading', { name: 'Список заметок' })).not.toBeInTheDocument()

    await act(async () => {
      finishSave({ ...initial, content: 'Текст перед переходом', version: 2 })
      await pendingSave
    })

    expect(await screen.findByRole('heading', { name: 'Список заметок' })).toBeInTheDocument()
  })

  it('requests browser confirmation when the tab closes with pending edits', async () => {
    vi.mocked(api).mockImplementation(async (path, options = {}) => {
      if (path === '/notes/note-1' && !options.method) return initial
      if (path === '/notebooks/notebook-1') return notebook
      if (path === '/notes/note-1/share') return { enabled: false }
      throw new Error(`Unexpected API call: ${path}`)
    })

    renderEditor()
    fireEvent.change(await screen.findByLabelText('Markdown'), { target: { value: 'Несохранённый текст' } })

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('formats selected text with the Markdown toolbar', async () => {
    vi.mocked(api).mockImplementation(async (path, options = {}) => {
      if (path === '/notes/note-1' && !options.method) return initial
      if (path === '/notebooks/notebook-1') return notebook
      if (path === '/notes/note-1/share') return { enabled: false }
      throw new Error(`Unexpected API call: ${path}`)
    })

    renderEditor()
    const editor = await screen.findByLabelText('Markdown')
    const textarea = editor as HTMLTextAreaElement
    textarea.setSelectionRange(0, 8)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Жирный' }))
    fireEvent.click(screen.getByRole('button', { name: 'Жирный' }))

    expect(editor).toHaveValue('**Исходный** текст')
  })

  it('formats selected text with Ctrl+B', async () => {
    vi.mocked(api).mockImplementation(async (path, options = {}) => {
      if (path === '/notes/note-1' && !options.method) return initial
      if (path === '/notebooks/notebook-1') return notebook
      if (path === '/notes/note-1/share') return { enabled: false }
      throw new Error(`Unexpected API call: ${path}`)
    })

    renderEditor()
    const editor = await screen.findByLabelText('Markdown')
    const textarea = editor as HTMLTextAreaElement
    textarea.setSelectionRange(0, 8)
    fireEvent.keyDown(editor, { key: 'b', code: 'KeyB', ctrlKey: true })

    expect(editor).toHaveValue('**Исходный** текст')
  })

  it('saves pending edits immediately with Ctrl+S', async () => {
    const savedRequests: Array<{ title: string; content: string; version: number }> = []
    vi.mocked(api).mockImplementation(async (path, options = {}) => {
      if (path === '/notes/note-1' && !options.method) return initial
      if (path === '/notebooks/notebook-1') return notebook
      if (path === '/notes/note-1/share') return { enabled: false }
      if (path === '/notes/note-1' && options.method === 'PUT') {
        const request = JSON.parse(String(options.body)) as { title: string; content: string; version: number }
        savedRequests.push(request)
        return { ...initial, ...request, version: request.version + 1 }
      }
      throw new Error(`Unexpected API call: ${path}`)
    })

    renderEditor()
    const editor = await screen.findByLabelText('Markdown')
    fireEvent.change(editor, { target: { value: 'Сохранить сейчас' } })
    fireEvent.keyDown(editor, { key: 's', code: 'KeyS', ctrlKey: true })

    await waitFor(() => expect(savedRequests).toEqual([{ title: 'Заметка', content: 'Сохранить сейчас', version: 1 }]))
  })

  it('shows the shortcut reference on hover and keyboard focus', async () => {
    vi.mocked(api).mockImplementation(async (path, options = {}) => {
      if (path === '/notes/note-1' && !options.method) return initial
      if (path === '/notebooks/notebook-1') return notebook
      if (path === '/notes/note-1/share') return { enabled: false }
      throw new Error(`Unexpected API call: ${path}`)
    })

    renderEditor()
    const help = await screen.findByRole('button', { name: 'Сочетания клавиш' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.mouseEnter(help)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ctrl/⌘ + S')

    fireEvent.mouseLeave(help)
    fireEvent.focus(help)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Жирный')
  })
})
