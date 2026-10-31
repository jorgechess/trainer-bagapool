"use server";

import { revalidatePath } from "next/cache";
import { requireContentManager } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { slugify } from "@/lib/poker/importer";
import { type PlanConfig, type StatStandard, validateStandard } from "@/lib/poker/plan";
import { createClient } from "@/lib/supabase/server";

export async function saveStandards(standards: StatStandard[], removedIds: string[]): Promise<ActionResult> {
  await requireContentManager();
  if (!Array.isArray(standards)) return { ok: false, error: "Dados inválidos." };
  const clean = standards.map((s) => ({
    ...s,
    statKey: slugify(s.statKey).replace(/-/g, "_"),
    label: String(s.label).trim(),
    min: Number(s.min),
    max: Number(s.max),
    margin: Number(s.margin),
    priority: Number(s.priority),
    drillIds: [...new Set(s.drillIds ?? [])],
  }));
  const errors = clean.flatMap(validateStandard);
  const keys = clean.map((s) => s.statKey);
  const duplicated = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (duplicated.length) errors.push(`Chaves repetidas: ${[...new Set(duplicated)].join(", ")}.`);
  if (errors.length) return { ok: false, error: errors.join(" ") };

  const supabase = await createClient();
  if (removedIds.length) {
    const { error } = await supabase.from("stat_standards").delete().in("id", removedIds);
    if (error) return { ok: false, error: error.message };
  }
  const now = new Date().toISOString();
  const existing = clean.filter((s) => s.id && !s.id.startsWith("novo-"));
  const created = clean.filter((s) => !s.id || s.id.startsWith("novo-"));
  if (existing.length) {
    const rows = existing.map(({ id, ...data }) => ({ id, stat_key: data.statKey, data, updated_at: now }));
    const { error } = await supabase.from("stat_standards").upsert(rows, { onConflict: "id" });
    if (error) return { ok: false, error: error.code === "23505" ? "Chave de stat repetida." : error.message };
  }
  if (created.length) {
    const rows = created.map(({ id: _id, ...data }) => ({ stat_key: data.statKey, data, updated_at: now }));
    const { error } = await supabase.from("stat_standards").insert(rows);
    if (error) return { ok: false, error: error.code === "23505" ? "Chave de stat repetida." : error.message };
  }
  revalidatePath("/admin/standards");
  revalidatePath("/plano");
  return { ok: true, message: "Standards salvos." };
}

export async function savePlanConfig(config: PlanConfig): Promise<ActionResult> {
  const profile = await requireContentManager();
  const clean: PlanConfig = {
    maxFocus: Math.round(Number(config.maxFocus)),
    decisionsFora: Math.round(Number(config.decisionsFora)),
    decisionsMuitoFora: Math.round(Number(config.decisionsMuitoFora)),
  };
  if (!(clean.maxFocus >= 1 && clean.decisionsFora >= 1 && clean.decisionsMuitoFora >= 1))
    return { ok: false, error: "Use números maiores que zero." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "plan_config", value: clean, updated_at: new Date().toISOString(), updated_by: profile.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/standards");
  return { ok: true, message: "Configuração salva." };
}
