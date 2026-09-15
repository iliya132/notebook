import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, message } from '../api'
import { formatDateTime } from '../format'
import type { NoteSearchResult } from '../types'

const RESULT_LIMIT = 8

function Highlight({ children, query }: { children: string; query: string }) {
  if (!query) return children
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = children.split(new RegExp(`(${escaped})`, 'giu'))
  const exact = new RegExp(`^${escaped}$`, 'iu')
  return parts.map((part, index): ReactNode => exact.test(part)
    ? <mark className="search-match" key={`${part}-${index}`}>{part}</mark>
    : part)
}

export function GlobalNoteSearch() {
  const [hydrated, setHydrated] = useState(false)
  const [value, setValue] = useState('')
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const normalized = value.trim()

  useEffect(() => setHydrated(true), [])

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(normalized), 250)
    return () => window.clearTimeout(timer)
  }, [normalized])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const results = useQuery({
    queryKey: ['note-search', query],
    queryFn: ({ signal }) => api<NoteSearchResult[]>(`/notes/search?q=${encodeURIComponent(query)}`, { signal }),
    enabled: hydrated && query.length > 0,
    staleTime: 30_000,
  })
  const suggestions = results.data?.slice(0, RESULT_LIMIT) ?? []
  const waiting = normalized !== query || results.isFetching
  const open = focused && normalized.length > 0

  useEffect(() => setActive(0), [query, suggestions.length])

  const choose = (noteId: string) => {
    setValue('')
    setQuery('')
    setFocused(false)
    navigate(`/app/notes/${noteId}`)
  }

  // Avoid presenting an inert controlled input in SSR HTML. Rendering the real
  // search only after hydration also prevents very fast typing from being reset.
  if (!hydrated) return <div className="global-search global-search-loading" aria-hidden="true" />

  return <div className="global-search" ref={root}>
    <label className="sr-only" htmlFor="global-note-search">Поиск заметок</label>
    <input
      id="global-note-search"
      type="search"
      value={value}
      placeholder="Найти заметку…"
      maxLength={100}
      autoComplete="off"
      aria-autocomplete="list"
      aria-controls="note-search-results"
      aria-expanded={open}
      aria-activedescendant={open && suggestions[active] ? `note-search-result-${suggestions[active].id}` : undefined}
      onFocus={() => setFocused(true)}
      onChange={event => { setValue(event.target.value); setFocused(true) }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setFocused(false); event.currentTarget.blur(); return }
        if (!open || suggestions.length === 0) return
        if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => (index + 1) % suggestions.length) }
        if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => (index - 1 + suggestions.length) % suggestions.length) }
        if (event.key === 'Enter') { event.preventDefault(); choose(suggestions[active].id) }
      }}
    />
    {open && <div className="search-popover" id="note-search-results" role="listbox" aria-label="Найденные заметки">
      {waiting ? <p className="search-message" role="status">Ищем заметки…</p>
        : results.isError ? <p className="search-message error">{message(results.error)}</p>
          : suggestions.length === 0 ? <p className="search-message">Подходящих заметок нет</p>
            : suggestions.map((note, index) => <Link
              id={`note-search-result-${note.id}`}
              role="option"
              aria-selected={index === active}
              className={`search-result ${index === active ? 'active' : ''}`}
              to={`/app/notes/${note.id}`}
              key={note.id}
              onMouseEnter={() => setActive(index)}
              onClick={event => { event.preventDefault(); choose(note.id) }}
            >
              <span className="search-result-title"><Highlight query={normalized}>{note.title}</Highlight></span>
              {note.excerpt && <span className="search-result-excerpt"><Highlight query={normalized}>{note.excerpt}</Highlight></span>}
              <span className="search-result-meta">{note.notebookTitle} · {formatDateTime(note.updatedAt)}</span>
            </Link>)}
    </div>}
  </div>
}
