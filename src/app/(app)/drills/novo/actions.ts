"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContentManager, requireProfile } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/** Até 6 prints, ~1,6 MB cada (base64), PNG/JPEG/WebP. */
const MAX_IMAGES = 6;
const MAX_BASE64 = 2_200_000;

const requestSchema = z.object({
  title: z.string().trim().min(3, "Dê um nome curto para o drill.").max(120, "Nome muito longo."),
  description: z
    .string()
    .trim()
    .min(10, "Conte um pouco do drill que você quer (pelo menos uma frase).")
    .max(4000, "Descrição muito longa."),
  images: z
    .array(
      z.object({
        mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
        data: z.string().max(MAX_BASE64, "Um dos prints é grande demais (máx. ~1,6 MB).").regex(/^[A-Za-z0-9+/=]+$/),
      }),
    )
    .max(MAX_IMAGES, `Até ${MAX_IMAGES} prints por pedido.`)
    .default([]),
});

export async function createDrillRequest(input: z.input<typeof requestSchema>): Promise<ActionResult> {
  const profile = await requireProfile();
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("drill_requests")
    .insert({ user_id: profile.id, title: parsed.data.title, description: parsed.data.description })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: "Não foi possível enviar o pedido agora. Tente de novo." };
  if (parsed.data.images.length > 0) {
    const { error: imgError } = await supabase.from("drill_request_images").insert(
      parsed.data.images.map((img, position) => ({ request_id: created.id, position, mime: img.mime, data: img.data })),
    );
    if (imgError) return { ok: false, error: "O pedido foi enviado, mas os prints não subiram. Tente mandar de novo." };
  }
  revalidatePath("/drills/novo");
  revalidatePath("/drills/pedidos");
  return { ok: true };
}

const reviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["novo", "em_analise", "aprovado", "recusado", "feito"]),
  reply: z.string().trim().max(2000).optional(),
});

export async function reviewDrillRequest(input: z.input<typeof reviewSchema>): Promise<ActionResult> {
  const profile = await requireContentManager();
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("drill_requests")
    .update({
      status: parsed.data.status,
      reply: parsed.data.reply || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: "Não foi possível salvar a análise." };
  revalidatePath("/drills/pedidos");
  revalidatePath("/drills/novo");
  return { ok: true };
}
