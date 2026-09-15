import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import { Shell } from './Shell'

vi.mock('../api', async importOriginal => {
  const original = await importOriginal<typeof import('../api')>()
  return { ...original, api: vi.fn() }
})

describe('Shell', () => {
  afterEach(() => vi.clearAllMocks())

  it('opens account navigation with profile, settings and logout', async () => {
    vi.mocked(api).mockImplementation(async path => {
      if (path === '/auth/me') return { id: 'user-1', name: 'Анна Смирнова', email: 'anna@example.test', createdAt: '2026-09-15T00:00:00Z' }
      throw new Error(`Unexpected API call: ${path}`)
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter([{
      path: '/app',
      element: <Shell />,
      children: [{ index: true, element: <h1>Книжки</h1> }],
    }], { initialEntries: ['/app'] })

    render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)

    expect(await screen.findByText('Анна Смирнова')).toBeInTheDocument()
    expect(screen.getByText('anna@example.test')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Открыть меню аккаунта'))
    expect(screen.getByRole('link', { name: 'Профиль' })).toHaveAttribute('href', '/app/profile')
    expect(screen.getByRole('link', { name: 'Настройки' })).toHaveAttribute('href', '/app/settings')
    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument()
  })
})
