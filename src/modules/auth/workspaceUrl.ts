import { validateWorkspaceSlug } from '../../../supabase/functions/_shared/licence.ts'

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

/**
 * Local development uses one origin, so a workspace is a path and the session
 * stays where it is. Production uses a Company subdomain, which is a different
 * origin and therefore an absolute URL.
 *
 * A result starting with "/" is a same-origin path the router can navigate to.
 * Anything else is a cross-origin URL needing a full page navigation.
 */
export function buildWorkspaceUrl(
  slugInput: string,
  location: Pick<Location, 'protocol' | 'hostname' | 'port'> = window.location,
  productionBaseDomain = import.meta.env.VITE_WORKSPACE_BASE_DOMAIN,
): string {
  const slug = validateWorkspaceSlug(slugInput)
  if (!slug.ok) throw new Error('Invalid workspace slug')
  if (isLocalHost(location.hostname)) return `/workspace/${slug.value}`

  const baseDomain = productionBaseDomain?.trim().toLowerCase().replace(/^\.+|\.+$/g, '')
  if (!baseDomain || !/^[a-z0-9.-]+$/.test(baseDomain)) {
    throw new Error('Workspace base domain is missing or invalid')
  }
  return `https://${slug.value}.${baseDomain}`
}

export function isSameOriginPath(destination: string): boolean {
  return destination.startsWith('/')
}
