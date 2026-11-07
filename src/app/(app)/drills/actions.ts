"use server";

import { revalidatePath } from "next/cache";
import { contentChanged } from "@/lib/content";
import { z } from "zod";
import { listStrategies, requireContentManager } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { type Drill, validateDrill } from "@/lib/poker/drill";
import { slugify } from "@/lib/poker/importer";
import { createClient } from "@/lib/supabase/server";
import { recordSubmissions } from "@/lib/record-attempts";
import type { Submission } from "@/lib/decision-queue";

/** Grava as decisões de uma mão (o treino usa /api/decisoes, em lote). */
export async function recordDecisions(input: Submission): Promise<ActionResult> {
  return recordSubmissions([input]);
}

const drillSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Informe o nome do drill."),
  description: z.string().optional(),
  steps: z.array(z.string()).min(1, "Escolha pelo menos uma estratégia."),
  variants: z.array(z.array(z.string())).optional(),
  sampling: z.enum(["uniforme", "fronteira"]),
  tags: z.array(z.string().trim().min(1)).default([]),
  handsPerSession: z.coerce.number().int(),
  passAccuracy: z.coerce.number(),
});

export async function saveDrill(input: z.input<typeof drillSchema>): Promise<ActionResult & { id?: string }> {
  const profile = await requireContentManager();
  const parsed = drillSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const strategies = new Map((await listStrategies()).map((s) => [s.id, s]));
  const id = parsed.data.id || `${slugify(parsed.data.name) || "drill"}-${Date.now().toString(36)}`;
  const variants = parsed.data.variants?.filter((v) => v.length > 0);
  const drill: Drill = {
    ...parsed.data,
    id,
    tags: [...new Set(parsed.data.tags)],
    steps: variants?.length ? variants[0] : parsed.data.steps,
    variants: variants && variants.length > 1 ? variants : undefined,
  };
  if (!drill.variants) delete drill.variants;
  const errors = validateDrill(drill, strategies);
  if (errors.length) return { ok: false, error: errors.join(" ") };

  const supabase = await createClient();
  const { id: _omit, ...data } = drill;
  void _omit;
  const { error } = await supabase.from("drills").upsert({
    id,
    name: drill.name,
    data,
    active: true,
    updated_at: new Date().toISOString(),
    ...(parsed.data.id ? {} : { created_by: profile.id }),
  });
  if (error) return { ok: false, error: error.message };
  await contentChanged();
  revalidatePath("/drills");
  return { ok: true, id };
}

/** Arquiva o drill (o histórico de tentativas é mantido). */
export async function archiveDrill(id: string): Promise<ActionResult> {
  await requireContentManager();
  const supabase = await createClient();
  const { error } = await supabase.from("drills").update({ active: false }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await contentChanged();
  revalidatePath("/drills");
  return { ok: true };
}
