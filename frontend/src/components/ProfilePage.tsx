import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, message } from '../api'
import { formatDate } from '../format'
import type { User } from '../types'

export function ProfilePage() {
  const account = useQuery({ queryKey: ['account'], queryFn: ({ signal }) => api<User>('/auth/me', { signal }), enabled: typeof window !== 'undefined' })
  const initials = account.data?.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('ru') || '…'

  return <main className="page account-page">
    <div className="page-heading"><div><p className="eyebrow">Аккаунт</p><h1>Профиль</h1><p className="muted">Основная информация вашей учётной записи.</p></div></div>
    {account.isPending ? <p className="state">Загружаем профиль…</p> : account.isError ? <p className="error">{message(account.error)}</p> : <section className="profile-card" aria-labelledby="profile-name">
      <div className="profile-summary"><span className="profile-avatar" aria-hidden="true">{initials}</span><div><h2 id="profile-name">{account.data.name}</h2><p>{account.data.email}</p></div></div>
      <dl className="profile-details">
        <div><dt>Имя</dt><dd>{account.data.name}</dd></div>
        <div><dt>Email</dt><dd>{account.data.email}</dd></div>
        <div><dt>Дата регистрации</dt><dd>{formatDate(account.data.createdAt)}</dd></div>
      </dl>
      <div className="profile-actions"><Link className="ghost button-link" to="/app/settings">Настройки интерфейса</Link></div>
    </section>}
  </main>
}
