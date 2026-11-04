"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { canViewAllPerformance } from "@/lib/poker/permissions";
import { createClient } from "@/lib/supabase/server";

/** Atualiza as pools que o mentor (ou coach/admin) acompanha no Desempenho. */
export async function saveMentoredPools(poolIds: string[]): Promise<ActionResult> {
  const me = await requireProfile();
  if (!canViewAllPerformance(me.role)) return { ok: false, error: "Só mentores, coaches e admin acompanham pools." };
  const parsed = z.array(z.string().uuid()).max(50).safeParse(poolIds);
  if (!parsed.success) return { ok: false, error: "Pools inválidas." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_mentored_pools", { pool_ids: [...new Set(parsed.data)] });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883")
      return { ok: false, error: "Rode a migração 0004_pools_mentoradas.sql no Supabase para salvar as pools." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/desempenho");
  return { ok: true, message: "Pools atualizadas." };
}
