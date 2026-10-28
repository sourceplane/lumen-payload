import type { NotificationCategoryPreferences } from '@saas/contracts/notifications'

import { staffRoleOf } from '../access'
import { updatePreferences, updateProfile } from './account-api'
import type { LumenTransport } from './client'
import { isSameOrigin, LUMEN_SESSION_COOKIE, readCookie } from './cookies'
import { DISPLAY_NAME_MAX, toDisplayNameValue, validateDisplayName } from './models/profile'
import { PREFERENCE_CATEGORIES } from './models/preferences'

// The CMS route handlers behind the account pages' forms (design §4): each
// accepts a same-origin form post from a signed-in admin or editor, calls
// api-edge with their session, and answers 303 back to the page with a
// status the page shows. Pure: the routes inject Payload and the transport.

export const ACCOUNT_PAGES = {
  profile: '/admin/account',
  security: '/admin/account/security',
  organization: '/admin/organization',
  notifications: '/admin/organization/notifications',
} as const

export type FormUser = { id: string | number; role?: string | null; lumenUserId?: string | null; collection?: string }

export type FormDeps = {
  transport: () => Promise<LumenTransport>
  /** The Payload user the request's cookie signs in, or null. */
  authenticate: (headers: Headers) => Promise<FormUser | null>
  /** Keep the CMS's copy of the display name in step (users.name). */
  syncName?: (userId: FormUser['id'], name: string | null) => Promise<void>
}

const seeOther = (location: string) =>
  new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store' } })

/** Where a form goes back to, with what happened. */
export function backTo(page: string, outcome: { saved: true } | { error: string }, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra)
  if ('saved' in outcome) params.set('saved', '1')
  else params.set('error', outcome.error)
  return `${page}?${params.toString()}`
}

type Action = (input: { form: FormData; token: string; user: FormUser; transport: LumenTransport }) => Promise<
  { location: string }
>

async function handle(request: Request, deps: FormDeps, page: string, action: Action): Promise<Response> {
  if (!isSameOrigin(request.headers, request.url)) {
    return new Response('Forbidden: this form only accepts posts from the CMS itself.\n', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  const token = readCookie(request.headers, LUMEN_SESSION_COOKIE)
  const user = token ? await deps.authenticate(request.headers) : null
  if (!token || !user) return seeOther(`/admin/login?redirect=${encodeURIComponent(page)}`)
  if (!staffRoleOf(user)) return seeOther('/admin/unauthorized')
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return seeOther(backTo(page, { error: 'bad_request' }))
  }
  const { location } = await action({ form, token, user, transport: await deps.transport() })
  return seeOther(location)
}

/** POST /lumen/profile: the display name. */
export function profileForm(request: Request, deps: FormDeps): Promise<Response> {
  const page = ACCOUNT_PAGES.profile
  return handle(request, deps, page, async ({ form, token, user, transport }) => {
    const raw = String(form.get('displayName') ?? '')
    if (!validateDisplayName(raw).ok) return { location: backTo(page, { error: 'too_long' }) }
    const displayName = toDisplayNameValue(raw)
    const result = await updateProfile(transport, token, { displayName })
    if (result.ok === false) return { location: backTo(page, { error: result.code }) }
    await deps.syncName?.(user.id, result.value.displayName ?? null)
    return { location: backTo(page, { saved: true }) }
  })
}

/** The categories a notifications form asks for: a ticked box delivers, an unticked one does not. */
export function categoriesFromForm(form: FormData): NotificationCategoryPreferences {
  const categories: NotificationCategoryPreferences = {}
  for (const { key } of PREFERENCE_CATEGORIES) categories[key] = form.get(key) === 'on'
  return categories
}

/** POST /lumen/notifications: email categories for one organization. */
export function notificationsForm(request: Request, deps: FormDeps): Promise<Response> {
  const page = ACCOUNT_PAGES.notifications
  return handle(request, deps, page, async ({ form, token, user, transport }) => {
    const orgId = String(form.get('orgId') ?? '')
    const back = orgId ? { org: orgId } : undefined
    if (!orgId || !user.lumenUserId) return { location: backTo(page, { error: 'bad_request' }, back) }
    const result = await updatePreferences(transport, token, {
      orgId,
      userId: user.lumenUserId,
      categories: categoriesFromForm(form),
    })
    return { location: backTo(page, result.ok === false ? { error: result.code } : { saved: true }, back) }
  })
}

export { DISPLAY_NAME_MAX }
