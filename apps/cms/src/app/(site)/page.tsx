import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// The product's front door is the admin (lumen-payload-console design §5).
// Content is still served from /api and /api/graphql.
export default function Home(): never {
  redirect('/admin')
}
