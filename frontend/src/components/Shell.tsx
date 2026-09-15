import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../api'

export function Shell() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const logout = useMutation({ mutationFn: () => api<void>('/auth/logout', { method: 'POST' }), onSuccess: () => { client.clear(); navigate('/login') } })
  return <div className="app-shell"><header><Link to="/app" className="brand">Notebook</Link><button className="ghost" onClick={() => logout.mutate()}>Выйти</button></header><Outlet /></div>
}
