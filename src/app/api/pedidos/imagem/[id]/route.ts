import { createClient } from "@/lib/supabase/server";

/** GET /api/pedidos/imagem/:id — print de um pedido de drill (só para quem pode ver o pedido, pelo RLS). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Não encontrado", { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.from("drill_request_images").select("mime, data").eq("id", id).maybeSingle();
  if (!data) return new Response("Não encontrado", { status: 404 });
  return new Response(Buffer.from(data.data as string, "base64"), {
    headers: {
      "Content-Type": data.mime as string,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
