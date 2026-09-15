import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY } from '../theme'
import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.dataset.theme = 'light'
  })

  it('selects and persists the dark theme', () => {
    render(<SettingsPage />)

    const dark = screen.getByRole('radio', { name: /Тёмная/ })
    fireEvent.click(dark)

    expect(dark).toBeChecked()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })
})
