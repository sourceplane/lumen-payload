import type { Access, FieldAccess, PayloadRequest } from 'payload'

type Role = 'admin' | 'editor'
type StaffUser = { collection?: string; role?: Role | null } | null | undefined

const roleOf = (user: StaffUser): Role | undefined =>
  user && (user.collection === undefined || user.collection === 'users') ? (user.role ?? undefined) : undefined

export const anyone: Access = () => true
// Boolean-only (not Access): Payload's `access.admin` must answer yes or no.
export const isStaff = ({ req: { user } }: { req: PayloadRequest }): boolean => Boolean(roleOf(user as StaffUser))
export const isAdmin: Access = ({ req: { user } }) => roleOf(user as StaffUser) === 'admin'
export const isAdminField: FieldAccess = ({ req: { user } }) => roleOf(user as StaffUser) === 'admin'

/** Staff see drafts; everyone else sees what is published. */
export const publishedOrStaff: Access = ({ req: { user } }) =>
  roleOf(user as StaffUser) ? true : { _status: { equals: 'published' } }

/** Anyone signed in reads their own account (a pending one too); admins read all. */
export const selfOrAdmin: Access = ({ req: { user } }) => {
  const u = user as (StaffUser & { id?: string }) | null
  if (roleOf(u) === 'admin') return true
  if (u?.id && (u.collection === undefined || u.collection === 'users')) return { id: { equals: u.id } }
  return false
}

/** Admins manage every account; an editor reads and edits their own. */
export const adminOrSelf: Access = ({ req: { user } }) => {
  const u = user as (StaffUser & { id?: string }) | null
  if (roleOf(u) === 'admin') return true
  if (u?.id && roleOf(u)) return { id: { equals: u.id } }
  return false
}
