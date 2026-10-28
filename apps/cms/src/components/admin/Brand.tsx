// The product's mark in the admin (lumen-payload-console design §5): the name
// from .rebrand/values.json ("Lumen Payload") beside a simple glyph, drawn in
// the admin's own text colour so it follows the light and dark themes.

function Glyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M8 6.5v11h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** The sign-in and loading screens' logo. */
export function Logo() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--theme-text)', fontSize: 22, fontWeight: 600 }}>
      <Glyph size={30} />
      Lumen Payload
    </span>
  )
}

/** The nav's icon. */
export function Icon() {
  return (
    <span style={{ color: 'var(--theme-text)', display: 'inline-flex' }} title="Lumen Payload">
      <Glyph size={24} />
    </span>
  )
}
