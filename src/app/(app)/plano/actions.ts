"use server";

import { revalidatePath } from "next/cache";
import { getPlanConfig, listStandards, requireProfile } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { canManageContent } from "@/lib/poker/permissions";
import { buildMonthlyPlan } from "@/lib/poker/plan";
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
