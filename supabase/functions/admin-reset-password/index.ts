// ═══════════════════════════════════════════════════════════════════════════
//  admin-reset-password  —  Supabase Edge Function
//
//  Only an admin can call this. It resets another user's password using the
//  service-role key, which stays on Supabase's servers and NEVER reaches the
//  browser. This is the only safe way to let an admin reset passwords.
//
//  Deploy:  supabase functions deploy admin-reset-password
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Who is calling?
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await caller.auth.getUser();
    if (userErr || !user) return json({ error: 'Invalid session' }, 401);

    // 2. Are they actually an admin?
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profile } = await admin
      .from('profiles').select('role').eq('id', user.id).single();

    if (profile?.role !== 'admin') return json({ error: 'Admin access required' }, 403);

    // 3. Do the reset
    const { target_user_id, new_password } = await req.json();
    if (!target_user_id || !new_password) {
      return json({ error: 'target_user_id and new_password are required' }, 400);
    }

    // Enforce the same password rules as the app
    const strong =
      new_password.length >= 8 &&
      /[A-Z]/.test(new_password) &&
      /[a-z]/.test(new_password) &&
      /[0-9]/.test(new_password) &&
      /[^A-Za-z0-9]/.test(new_password);
    if (!strong) {
      return json({ error: 'Password must be 8+ chars with upper, lower, number and symbol' }, 400);
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(
      target_user_id, { password: new_password }
    );
    if (updErr) return json({ error: updErr.message }, 400);

    // Force the student to change it on next login
    await admin.from('profiles')
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq('id', target_user_id);

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
