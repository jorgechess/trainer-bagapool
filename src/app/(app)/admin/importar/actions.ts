"use server";

import { revalidatePath } from "next/cache";
import { getLegend, requireContentManager } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { parseImportBundle } from "@/lib/poker/importer";
import { createClient } from "@/lib/supabase/server";

/** Importa legenda, estratégias e drills de uma vez. Itens com o mesmo id são substituídos. */
export async function importBundle(json: string): Promise<ActionResult> {
  const profile = await requireContentManager();
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    return { ok: false, error: "JSON inválido." };
  }
  const result = parseImportBundle(input, await getLegend());
  if (result.errors.length) return { ok: false, error: result.errors.slice(0, 10).join(" ") };

  const supabase = await createClient();
  const now = new Date().toISOString();
  if (result.legend) {
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "legend", value: result.legend, updated_at: now, updated_by: profile.id });
    if (error) return { ok: false, error: `Legenda: ${error.message}` };
  }
  if (result.strategies.length) {
    const rows = result.strategies.map(({ id, ...data }) => ({
      id,
      name: data.name,
      street: data.street,
      situation: data.situation,
      data,
      updated_at: now,
      created_by: profile.id,
    }));
    const { error } = await supabase.from("strategies").upsert(rows);
    if (error) return { ok: false, error: `Estratégias: ${error.message}` };
  }
  if (result.drills.length) {
    const rows = result.drills.map(({ id, ...data }) => ({
      id,
      name: data.name,
      data,
      active: true,
      updated_at: now,
      created_by: profile.id,
    }));
    const { error } = await supabase.from("drills").upsert(rows);
    if (error) return { ok: false, error: `Drills: ${error.message}` };
  }
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Importado: ${result.legend ? "legenda, " : ""}${result.strategies.length} estratégia(s) e ${result.drills.length} drill(s).`,
  };
}
