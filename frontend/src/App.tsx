import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { api, message } from './api'
import type { ApiError, User } from './types'

const AuthPage = lazy(() => import('./components/AuthPage').then(module => ({ default: module.AuthPage })))
const NotebookPage = lazy(() => import('./components/NotebookPage').then(module => ({ default: module.NotebookPage })))
const NotebooksPage = lazy(() => import('./components/NotebooksPage').then(module => ({ default: module.NotebooksPage })))
const NotePage = lazy(() => import('./components/NotePage').then(module => ({ default: module.NotePage })))
const PublicPage = lazy(() => import('./components/PublicPage').then(module => ({ default: module.PublicPage })))
const Shell = lazy(() => import('./components/Shell').then(module => ({ default: module.Shell })))

function Protected() {
  const me = useQuery({ queryKey: ['me'], queryFn: ({ signal }) => api<User>('/auth/me', { signal }), retry: false })
  if (me.isPending) return <main className="auth-page"><p className="state">Проверяем сессию…</p></main>
  if (me.isError) {
    const status = typeof me.error === 'object' && me.error !== null && 'status' in me.error
      ? (me.error as Partial<ApiError>).status
      : undefined
    if (status === 401) return <Navigate to="/login" replace />
    return <main className="auth-page"><p className="error">{message(me.error)}</p></main>
  }
  return <Outlet />
}

export default function App() {
  return <Suspense fallback={<main className="auth-page"><p className="state">Открываем страницу…</p></main>}><Routes>
    <Route path="/" element={<Navigate to="/app" replace />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/share/:token" element={<PublicPage />} />
    <Route element={<Protected />}><Route element={<Shell />}><Route path="/app" element={<NotebooksPage />} /><Route path="/app/notebooks/:notebookId" element={<NotebookPage />} /><Route path="/app/notes/:noteId" element={<NotePage />} /></Route></Route>
    <Route path="*" element={<Navigate to="/app" replace />} />
  </Routes></Suspense>
}
