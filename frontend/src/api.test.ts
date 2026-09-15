import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
  performance.clearMeasures()
})

describe('API performance metrics', () => {
  it('records client request time without putting resource identifiers in the metric name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })))

    await api('/notes/private-note-id')

    const metrics = performance.getEntriesByType('measure').filter(entry => entry.name.startsWith('notebook:api:'))
    expect(metrics).toHaveLength(1)
    expect(metrics[0].name).toBe('notebook:api:GET /notes/:id')
    expect(metrics[0].name).not.toContain('private-note-id')
  })
})
