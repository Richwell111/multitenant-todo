import { createContext, useContext } from 'react'
import type { Account } from './authService'
import type { LoginFormInput } from './loginSchemas'

export interface AuthState {
  status: 'loading' | 'ready'
  account: Account | null
  signIn: (input: LoginFormInput) => Promise<Account>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
