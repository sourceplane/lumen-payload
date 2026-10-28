// What the account pages say after a form or a failed read (design §4).
// api-edge's error codes become sentences; anything unknown is reported as is.

const MESSAGES: Record<string, string> = {
  too_long: 'That name is too long. Keep it under 80 characters.',
  bad_request: 'The form was incomplete. Reload the page and try again.',
  unauthenticated: 'Your session ended. Sign in again.',
  forbidden: 'Your account is not allowed to do that.',
  not_found: 'Lumen does not have that any more. Reload the page.',
  rate_limited: 'Too many requests just now. Wait a minute and try again.',
  validation_failed: 'Lumen refused the change. Check the values and try again.',
  conflict: 'Something changed at the same time. Reload the page and try again.',
  internal_error: 'Lumen had a problem. Try again in a moment.',
  unreachable: 'The CMS could not reach Lumen. Try again in a moment.',
}

export type Status = { kind: 'saved' | 'error'; text: string }

export function statusMessage(query: { saved?: string | undefined; error?: string | undefined }): Status | null {
  if (query.error) {
    const code = query.error.replace(/[^a-z0-9_.-]/gi, '').slice(0, 64)
    // Own keys only: `?error=constructor` must not reach the page as a function.
    const known = Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : undefined
    return { kind: 'error', text: known ?? `Lumen answered with an error (${code || 'unknown'}).` }
  }
  if (query.saved === '1') return { kind: 'saved', text: 'Saved.' }
  return null
}
