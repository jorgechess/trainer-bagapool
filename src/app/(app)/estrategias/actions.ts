"use server";

import { revalidatePath } from "next/cache";
import { getLegend, listDrills, requireContentManager } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { drillStrategyIds } from "@/lib/poker/drill";
import { slugify } from "@/lib/poker/importer";
import { compactRange } from "@/lib/poker/range";
import { POSITIONS, STREETS, type Strategy, validateStrategy } from "@/lib/poker/strategy";
import { createClient } from "@/lib/supabase/server";

function isStrategyShape(value: unknown): value is Strategy {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.name === "string" &&
    typeof s.situation === "string" &&
    (STREETS as readonly string[]).includes(String(s.street)) &&
    (POSITIONS as readonly string[]).includes(String(s.heroPosition)) &&
    typeof s.stack === "object" &&
    Array.isArray(s.actionIds) &&
    typeof s.defaultActionId === "string" &&
    typeof s.range === "object" &&
    Array.isArray(s.textureRanges) &&
    Array.isArray(s.tags)
  );
}

export async function saveStrategy(input: Strategy, isNew: boolean): Promise<ActionResult & { id?: string }> {
  const profile = await requireContentManager();
  if (!isStrategyShape(input)) return { ok: false, error: "Dados inválidos." };
  const legend = await getLegend();
  const id = isNew ? `${slugify(input.name) || "estrategia"}-${Date.now().toString(36)}` : input.id;
  const strategy: Strategy = {
    ...input,
    id,
    name: input.name.trim(),
    situation: input.situation.trim(),
    tags: [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))],
    range: input.street === "preflop" ? compactRange(input.range, input.defaultActionId) : {},
    textureRanges:
      input.street === "preflop"
        ? []
        : input.textureRanges.map((tr) => ({ ...tr, range: compactRange(tr.range, input.defaultActionId) })),
  };
  const errors = validateStrategy(strategy, legend);
  if (errors.length) return { ok: false, error: errors.join(" ") };

  const supabase = await createClient();
  const { id: _omit, ...data } = strategy;
  void _omit;
  const { error } = await supabase.from("strategies").upsert({
    id,
    name: strategy.name,
    street: strategy.street,
    situation: strategy.situation,
    data,
    updated_at: new Date().toISOString(),
    ...(isNew ? { created_by: profile.id } : {}),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/estrategias");
  return { ok: true, id };
}

export async function deleteStrategy(id: string): Promise<ActionResult> {
  await requireContentManager();
  const usedBy = (await listDrills()).filter((d) => drillStrategyIds(d).includes(id));
  if (usedBy.length)
    return {
      ok: false,
      error: `Esta estratégia é usada nos drills: ${usedBy.map((d) => d.name).join(", ")}. Remova dos drills antes.`,
    };
  const supabase = await createClient();
  const { error } = await supabase.from("strategies").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/estrategias");
  return { ok: true };
}
