export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'notebook-theme'
const THEME_EVENT = 'notebook-theme-change'

export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function subscribeToTheme(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyTheme(event.newValue === 'dark' ? 'dark' : 'light', false)
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(THEME_EVENT, listener)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(THEME_EVENT, listener)
  }
}

export function applyTheme(theme: Theme, persist = true): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111722' : '#1c2430')
  if (persist) {
    try { window.localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* Storage can be unavailable in privacy modes. */ }
    window.dispatchEvent(new Event(THEME_EVENT))
  }
}
