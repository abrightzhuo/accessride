import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, content-type, x-bootstrap-token',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const expectedToken = Deno.env.get('BOOTSTRAP_TOKEN')
  const suppliedToken = request.headers.get('x-bootstrap-token')
  if (!expectedToken || suppliedToken !== expectedToken) {
    return json({ error: 'Invalid bootstrap token.' }, 403)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server configuration is missing.' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .in('role', ['dispatcher', 'admin'])
  if ((count ?? 0) > 0) {
    return json({ error: 'Agency administrator already exists.' }, 409)
  }

  const body = await request.json()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (!email || password.length < 8) {
    return json({ error: 'A valid email and 8-character password are required.' }, 400)
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'admin' },
  })
  if (error || !data.user) {
    return json({ error: error?.message ?? 'Unable to create agency administrator.' }, 400)
  }

  return json({ created: true, user_id: data.user.id }, 201)
})
