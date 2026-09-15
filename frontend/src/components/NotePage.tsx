import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { api, message } from '../api'
import type { Note, NotebookDetail } from '../types'
import { Markdown } from './Markdown'
import { MarkdownToolbar } from './MarkdownToolbar'

type Share = { enabled: boolean; url?: string }

export function NotePage() {
  const { noteId = '' } = useParams()
  const query = useQuery({ queryKey: ['note', noteId], queryFn: ({ signal }) => api<Note>(`/notes/${noteId}`, { signal }) })
  if (query.isPending) return <main className="page"><p className="state">Открываем заметку…</p></main>
  if (query.isError) return <main className="page"><p className="error">{message(query.error)}</p></main>
  // Keep the editor mounted when a save updates the server-side version. A user can
  // continue typing while that request is in flight; remounting from its response
  // would replace those newer local edits with the older saved snapshot.
  return <NoteEditor key={query.data.id} initial={query.data} />
}

function NoteEditor({ initial }: { initial: Note }) {
  const [title, setTitle] = useState(initial.title)
  const [content, setContent] = useState(initial.content)
  const [version, setVersion] = useState(initial.version)
  const [saved, setSaved] = useState({ title: initial.title, content: initial.content })
  const previewContent = useDeferredValue(content)
  const navigate = useNavigate()
  const client = useQueryClient()
  const first = useRef(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const notebook = useQuery({ queryKey: ['notebook', initial.notebookId], queryFn: ({ signal }) => api<NotebookDetail>(`/notebooks/${initial.notebookId}`, { signal }) })
  const dirty = title !== saved.title || content !== saved.content
  const save = useMutation({
    mutationFn: () => api<Note>(`/notes/${initial.id}`, { method: 'PUT', body: JSON.stringify({ title, content, version }) }),
    onSuccess: note => {
      setVersion(note.version)
      setSaved({ title: note.title, content: note.content })
      client.setQueryData(['note', initial.id], note)
      client.setQueryData<NotebookDetail>(['notebook', initial.notebookId], current => current ? {
        ...current,
        notes: [
          { id: note.id, title: note.title, version: note.version, updatedAt: note.updatedAt },
          ...current.notes.filter(summary => summary.id !== note.id),
        ],
      } : current)
    },
  })
  const { mutate: saveNote, isPending: savePending } = save
  const blocker = useBlocker(dirty || savePending)
  const leavingSaveStarted = useRef(false)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (!dirty || !title.trim() || savePending || blocker.state === 'blocked') return
    const timer = window.setTimeout(() => saveNote(), 900)
    return () => window.clearTimeout(timer)
  }, [title, content, dirty, savePending, saveNote, blocker.state])

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      leavingSaveStarted.current = false
      return
    }
    if (savePending) return
    if (!dirty) {
      blocker.proceed()
      return
    }
    if (!title.trim() || save.isError || leavingSaveStarted.current) return
    leavingSaveStarted.current = true
    saveNote(undefined, { onSettled: () => { leavingSaveStarted.current = false } })
  }, [blocker, dirty, save.isError, saveNote, savePending, title])

  useEffect(() => {
    const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
      if (!dirty && !savePending) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnAboutUnsavedChanges)
    return () => window.removeEventListener('beforeunload', warnAboutUnsavedChanges)
  }, [dirty, savePending])

  const remove = useMutation({ mutationFn: () => api<void>(`/notes/${initial.id}`, { method: 'DELETE' }), onSuccess: () => { client.removeQueries({ queryKey: ['note', initial.id] }); client.setQueryData<NotebookDetail>(['notebook', initial.notebookId], current => current ? { ...current, notes: current.notes.filter(note => note.id !== initial.id) } : current); navigate(`/app/notebooks/${initial.notebookId}`) } })
  const status = useQuery({ queryKey: ['share', initial.id], queryFn: ({ signal }) => api<Share>(`/notes/${initial.id}/share`, { signal }) })
  const share = useMutation({ mutationFn: () => api<Share>(`/notes/${initial.id}/share`, { method: 'POST' }), onSuccess: result => { client.setQueryData(['share', initial.id], result); if (result.url) void navigator.clipboard?.writeText(result.url) } })
  const revoke = useMutation({ mutationFn: () => api<void>(`/notes/${initial.id}/share`, { method: 'DELETE' }), onSuccess: () => client.setQueryData(['share', initial.id], { enabled: false }) })
  const error = save.error ?? remove.error ?? share.error ?? revoke.error
  return <main className="editor-page">
    {blocker.state === 'blocked' && <div className="leave-guard" role="alertdialog" aria-modal="true" aria-labelledby="leave-guard-title">
      <div className="leave-guard-card">
        <h2 id="leave-guard-title">Есть несохранённые изменения</h2>
        <p>{save.isPending ? 'Сохраняем заметку перед переходом…' : save.isError ? 'Не удалось сохранить заметку. Можно повторить попытку или остаться на странице.' : !title.trim() ? 'Чтобы сохранить заметку, верните непустое название.' : 'Сохраняем заметку перед переходом…'}</p>
        <div className="toolbar-actions">
          {save.isError && title.trim() && <button className="primary" onClick={() => saveNote()}>Повторить сохранение</button>}
          <button className="ghost" onClick={() => blocker.reset()}>Остаться</button>
          <button className="danger ghost" onClick={() => blocker.proceed()}>Выйти без сохранения</button>
        </div>
      </div>
    </div>}
    <nav className="breadcrumb" aria-label="Путь к заметке">
      <Link to={`/app/notebooks/${initial.notebookId}`}>{notebook.data?.title ?? 'Записная книжка'}</Link><span aria-hidden="true">›</span><Link to={`/app/notes/${initial.id}`} aria-current="page">{title || 'Без названия'}</Link>
    </nav>
    <div className="editor-toolbar"><div className={`save-state ${save.isError ? 'failed' : ''}`} aria-live="polite">{save.isPending ? 'Сохраняем…' : save.isError ? 'Не сохранено' : dirty ? 'Есть изменения' : 'Сохранено'}</div><div className="toolbar-actions"><button className="primary" disabled={!dirty || !title.trim() || save.isPending} onClick={() => saveNote()}>Сохранить</button>{status.isPending ? <button className="ghost" disabled>Проверяем доступ…</button> : status.data?.enabled ? <button className="ghost" onClick={() => revoke.mutate()}>Отключить ссылку</button> : <button className="ghost" onClick={() => share.mutate()}>Поделиться</button>}<button className="danger ghost" onClick={() => { if (window.confirm('Удалить заметку? Это действие нельзя отменить.')) remove.mutate() }}>Удалить</button></div></div>
    {share.data?.url && <div className="share-banner" role="status">Ссылка скопирована: <a href={share.data.url} target="_blank" rel="noreferrer">открыть</a></div>}
    {error && <p className="error wide">{message(error)} {save.isError && <button onClick={() => save.mutate()}>Повторить</button>}</p>}
    <div className="editor-grid"><section className="writing"><label htmlFor="note-title">Название</label><input id="note-title" className="title-input" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /><div className="editor-label-row"><label htmlFor="note-content">Markdown</label><span>Выделите текст и выберите формат</span></div><MarkdownToolbar value={content} onChange={setContent} textareaRef={textareaRef} /><textarea ref={textareaRef} id="note-content" value={content} maxLength={1_048_576} onChange={e => setContent(e.target.value)} placeholder="Начните писать…" /></section><section className="preview" aria-label="Предпросмотр"><p className="eyebrow">Предпросмотр</p><Markdown>{previewContent}</Markdown></section></div>
  </main>
}
