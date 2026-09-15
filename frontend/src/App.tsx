import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { api } from './api'
import type { User } from './types'
import { AuthPage } from './components/AuthPage'
import { NotebookPage } from './components/NotebookPage'
import { NotebooksPage } from './components/NotebooksPage'
import { NotePage } from './components/NotePage'
import { PublicPage } from './components/PublicPage'
import { Shell } from './components/Shell'

function Protected() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me'), retry: false })
  if (me.isPending) return <main className="auth-page"><p className="state">Проверяем сессию…</p></main>
  return me.isError ? <Navigate to="/login" replace /> : <Outlet />
}

export default function App() {
  return <Routes>
    <Route path="/" element={<Navigate to="/app" replace />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/share/:token" element={<PublicPage />} />
    <Route element={<Protected />}><Route element={<Shell />}><Route path="/app" element={<NotebooksPage />} /><Route path="/app/notebooks/:notebookId" element={<NotebookPage />} /><Route path="/app/notes/:noteId" element={<NotePage />} /></Route></Route>
    <Route path="*" element={<Navigate to="/app" replace />} />
  </Routes>
}
