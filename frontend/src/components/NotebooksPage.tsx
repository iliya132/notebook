import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, message } from '../api'
import { formatDate } from '../format'
import type { Notebook } from '../types'

export function NotebooksPage() {
  const client = useQueryClient()
  const [title, setTitle] = useState('')
  const query = useQuery({ queryKey: ['notebooks'], queryFn: ({ signal }) => api<Notebook[]>('/notebooks', { signal }) })
  const create = useMutation({ mutationFn: () => api<Notebook>('/notebooks', { method: 'POST', body: JSON.stringify({ title }) }), onSuccess: book => { setTitle(''); client.setQueryData<Notebook[]>(['notebooks'], current => current ? [book, ...current] : [book]) } })
  return <main className="page"><div className="page-heading"><div><p className="eyebrow">Личная библиотека</p><h1>Записные книжки</h1></div></div>
    <form className="inline-form" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate() }}><label className="sr-only" htmlFor="new-notebook">Название книжки</label><input id="new-notebook" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder="Новая записная книжка"/><button className="primary">Создать</button></form>
    {create.isError && <p className="error">{message(create.error)}</p>}
    {query.isPending ? <p className="state">Загружаем книжки…</p> : query.isError ? <p className="error">{message(query.error)}</p> : query.data.length === 0 ? <div className="empty"><span>✦</span><h2>Здесь пока тихо</h2><p>Создайте первую книжку для заметок и идей.</p></div> : <div className="card-grid">{query.data.map(book => <Link className="book-card" to={`/app/notebooks/${book.id}`} key={book.id}><span className="book-icon">▤</span><h2>{book.title}</h2><time>{formatDate(book.updatedAt)}</time></Link>)}</div>}
  </main>
}
