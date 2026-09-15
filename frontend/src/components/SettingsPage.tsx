import { useSyncExternalStore } from 'react'
import { applyTheme, currentTheme, subscribeToTheme, type Theme } from '../theme'

const choices: { value: Theme; title: string; description: string }[] = [
  { value: 'light', title: 'Светлая', description: 'Светлый фон для работы днём.' },
  { value: 'dark', title: 'Тёмная', description: 'Приглушённые цвета для работы вечером.' },
]

export function SettingsPage() {
  const theme = useSyncExternalStore(subscribeToTheme, currentTheme, () => 'light')

  return <main className="page account-page">
    <div className="page-heading"><div><p className="eyebrow">Персонализация</p><h1>Настройки</h1><p className="muted">Выбранная тема сохранится в этом браузере.</p></div></div>
    <section className="settings-card" aria-labelledby="theme-heading">
      <div><h2 id="theme-heading">Тема оформления</h2><p className="muted">Выберите комфортный вид Notebook.</p></div>
      <div className="theme-options" role="radiogroup" aria-labelledby="theme-heading">
        {choices.map(choice => <label className={`theme-option${theme === choice.value ? ' selected' : ''}`} key={choice.value}>
          <input type="radio" name="theme" value={choice.value} checked={theme === choice.value} onChange={() => applyTheme(choice.value)} />
          <span className={`theme-preview ${choice.value}`} aria-hidden="true"><i /><i /><i /></span>
          <span><strong>{choice.title}</strong><small>{choice.description}</small></span>
        </label>)}
      </div>
    </section>
  </main>
}
