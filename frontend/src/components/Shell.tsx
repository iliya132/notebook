import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { User } from '../types'
import { GlobalNoteSearch } from './GlobalNoteSearch'

export function Shell() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const account = useQuery({ queryKey: ['account'], queryFn: ({ signal }) => api<User>('/auth/me', { signal }), enabled: typeof window !== 'undefined' })
  const logout = useMutation({ mutationFn: () => api<void>('/auth/logout', { method: 'POST' }), onSuccess: () => { client.clear(); navigate('/login') } })
  const initials = account.data?.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('ru') || '…'
  return <div className="app-shell"><header className="app-header">
    <Link to="/app" className="brand" aria-label="Notebook — все записные книжки"><span className="brand-mark">N</span><span>Notebook</span></Link>
    <GlobalNoteSearch />
    <div className="account-area">
      <details className="account-menu">
      <summary className="account" aria-label="Открыть меню аккаунта">
        <span className="account-avatar" aria-hidden="true">{initials}</span>
        <span className="account-copy">{account.data ? <><strong>{account.data.name}</strong><small>{account.data.email}</small></> : <small>{account.isError ? 'Аккаунт недоступен' : 'Загружаем аккаунт…'}</small>}</span>
        <span className="menu-chevron" aria-hidden="true">⌄</span>
      </summary>
      <nav className="account-popover" aria-label="Меню аккаунта">
        <NavLink to="/app/profile">Профиль</NavLink>
        <NavLink to="/app/settings">Настройки</NavLink>
        <button type="button" disabled={logout.isPending} onClick={() => logout.mutate()}>{logout.isPending ? 'Выходим…' : 'Выйти'}</button>
      </nav>
      </details>
    </div>
  </header><Outlet /></div>
}
