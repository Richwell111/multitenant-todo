import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '../../infrastructure/supabase/client'
import { AuthContext } from './authContext'
import {
  resolveAccount,
  restoreSession,
  signIn as serviceSignIn,
  signOut as serviceSignOut,
  type Account,
} from './authService'
import type { LoginFormInput } from './loginSchemas'

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [account, setAccount] = useState<Account | null>(null)

  useEffect(() => {
    let active = true
    let revision = 0
    const initialRevision = revision
    let unsubscribe: (() => void) | undefined

    function resolveAuthEvent(userId: string, eventRevision: number) {
      setStatus('loading')
      void Promise.resolve().then(async () => {
        try {
          const resolved = await resolveAccount(userId)
          if (!resolved) await serviceSignOut()
          if (!active || eventRevision !== revision) return
          setAccount(resolved)
          setStatus('ready')
        } catch {
          if (!active || eventRevision !== revision) return
          setAccount(null)
          setStatus('ready')
        }
      })
    }

    try {
      const { data } = getSupabaseClient().auth.onAuthStateChange((event, session) => {
        if (!active) return
        revision += 1
        const eventRevision = revision
        if (event === 'SIGNED_OUT' || !session) {
          setAccount(null)
          setStatus('ready')
          return
        }
        resolveAuthEvent(session.user.id, eventRevision)
      })
      unsubscribe = () => data.subscription.unsubscribe()
    } catch {
      // The initial restore path still provides a safe signed-out state when
      // browser Supabase configuration is unavailable.
    }

    restoreSession()
      .then((restored) => {
        if (!active || revision !== initialRevision) return
        setAccount(restored)
        setStatus('ready')
      })
      .catch(() => {
        if (!active || revision !== initialRevision) return
        setAccount(null)
        setStatus('ready')
      })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  const signIn = useCallback(async (input: LoginFormInput) => {
    const resolved = await serviceSignIn(input)
    setAccount(resolved)
    return resolved
  }, [])

  const signOut = useCallback(async () => {
    await serviceSignOut()
    setAccount(null)
  }, [])

  const value = useMemo(
    () => ({ status, account, signIn, signOut }),
    [status, account, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider