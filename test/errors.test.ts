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

/**
 * The API's error envelope is `{ status: 'error', message, code? }` — `status`
 * is the literal string 'error', not the HTTP code, and `code` is a machine
 * token clients branch on. These pin that the existing tolerant reader handles
 * that envelope; no behavior here changed with it.
 */
describe('toToolErrorResult against the {status, message, code} error envelope', () => {
  it('surfaces the message from a 401 envelope without treating it as a plan limit', () => {
    const result = toToolErrorResult(
      new DrumbeatsApiError(401, 'Unauthorized', {
        status: 'error',
        message: 'Unauthorized',
        code: 'UNAUTHENTICATED',
      })
    )
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('HTTP 401')
    expect(textOf(result)).toContain('DRUMBEATS_API_KEY')
    expect(textOf(result)).toContain('Unauthorized')
    expect(textOf(result)).not.toContain('pricing')
  })

  it('surfaces the message from a 400 envelope that carries no code', () => {
    const result = toToolErrorResult(
      new DrumbeatsApiError(400, 'Bad Request', { status: 'error', message: 'url must be http(s)' })
    )
    expect(textOf(result)).toContain('HTTP 400')
    expect(textOf(result)).toContain('url must be http(s)')
    expect(textOf(result)).not.toContain('pricing')
  })

  it('still detects a plan limit from the envelope code on a non-limit status', () => {
    const result = toToolErrorResult(
      new DrumbeatsApiError(403, 'Forbidden', {
        status: 'error',
        message: 'Monitor limit reached',
        code: 'PLAN_LIMIT_REACHED',
      })
    )
    expect(textOf(result)).toContain('drumbeats.io/pricing')
    expect(textOf(result)).toContain('Monitor limit reached')
  })

  it("does not read the envelope's literal 'error' status as a detail string", () => {
    const result = toToolErrorResult(new DrumbeatsApiError(500, 'Server Error', { status: 'error' }))
    expect(textOf(result)).toContain('HTTP 500')
    expect(textOf(result)).toContain('temporarily unavailable')
    expect(textOf(result)).not.toMatch(/\berror\b\.?$/)
  })
})
