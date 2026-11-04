"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPlan, getPlanConfig, listDrills, listProfiles, listStandards, requireProfile } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { canEditPlanDrills, canManageContent } from "@/lib/poker/permissions";
import { type MonthlyPlan, addPlanDrill, buildMonthlyPlan, removePlanDrill } from "@/lib/poker/plan";
import { createClient } from "@/lib/supabase/server";

/** Gera e salva o plano do mês a partir dos stats do popup. */
export async function savePlan(userId: string, month: string, values: Record<string, number>): Promise<ActionResult> {
  const profile = await requireProfile();
  if (userId !== profile.id && !canManageContent(profile.role))
    return { ok: false, error: "Você só pode montar o seu próprio plano." };
  const clean: Record<string, number> = {};
  for (const [key, value] of Object.entries(values ?? {})) {
    const n = Number(value);
    if (Number.isFinite(n)) clean[key] = n;
  }
  const [standards, config] = await Promise.all([listStandards(), getPlanConfig()]);
  if (standards.length === 0) return { ok: false, error: "Cadastre os standards do time antes de montar planos." };
  let plan;
  try {
    plan = buildMonthlyPlan(month, clean, standards, config);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  // Mantém os drills que o admin acrescentou ou tirou à mão
  const previous = await getPlan(userId, month);
  if (previous) plan = { ...plan, manual: previous.plan.manual, removed: previous.plan.removed };
  const supabase = await createClient();
  const { error } = await supabase
    .from("monthly_plans")
    .upsert(
      { user_id: userId, month, stats: clean, plan, created_by: profile.id, created_at: new Date().toISOString() },
      { onConflict: "user_id,month" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/plano");
  revalidatePath("/");
  return { ok: true };
}

const editSchema = z.object({
  userId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  drillId: z.string().min(1),
  targetDecisions: z.coerce.number().int().min(10).max(5000).optional(),
});

/** Acrescenta ou tira um drill do plano do mês (admin, mentor da pool ou o próprio perfil, se não for jogador). */
export async function editPlanDrill(
  input: z.input<typeof editSchema>,
  operation: "add" | "remove",
): Promise<ActionResult> {
  const me = await requireProfile();
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const { userId, month, drillId, targetDecisions } = parsed.data;
  const target = (await listProfiles()).find((p) => p.id === userId);
  if (!target || !canEditPlanDrills(me, target))
    return { ok: false, error: "Sem permissão para mudar os drills deste plano." };
  if (operation === "add" && !(await listDrills()).some((d) => d.id === drillId))
    return { ok: false, error: "Drill não encontrado." };
  const saved = await getPlan(userId, month);
  const current: MonthlyPlan = saved?.plan ?? { month, focus: [], missing: [] };
  const plan =
    operation === "add" ? addPlanDrill(current, drillId, targetDecisions ?? 200) : removePlanDrill(current, drillId);
  const supabase = await createClient();
  const { error } = await supabase.from("monthly_plans").upsert(
    {
      user_id: userId,
      month,
      stats: saved?.stats ?? {},
      plan,
      created_by: me.id,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,month" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/plano");
  revalidatePath("/");
  return { ok: true, message: operation === "add" ? "Drill acrescentado ao plano." : "Drill tirado do plano." };
}
