"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDrill, listStrategies, requireContentManager, requireProfile } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { type Drill, gradeSubmission, validateDrill } from "@/lib/poker/drill";
import { slugify } from "@/lib/poker/importer";
import { createClient } from "@/lib/supabase/server";

const submissionSchema = z.object({
  drillId: z.string().min(1),
  decisions: z
    .array(
      z.object({
        strategyId: z.string().min(1),
        heroCards: z.array(z.string()).length(2),
        board: z.array(z.string()).max(5),
        chosenActionId: z.string().min(1),
      }),
    )
    .min(1)
    .max(10),
});

/** Grava as decisões de uma mão, corrigindo tudo de novo no servidor. */
export async function recordDecisions(input: z.infer<typeof submissionSchema>): Promise<ActionResult> {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const profile = await requireProfile();
  const drill = await getDrill(parsed.data.drillId);
  if (!drill) return { ok: false, error: "Drill não encontrado." };
  const strategies = new Map((await listStrategies()).map((s) => [s.id, s]));

  const rows = [];
  try {
    for (const decision of parsed.data.decisions) {
      const strategy = strategies.get(decision.strategyId);
      if (!strategy) return { ok: false, error: "Estratégia não encontrada." };
      const attempt = gradeSubmission(drill, strategy, decision.heroCards, decision.board, decision.chosenActionId);
      rows.push({
        user_id: profile.id,
        drill_id: drill.id,
        strategy_id: strategy.id,
        correct: attempt.correct,
        data: attempt,
      });
    }
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("attempts").insert(rows);
  if (error) return { ok: false, error: "Não foi possível salvar: " + error.message };
  return { ok: true };
}

const drillSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Informe o nome do drill."),
  description: z.string().optional(),
  steps: z.array(z.string()).min(1, "Escolha pelo menos uma estratégia."),
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
  const drill: Drill = { ...parsed.data, id, tags: [...new Set(parsed.data.tags)] };
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
  revalidatePath("/drills");
  return { ok: true, id };
}

/** Arquiva o drill (o histórico de tentativas é mantido). */
export async function archiveDrill(id: string): Promise<ActionResult> {
  await requireContentManager();
  const supabase = await createClient();
  const { error } = await supabase.from("drills").update({ active: false }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/drills");
  return { ok: true };
}
