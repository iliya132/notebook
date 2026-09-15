import { useRef, useState, type RefObject } from 'react'
import { applyMarkdownAction, EDITOR_SHORTCUTS, type MarkdownAction } from '../markdownFormatting'

type Selection = { start: number; end: number }

const actions: Array<{ action: MarkdownAction; label: string; glyph: string }> = [
  { action: 'heading1', label: 'Заголовок 1', glyph: 'H1' },
  { action: 'heading2', label: 'Заголовок 2', glyph: 'H2' },
  { action: 'bold', label: 'Жирный', glyph: 'B' },
  { action: 'italic', label: 'Курсив', glyph: 'I' },
  { action: 'strike', label: 'Зачёркнутый', glyph: 'S' },
  { action: 'inlineCode', label: 'Однострочный код', glyph: '<>' },
  { action: 'codeBlock', label: 'Блок кода', glyph: '{ }' },
  { action: 'link', label: 'Ссылка', glyph: '↗' },
  { action: 'quote', label: 'Цитата', glyph: '“' },
  { action: 'bulletList', label: 'Маркированный список', glyph: '•' },
  { action: 'numberedList', label: 'Нумерованный список', glyph: '1.' },
  { action: 'table', label: 'Таблица', glyph: '▦' },
  { action: 'divider', label: 'Горизонтальная линия', glyph: '―' },
]

export function MarkdownToolbar({ value, onChange, textareaRef }: { value: string; onChange: (value: string) => void; textareaRef: RefObject<HTMLTextAreaElement | null> }) {
  const pendingSelection = useRef<Selection | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const apply = (action: MarkdownAction) => {
    const textarea = textareaRef.current
    const selection = pendingSelection.current ?? {
      start: textarea?.selectionStart ?? value.length,
      end: textarea?.selectionEnd ?? value.length,
    }
    const edit = applyMarkdownAction(value, selection, action)
    onChange(edit.value)
    pendingSelection.current = null
    const restoreSelection = () => {
      textarea?.focus()
      textarea?.setSelectionRange(edit.start, edit.end)
    }
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(restoreSelection)
    else restoreSelection()
  }

  return <div className="markdown-toolbar" role="toolbar" aria-label="Панель форматирования">
    {actions.map(({ action, label, glyph }) => <button
      key={action}
      type="button"
      className={`format-button format-${action}`}
      aria-label={label}
      title={label}
      onMouseDown={event => {
        const textarea = textareaRef.current
        pendingSelection.current = { start: textarea?.selectionStart ?? value.length, end: textarea?.selectionEnd ?? value.length }
        event.preventDefault()
      }}
      onClick={() => apply(action)}
    >{glyph}</button>)}
    <div className="shortcut-help" onMouseEnter={() => setHelpOpen(true)} onMouseLeave={() => setHelpOpen(false)} onFocus={() => setHelpOpen(true)} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setHelpOpen(false)
    }}>
      <button type="button" className="shortcut-help-button" aria-label="Сочетания клавиш" aria-expanded={helpOpen} aria-controls="editor-shortcuts">?</button>
      <div id="editor-shortcuts" className="shortcut-tooltip" role="tooltip" hidden={!helpOpen}>
        <strong>Сочетания клавиш</strong>
        <dl>{EDITOR_SHORTCUTS.map(shortcut => <div key={shortcut.command}><dt>{shortcut.label}</dt><dd><kbd>{shortcut.keys}</kbd></dd></div>)}</dl>
      </div>
    </div>
  </div>
}
