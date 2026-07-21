export const RESERVED_WORKSPACE_SLUGS = [
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'login',
  'register',
  'status',
  'support',
  'www',
] as const

export const LICENCE_KEY_PATTERN = /^TDO-[0-9A-F]{8}(?:-[0-9A-F]{8}){3}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

export function normalizeCompanyName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
}

export function suggestWorkspaceSlug(value: string): string {
  const ascii = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
  return ascii.slice(0, 63).replace(/-+$/gu, '')
}
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function normalizeWorkspaceSlug(value: string): string {
  return value.trim().toLowerCase()
}

export function validateCompanyName(value: string): string | null {
  const normalized = normalizeCompanyName(value)
  return normalized.length >= 1 && normalized.length <= 200 ? normalized : null
}

export function validateEmail(value: string): string | null {
  const normalized = normalizeEmail(value)
  return EMAIL_PATTERN.test(normalized) ? normalized : null
}

export function validateWorkspaceSlug(value: string):
  | { ok: true; value: string }
  | { ok: false; reason: 'invalid' | 'reserved' } {
  const normalized = normalizeWorkspaceSlug(value)
  if ((RESERVED_WORKSPACE_SLUGS as readonly string[]).includes(normalized)) {
    return { ok: false, reason: 'reserved' }
  }

  if (
    normalized.length < 3 ||
    normalized.length > 63 ||
    !SLUG_PATTERN.test(normalized) ||
    normalized.includes('--') ||
    normalized.startsWith('xn--')
  ) {
    return { ok: false, reason: 'invalid' }
  }

  return { ok: true, value: normalized }
}

export function canonicalizeLicenceKey(value: string): string | null {
  const canonical = value.trim().toUpperCase()
  return LICENCE_KEY_PATTERN.test(canonical) ? canonical : null
}

export function generateLicenceKey(
  fillRandom: (bytes: Uint8Array) => Uint8Array = (bytes) =>
    crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>),
): string {
  const bytes = fillRandom(new Uint8Array(16))
  if (bytes.length !== 16) {
    throw new Error('Random source must return exactly 16 bytes')
  }

  const hexadecimal = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('').toUpperCase()
  return `TDO-${hexadecimal.match(/.{8}/g)!.join('-')}`
}

export function licenceKeyPrefix(canonicalKey: string): string {
  return canonicalKey.slice(0, 12)
}

export async function sha256Hex(value: string): Promise<string> {
  const input = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export function expiryDateToInstant(
  value: string,
  now = new Date(),
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const start = new Date(Date.UTC(year, month - 1, day))
  if (
    start.getUTCFullYear() !== year ||
    start.getUTCMonth() !== month - 1 ||
    start.getUTCDate() !== day
  ) return null

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (start.getTime() < today) return null

  start.setUTCDate(start.getUTCDate() + 1)
  return start.toISOString()
}

export function companyNamesMatch(left: string, right: string): boolean {
  return normalizeCompanyName(left).toLocaleLowerCase('und') ===
    normalizeCompanyName(right).toLocaleLowerCase('und')
}

