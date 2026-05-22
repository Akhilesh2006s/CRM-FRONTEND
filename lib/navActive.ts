/** True when this child nav link should show as active (longest matching sibling wins). */
export function isChildNavActive(
  pathname: string,
  href: string,
  siblings: { href?: string }[]
): boolean {
  if (pathname === href) return true

  // Catalog list routes should not stay active on nested product admin pages
  const exactMatchOnly = ['/dashboard/products']
  if (exactMatchOnly.includes(href)) return false

  if (href === '/dashboard' || !pathname.startsWith(`${href}/`)) return false

  const hasBetterMatch = siblings.some((other) => {
    if (!other.href || other.href === href) return false
    if (other.href.length <= href.length) return false
    return pathname === other.href || pathname.startsWith(`${other.href}/`)
  })

  return !hasBetterMatch
}
