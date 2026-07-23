import { useOutletContext } from 'react-router-dom'
import type { Account } from '../auth/authService'

export type PlatformAdminAccount = Extract<Account, { kind: 'platform-admin' }>

export type AdminOutletContext = {
  account: PlatformAdminAccount
  signOut: () => Promise<void>
}

// Nested Admin pages read the authenticated Platform Admin account and the logout
// action from the shared protected layout, so no page re-runs the auth guard.
export function useAdminOutlet(): AdminOutletContext {
  return useOutletContext<AdminOutletContext>()
}
