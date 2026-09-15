import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import { ProfilePage } from './ProfilePage'

vi.mock('../api', async importOriginal => {
  const original = await importOriginal<typeof import('../api')>()
  return { ...original, api: vi.fn() }
})

describe('ProfilePage', () => {
  afterEach(() => vi.clearAllMocks())

  it('shows the current user details', async () => {
    vi.mocked(api).mockResolvedValue({ id: 'user-1', name: 'Анна Смирнова', email: 'anna@example.test', createdAt: '2026-09-15T00:00:00Z' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(<QueryClientProvider client={client}><MemoryRouter><ProfilePage /></MemoryRouter></QueryClientProvider>)

    expect(await screen.findByRole('heading', { name: 'Анна Смирнова' })).toBeInTheDocument()
    expect(screen.getAllByText('anna@example.test')).toHaveLength(2)
    expect(screen.getByText(/15 сент.*2026/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Настройки интерфейса' })).toHaveAttribute('href', '/app/settings')
  })
})
