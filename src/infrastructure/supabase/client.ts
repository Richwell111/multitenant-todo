import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | undefined

export function getSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase browser configuration is missing')
  browserClient = createClient(url, anonKey)
  return browserClient
}
