import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { api, message } from '../api'
import type { User } from '../types'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const schema = z.object({
    email: z.email('Введите корректный email'),
    password: mode === 'register' ? z.string().min(10, 'Минимум 10 символов').max(128) : z.string().min(1, 'Введите пароль'),
    name: mode === 'register' ? z.string().trim().min(1, 'Введите имя').max(100) : z.string().optional(),
  })
  type Values = z.infer<typeof schema>
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values: Values) => api<User>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: (user) => { queryClient.setQueryData(['me'], user); navigate('/app') },
  })
  return <main className="auth-page"><section className="auth-card">
    <Link className="brand" to="/">Notebook</Link>
    <h1>{mode === 'login' ? 'С возвращением' : 'Создать аккаунт'}</h1>
    <p className="muted">Ваши мысли, собранные в одном спокойном месте.</p>
    <form onSubmit={handleSubmit(values => mutation.mutate(values))}>
      {mode === 'register' && <label>Имя<input autoComplete="name" {...register('name')} />{errors.name && <span className="field-error">{errors.name.message}</span>}</label>}
      <label>Email<input type="email" autoComplete="email" {...register('email')} />{errors.email && <span className="field-error">{errors.email.message}</span>}</label>
      <label>Пароль<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} {...register('password')} />{errors.password && <span className="field-error">{errors.password.message}</span>}</label>
      {mutation.isError && <p role="alert" className="error">{message(mutation.error)}</p>}
      <button className="primary" disabled={mutation.isPending}>{mutation.isPending ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
    </form>
    <p className="switch">{mode === 'login' ? <>Нет аккаунта? <Link to="/register">Регистрация</Link></> : <>Уже зарегистрированы? <Link to="/login">Войти</Link></>}</p>
  </section></main>
}
