import { describe, expect, it } from 'vitest'
import { DrumbeatsApiError, toToolErrorResult } from '../src/api/errors'

function textOf(result: ReturnType<typeof toToolErrorResult>): string {
  const first = result.content[0]
  return first && first.type === 'text' ? first.text : ''
}

describe('toToolErrorResult upgrade prompts', () => {
  it('returns an isError result (not a thrown auth failure) for a 402', () => {
    const result = toToolErrorResult(new DrumbeatsApiError(402, 'Payment Required'))
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('drumbeats.io/pricing')
    expect(textOf(result)).toMatch(/plan limit/i)
  })

  it('surfaces the upgrade path for a 429 quota response', () => {
    const result = toToolErrorResult(new DrumbeatsApiError(429, 'Too Many Requests'))
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('https://drumbeats.io/pricing')
  })

  it('treats a body-signalled plan limit as an upgrade prompt even on a 403', () => {
    const result = toToolErrorResult(
      new DrumbeatsApiError(403, 'Forbidden', { code: 'PLAN_LIMIT_REACHED', message: 'Monitor limit reached' })
    )
    expect(textOf(result)).toContain('drumbeats.io/pricing')
  })

  it('does not attach an upgrade prompt to an ordinary 400', () => {
    const result = toToolErrorResult(new DrumbeatsApiError(400, 'Bad Request', { message: 'invalid url' }))
    expect(textOf(result)).not.toContain('pricing')
    expect(textOf(result)).toContain('HTTP 400')
  })

  it('does not attach an upgrade prompt to a 401', () => {
    const result = toToolErrorResult(new DrumbeatsApiError(401, 'Unauthorized'))
    expect(textOf(result)).not.toContain('pricing')
  })
})
