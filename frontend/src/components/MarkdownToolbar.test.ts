import { describe, expect, it } from 'vitest'
import { applyMarkdownAction } from '../markdownFormatting'

describe('applyMarkdownAction', () => {
  it('wraps selected text and keeps the selection inside markers', () => {
    expect(applyMarkdownAction('Сделать важным', { start: 8, end: 14 }, 'bold')).toEqual({
      value: 'Сделать **важным**',
      start: 10,
      end: 16,
    })
  })

  it('formats every selected line as a numbered list', () => {
    expect(applyMarkdownAction('Первый\nВторой', { start: 0, end: 13 }, 'numberedList').value)
      .toBe('1. Первый\n2. Второй')
  })

  it('replaces an existing heading marker', () => {
    const source = '### Старый заголовок'
    expect(applyMarkdownAction(source, { start: 0, end: source.length }, 'heading2').value)
      .toBe('## Старый заголовок')
  })

  it('inserts a fenced code block around the selection', () => {
    expect(applyMarkdownAction('const answer = 42', { start: 0, end: 17 }, 'codeBlock').value)
      .toBe('```\nconst answer = 42\n```')
  })

  it('inserts a table template when there is no selection', () => {
    expect(applyMarkdownAction('', { start: 0, end: 0 }, 'table').value)
      .toContain('| Колонка 1 | Колонка 2 |')
  })
})
