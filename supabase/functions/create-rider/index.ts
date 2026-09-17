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
  const username = String(body.username ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
  const password = String(body.password ?? '')
  const fullName = String(body.fullName ?? '').trim()

  if (!username || !fullName || password.length < 8) {
    return json({ error: 'Username, full name, and an 8-character password are required.' }, 400)
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: `${username}@login.accessride.local`,
    password,
    email_confirm: true,
    user_metadata: { username, role: 'rider' },
  })

  if (createError || !created.user) {
    return json({ error: createError?.message ?? 'Unable to create authentication account.' }, 400)
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .insert({
      id: created.user.id,
      agency_id: staff.agency_id,
      role: 'rider',
      username,
      full_name: fullName,
      date_of_birth: body.dateOfBirth || null,
      phone: body.phone || null,
      address: body.address || null,
      emergency_contact_name: body.emergencyContactName || null,
      emergency_contact_phone: body.emergencyContactPhone || null,
      mobility_needs: body.mobilityNeeds || null,
      communication_preference: body.communicationPreference || 'text',
      status: 'active',
    })
    .select()
    .single()

  if (profileError) {
    await adminClient.auth.admin.deleteUser(created.user.id)
    return json({ error: profileError.message }, 400)
  }

  return json({ profile }, 201)
})
