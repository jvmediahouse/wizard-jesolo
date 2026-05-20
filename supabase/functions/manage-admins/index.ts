import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid auth" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: isAdminData, error: roleErr } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleErr || !isAdminData) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    if (action === "list") {
      // Page through all auth users
      const users: Array<{ id: string; email: string | null; created_at: string }> = [];
      let page = 1;
      while (page <= 50) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) return json({ error: error.message }, 500);
        for (const u of data.users) {
          users.push({ id: u.id, email: u.email ?? null, created_at: u.created_at });
        }
        if (data.users.length < 200) break;
        page++;
      }

      const { data: roles, error: rolesErr } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (rolesErr) return json({ error: rolesErr.message }, 500);
      const adminIds = new Set((roles ?? []).map((r: { user_id: string }) => r.user_id));

      const result = users
        .map((u) => ({
          user_id: u.id,
          email: u.email,
          created_at: u.created_at,
          is_admin: adminIds.has(u.id),
        }))
        .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));

      return json({ users: result });
    }

    if (action === "grant") {
      const userId = body?.user_id as string | undefined;
      if (!userId) return json({ error: "user_id required" }, 400);
      const { error: insErr } = await admin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (insErr && !insErr.message.toLowerCase().includes("duplicate")) {
        return json({ error: insErr.message }, 500);
      }
      return json({ ok: true });
    }

    if (action === "revoke") {
      const userId = body?.user_id as string | undefined;
      if (!userId) return json({ error: "user_id required" }, 400);
      if (userId === callerId) return json({ error: "Cannot revoke your own admin role" }, 400);
      const { error } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "delete") {
      const userId = body?.user_id as string | undefined;
      if (!userId) return json({ error: "user_id required" }, 400);
      if (userId === callerId) return json({ error: "Cannot delete yourself" }, 400);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});