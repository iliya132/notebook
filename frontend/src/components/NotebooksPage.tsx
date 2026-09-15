import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api, message } from '../api'
import { formatDate } from '../format'
import type { Notebook } from '../types'

export function NotebooksPage() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['notebooks'], queryFn: ({ signal }) => api<Notebook[]>('/notebooks', { signal }) })
  const create = useMutation({ mutationFn: () => api<Notebook>('/notebooks', { method: 'POST', body: JSON.stringify({ title: 'Новая записная книжка' }) }), onSuccess: book => { client.setQueryData<Notebook[]>(['notebooks'], current => current ? [book, ...current] : [book]); navigate(`/app/notebooks/${book.id}`) } })
  return <main className="page"><div className="page-heading"><div><p className="eyebrow">Личная библиотека</p><h1>Записные книжки</h1></div></div>
    {create.isError && <p className="error">{message(create.error)}</p>}
    {query.isPending ? <p className="state">Загружаем книжки…</p> : query.isError ? <p className="error">{message(query.error)}</p> : <div className="card-grid">
      <button className="create-card" type="button" disabled={create.isPending} onClick={() => create.mutate()} aria-label="Создать записную книжку">
        <span className="create-icon" aria-hidden="true">+</span><span>{create.isPending ? 'Создаём…' : 'Новая книжка'}</span><small>Название можно изменить позже</small>
      </button>
      {query.data.map(book => <Link className="book-card" to={`/app/notebooks/${book.id}`} key={book.id}><span className="book-icon">▤</span><h2>{book.title}</h2><time>{formatDate(book.updatedAt)}</time></Link>)}
    </div>}
  </main>
}
