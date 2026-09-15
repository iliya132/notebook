import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, message } from '../api'
import type { Note, Notebook, NotebookDetail } from '../types'

export function NotebookPage() {
  const { notebookId = '' } = useParams()
  const [title, setTitle] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [bookTitle, setBookTitle] = useState('')
  const client = useQueryClient()
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['notebook', notebookId], queryFn: () => api<NotebookDetail>(`/notebooks/${notebookId}`) })
  const create = useMutation({ mutationFn: () => api<Note>(`/notebooks/${notebookId}/notes`, { method: 'POST', body: JSON.stringify({ title, content: '' }) }), onSuccess: note => navigate(`/app/notes/${note.id}`) })
  const rename = useMutation({ mutationFn: () => api<Notebook>(`/notebooks/${notebookId}`, { method: 'PATCH', body: JSON.stringify({ title: bookTitle, version: query.data!.version }) }), onSuccess: book => { client.setQueryData<NotebookDetail>(['notebook', notebookId], current => current ? { ...current, ...book } : current); void client.invalidateQueries({ queryKey: ['notebooks'] }); setRenaming(false) } })
  const remove = useMutation({ mutationFn: () => api<void>(`/notebooks/${notebookId}`, { method: 'DELETE' }), onSuccess: () => { void client.invalidateQueries({ queryKey: ['notebooks'] }); navigate('/app') } })
  if (query.isPending) return <main className="page"><p className="state">Открываем книжку…</p></main>
  if (query.isError) return <main className="page"><p className="error">{message(query.error)}</p></main>
  return <main className="page"><Link className="back" to="/app">← Все книжки</Link><div className="page-heading"><div><p className="eyebrow">Записная книжка</p><h1>{query.data.title}</h1></div><div className="toolbar-actions"><button className="ghost" onClick={() => { setBookTitle(query.data.title); setRenaming(value => !value) }}>Переименовать</button><button className="danger ghost" onClick={() => { if (window.confirm('Удалить книжку и все заметки? Это действие нельзя отменить.')) remove.mutate() }}>Удалить книжку</button></div></div>
    {renaming && <form className="inline-form" onSubmit={event => { event.preventDefault(); if (bookTitle.trim()) rename.mutate() }}><label className="sr-only" htmlFor="rename-notebook">Новое название книжки</label><input id="rename-notebook" value={bookTitle} onChange={e => setBookTitle(e.target.value)} maxLength={200} autoFocus/><button className="primary">Сохранить название</button></form>}
    <form className="inline-form" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate() }}><label className="sr-only" htmlFor="new-note">Название заметки</label><input id="new-note" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder="Название новой заметки"/><button className="primary">Создать заметку</button></form>
    {(create.isError || rename.isError || remove.isError) && <p className="error">{message(create.error ?? rename.error ?? remove.error)}</p>}
    {query.data.notes.length === 0 ? <div className="empty"><span>✎</span><h2>Нет заметок</h2><p>Начните с короткой мысли — продолжить можно позже.</p></div> : <div className="note-list">{query.data.notes.map(note => <Link to={`/app/notes/${note.id}`} key={note.id}><div><h2>{note.title}</h2><time>{new Date(note.updatedAt).toLocaleString('ru')}</time></div><span>→</span></Link>)}</div>}
  </main>
}
