import { createClient } from 'npm:@supabase/supabase-js@2.110.7'
import {
  companyNamesMatch,
  handleRegisterCompany,
  type RegistrationBusinessCode,
} from '../_shared/handlers.ts'
import { corsPreflight, withCors } from '../_shared/http.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const BUSINESS_CODES = new Set<RegistrationBusinessCode>([
  'INVALID_LICENCE', 'LICENCE_EXPIRED', 'LICENCE_UNAVAILABLE',
  'COMPANY_NAME_MISMATCH', 'EMAIL_IN_USE', 'SLUG_IN_USE', 'RESERVED_SLUG',
])

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return corsPreflight()
  if (!supabaseUrl || !serviceRoleKey) {
    return withCors(new Response(JSON.stringify({ code: 'INTERNAL_ERROR' }), { status: 500 }))
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const result = await handleRegisterCompany(request, {
    preflight: async (input) => {
      const { data: licence, error } = await admin
        .from('licences')
        .select('company_name,status,expires_at,redeemed_at,redeemed_by_company_id')
        .eq('key_hash', input.licenceKeyHash)
        .maybeSingle()
      if (error) return 'error'
      if (!licence) return 'INVALID_LICENCE'
      if (licence.status === 'expired' ||
        (licence.status === 'available' && Date.parse(licence.expires_at) <= Date.now())) {
        return 'LICENCE_EXPIRED'
      }
      if (licence.status !== 'available' || licence.redeemed_at || licence.redeemed_by_company_id) {
        return 'LICENCE_UNAVAILABLE'
      }
      if (!companyNamesMatch(input.companyName, licence.company_name)) return 'COMPANY_NAME_MISMATCH'

      const [emailResult, slugResult] = await Promise.all([
        admin.from('companies').select('id').eq('email', input.companyEmail).limit(1),
        admin.from('companies').select('id').eq('slug', input.workspaceSlug).limit(1),
      ])
      if (emailResult.error || slugResult.error) return 'error'
      if (emailResult.data.length > 0) return 'EMAIL_IN_USE'
      if (slugResult.data.length > 0) return 'SLUG_IN_USE'
      return 'ok'
    },
    createAuthUser: async (email, password) => {
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      })
      if (!error && data.user) return { kind: 'created', userId: data.user.id }
      const code = error?.code ?? ''
      const message = error?.message.toLowerCase() ?? ''
      if (code.includes('email') || message.includes('already') || message.includes('exists')) {
        return { kind: 'email-in-use' }
      }
      if (code.includes('password') || message.includes('password')) return { kind: 'invalid-password' }
      return { kind: 'error' }
    },
    complete: async (input) => {
      const { data, error } = await admin.rpc('complete_company_registration', {
        p_auth_user_id: input.authUserId,
        p_company_name: input.companyName,
        p_company_email: input.companyEmail,
        p_workspace_slug: input.workspaceSlug,
        p_licence_key_hash: input.licenceKeyHash,
      })
      if (!error && typeof data === 'string') return { kind: 'completed', workspaceSlug: data }
      const message = error?.message ?? ''
      if (BUSINESS_CODES.has(message as RegistrationBusinessCode)) {
        return { kind: 'rejected', code: message as RegistrationBusinessCode }
      }
      return { kind: 'ambiguous' }
    },
    reconcile: async (authUserId, licenceKeyHash) => {
      const [companyResult, licenceResult] = await Promise.all([
        admin.from('companies').select('slug').eq('id', authUserId).maybeSingle(),
        admin.from('licences').select('redeemed_by_company_id,status')
          .eq('key_hash', licenceKeyHash).maybeSingle(),
      ])
      if (companyResult.error || licenceResult.error) return { kind: 'inconsistent' }
      const company = companyResult.data
      const licence = licenceResult.data
      if (!company && licence?.redeemed_by_company_id !== authUserId) return { kind: 'absent' }
      if (company && licence?.status === 'redeemed' && licence.redeemed_by_company_id === authUserId) {
        return { kind: 'completed', workspaceSlug: company.slug }
      }
      return { kind: 'inconsistent' }
    },
    deleteAuthUser: async (userId) => {
      const { error } = await admin.auth.admin.deleteUser(userId, false)
      return !error
    },
    logger: (event, details) => console.info(JSON.stringify({ event, ...details })),
  })
  return withCors(result)
})
