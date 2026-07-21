import { createClient } from 'npm:@supabase/supabase-js@2.110.7'
import { handleGenerateLicence } from '../_shared/handlers.ts'
import { corsPreflight, withCors } from '../_shared/http.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return corsPreflight()
  if (!supabaseUrl || !anonKey) {
    return withCors(new Response(JSON.stringify({ code: 'INTERNAL_ERROR' }), { status: 500 }))
  }

  const authorization = request.headers.get('Authorization')
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  })

  const result = await handleGenerateLicence(request, {
    authorize: async () => {
      if (!authorization?.startsWith('Bearer ')) return 'unauthenticated'
      const { data: { user }, error } = await client.auth.getUser()
      if (error || !user) return 'unauthenticated'

      const { data: admin, error: adminError } = await client
        .from('platform_admins')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      return !adminError && admin?.id === user.id ? 'authorized' : 'forbidden'
    },
    insert: async (input) => {
      const { data, error } = await client
        .from('licences')
        .insert({
          company_name: input.companyName,
          key_hash: input.keyHash,
          key_prefix: input.keyPrefix,
          status: input.status,
          expires_at: input.expiresAt,
        })
        .select('id')
        .single()
      if (!error && data) return { kind: 'created', licence: data }
      return error?.code === '23505' ? { kind: 'collision' } : { kind: 'error' }
    },
    logger: (event, details) => console.info(JSON.stringify({ event, ...details })),
  })
  return withCors(result)
})
