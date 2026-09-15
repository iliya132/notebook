export type MarkdownAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'heading1'
  | 'heading2'
  | 'quote'
  | 'bulletList'
  | 'numberedList'
  | 'link'
  | 'inlineCode'
  | 'codeBlock'
  | 'table'
  | 'divider'

export type EditorShortcutCommand = 'save' | MarkdownAction

export type EditorShortcut = {
  command: EditorShortcutCommand
  label: string
  keys: string
  code: string
  shift?: boolean
}

export const EDITOR_SHORTCUTS: EditorShortcut[] = [
  { command: 'save', label: 'Сохранить заметку', keys: 'Ctrl/⌘ + S', code: 'KeyS' },
  { command: 'bold', label: 'Жирный', keys: 'Ctrl/⌘ + B', code: 'KeyB' },
  { command: 'italic', label: 'Курсив', keys: 'Ctrl/⌘ + I', code: 'KeyI' },
  { command: 'link', label: 'Ссылка', keys: 'Ctrl/⌘ + K', code: 'KeyK' },
  { command: 'inlineCode', label: 'Однострочный код', keys: 'Ctrl/⌘ + E', code: 'KeyE' },
  { command: 'strike', label: 'Зачёркнутый', keys: 'Ctrl/⌘ + Shift + X', code: 'KeyX', shift: true },
  { command: 'numberedList', label: 'Нумерованный список', keys: 'Ctrl/⌘ + Shift + 7', code: 'Digit7', shift: true },
  { command: 'bulletList', label: 'Маркированный список', keys: 'Ctrl/⌘ + Shift + 8', code: 'Digit8', shift: true },
  { command: 'quote', label: 'Цитата', keys: 'Ctrl/⌘ + Shift + .', code: 'Period', shift: true },
]

type ShortcutEvent = Pick<KeyboardEvent, 'altKey' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey'>

export function editorShortcutFor(event: ShortcutEvent): EditorShortcutCommand | null {
  if ((!event.ctrlKey && !event.metaKey) || event.altKey) return null
  return EDITOR_SHORTCUTS.find(shortcut => shortcut.code === event.code && Boolean(shortcut.shift) === event.shiftKey)?.command ?? null
}

type Selection = { start: number; end: number }
export type MarkdownEdit = Selection & { value: string }

function replaceSelection(value: string, selection: Selection, replacement: string, innerStart = 0, innerLength = replacement.length): MarkdownEdit {
  return {
    value: value.slice(0, selection.start) + replacement + value.slice(selection.end),
    start: selection.start + innerStart,
    end: selection.start + innerStart + innerLength,
  }
}

function wrap(value: string, selection: Selection, before: string, after: string, placeholder: string): MarkdownEdit {
  const selected = value.slice(selection.start, selection.end) || placeholder
  return replaceSelection(value, selection, `${before}${selected}${after}`, before.length, selected.length)
}

function selectedLines(value: string, selection: Selection) {
  const start = value.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1
  const nextBreak = value.indexOf('\n', selection.end)
  const end = nextBreak === -1 ? value.length : nextBreak
  return { start, end, text: value.slice(start, end) }
}

function prefixLines(value: string, selection: Selection, prefix: (index: number) => string): MarkdownEdit {
  const lines = selectedLines(value, selection)
  const source = lines.text || 'Текст'
  const formatted = source.split('\n').map((line, index) => `${prefix(index)}${line}`).join('\n')
  return replaceSelection(value, { start: lines.start, end: lines.end }, formatted)
}

function heading(value: string, selection: Selection, level: 1 | 2): MarkdownEdit {
  const lines = selectedLines(value, selection)
  const source = lines.text || 'Заголовок'
  const formatted = source.split('\n').map(line => `${'#'.repeat(level)} ${line.replace(/^#{1,6}\s+/, '')}`).join('\n')
  return replaceSelection(value, { start: lines.start, end: lines.end }, formatted)
}

function block(value: string, selection: Selection, contents: string, selectedStart: number, selectedLength: number): MarkdownEdit {
  const beforeBreak = selection.start > 0 && value[selection.start - 1] !== '\n' ? '\n\n' : ''
  const afterBreak = selection.end < value.length && value[selection.end] !== '\n' ? '\n\n' : ''
  return replaceSelection(value, selection, `${beforeBreak}${contents}${afterBreak}`, beforeBreak.length + selectedStart, selectedLength)
}

export function applyMarkdownAction(value: string, selection: Selection, action: MarkdownAction): MarkdownEdit {
  const selected = value.slice(selection.start, selection.end)
  switch (action) {
    case 'bold': return wrap(value, selection, '**', '**', 'жирный текст')
    case 'italic': return wrap(value, selection, '*', '*', 'курсив')
    case 'strike': return wrap(value, selection, '~~', '~~', 'зачёркнутый текст')
    case 'heading1': return heading(value, selection, 1)
    case 'heading2': return heading(value, selection, 2)
    case 'quote': return prefixLines(value, selection, () => '> ')
    case 'bulletList': return prefixLines(value, selection, () => '- ')
    case 'numberedList': return prefixLines(value, selection, index => `${index + 1}. `)
    case 'link': return wrap(value, selection, '[', '](https://)', 'текст ссылки')
    case 'inlineCode': return wrap(value, selection, '`', '`', 'код')
    case 'codeBlock': {
      const code = selected || 'код'
      return block(value, selection, `\`\`\`\n${code}\n\`\`\``, 4, code.length)
    }
    case 'table': {
      const table = '| Колонка 1 | Колонка 2 |\n| --- | --- |\n| Значение | Значение |'
      return block(value, selection, table, 2, 'Колонка 1'.length)
    }
    case 'divider': return block(value, selection, '---', 0, 3)
  }
}
