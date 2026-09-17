import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ error: 'Server configuration or authorization is missing.' }, 401)
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authData, error: authError } = await callerClient.auth.getUser()
  if (authError || !authData.user) {
    return json({ error: 'Authentication required.' }, 401)
  }

  const { data: staff, error: staffError } = await adminClient
    .from('profiles')
    .select('agency_id, role')
    .eq('id', authData.user.id)
    .single()

  if (staffError || !staff?.agency_id || !['dispatcher', 'admin'].includes(staff.role)) {
    return json({ error: 'Agency staff permission required.' }, 403)
  }

  const body = await request.json()
  const riderId = String(body.riderId ?? '')
  const password = String(body.password ?? '')
  if (!riderId || password.length < 8) {
    return json({ error: 'Rider and an 8-character password are required.' }, 400)
  }

  const { data: rider, error: riderError } = await adminClient
    .from('profiles')
    .select('id, agency_id, role')
    .eq('id', riderId)
    .single()

  if (
    riderError
    || rider?.role !== 'rider'
    || rider.agency_id !== staff.agency_id
  ) {
    return json({ error: 'Rider was not found in your agency.' }, 404)
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(rider.id, {
    password,
  })
  if (updateError) {
    return json({ error: updateError.message }, 400)
  }

  return json({ updated: true })
})
