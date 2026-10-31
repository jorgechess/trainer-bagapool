"use server";

import { revalidatePath } from "next/cache";
import { listStrategies, requireContentManager } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { type Legend, validateLegend } from "@/lib/poker/legend";
import { createClient } from "@/lib/supabase/server";

export async function saveLegend(legend: Legend): Promise<ActionResult> {
  const profile = await requireContentManager();
  if (!Array.isArray(legend)) return { ok: false, error: "Dados inválidos." };
  const clean: Legend = legend.map((a) => ({
    id: String(a.id).trim(),
    label: String(a.label).trim(),
    color: String(a.color).toLowerCase(),
    kind: a.kind,
    ...(a.sizing?.trim() ? { sizing: a.sizing.trim() } : {}),
  }));
  const errors = validateLegend(clean);
  if (errors.length) return { ok: false, error: errors.join(" ") };

  // Não deixa remover uma ação que ainda é usada por alguma estratégia.
  const ids = new Set(clean.map((a) => a.id));
  const inUse = new Map<string, string[]>();
  for (const s of await listStrategies()) {
    const used = new Set([
      ...s.actionIds,
      s.defaultActionId,
      ...(s.entryActionIds ?? []),
    ]);
    for (const id of used) if (!ids.has(id)) inUse.set(id, [...(inUse.get(id) ?? []), s.name]);
  }
  if (inUse.size) {
    const details = [...inUse.entries()].map(([id, names]) => `"${id}" (usada em ${names.join(", ")})`).join("; ");
    return { ok: false, error: `Não dá para remover ações em uso: ${details}.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "legend", value: clean, updated_at: new Date().toISOString(), updated_by: profile.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
