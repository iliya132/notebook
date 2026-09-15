import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import type { PublicNote } from '../types'
import { Markdown } from './Markdown'

export function PublicPage() {
  const { token = '' } = useParams()
  const query = useQuery({ queryKey: ['public', token], queryFn: () => api<PublicNote>(`/public/notes/${encodeURIComponent(token)}`), retry: false })
  if (query.isPending) return <main className="public-page"><p className="state">Открываем заметку…</p></main>
  if (query.isError) return <main className="public-page"><article className="public-note not-found"><p className="eyebrow">404</p><h1>Заметка недоступна</h1><p>Ссылка неверна, отозвана или заметка была удалена.</p></article></main>
  return <main className="public-page"><article className="public-note"><div className="readonly">Только чтение</div><h1>{query.data.title}</h1><time>Обновлено {new Date(query.data.updatedAt).toLocaleString('ru')}</time><Markdown>{query.data.content}</Markdown></article></main>
}
