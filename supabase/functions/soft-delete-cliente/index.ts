import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await sb.auth.getUser(token);

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401 });
  }

  const { id, analista } = await req.json();

  if (!id) {
    return new Response(JSON.stringify({ error: "ID necessário" }), { status: 400 });
  }

  const { error } = await sb
    .from("clientes")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: analista || "—",
    })
    .eq("id", id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
