const date = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeZone: 'UTC' })
const dateTime = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

export function formatDate(value: string): string {
  return date.format(new Date(value))
}

export function formatDateTime(value: string): string {
  return `${dateTime.format(new Date(value))} UTC`
}
