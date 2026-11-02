import "server-only";
import { createHash } from "node:crypto";
import { CARGAS } from "@/lib/cargas";
import { DEFAULT_LEGEND, type Legend } from "@/lib/poker/legend";
import { parseImportBundle } from "@/lib/poker/importer";
import type { Strategy } from "@/lib/poker/strategy";
import { createAdminClient } from "@/lib/supabase/admin";

/** Versão das cargas do repositório: muda sempre que algum range, drill ou legenda muda. */
const VERSION = createHash("sha1").update(JSON.stringify(CARGAS.map((c) => c.bundle))).digest("hex");
const VERSION_KEY = "cargas_version";
const CHUNK = 200;

let synced: string | null = null;
let running: Promise<void> | null = null;

/**
 * Importa as cargas do repositório direto no banco (sem tela de importação), uma vez por versão.
 * Itens com o mesmo id são atualizados; drills substituídos saem da lista. Erros não derrubam a página.
 */
export async function syncCargas(): Promise<void> {
  if (synced === VERSION) return;
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run() {
  try {
    const db = createAdminClient();
    const { data: current } = await db.from("settings").select("value").eq("key", VERSION_KEY).maybeSingle();
    if (current?.value === VERSION) {
      synced = VERSION;
      return;
    }
    const { data: legendRow } = await db.from("settings").select("value").eq("key", "legend").maybeSingle();
    let legend: Legend = Array.isArray(legendRow?.value) && legendRow.value.length ? legendRow.value : DEFAULT_LEGEND;
    let legendChanged = false;
    const known: Strategy[] = [];
    const now = new Date().toISOString();
    for (const carga of CARGAS) {
      const result = parseImportBundle(carga.bundle, legend, known);
      if (result.errors.length) {
        console.error(`Carga ${carga.id} com erros:`, result.errors.slice(0, 5));
        continue;
      }
      if (result.legend) {
        legend = result.legend;
        legendChanged = true;
      }
      known.push(...result.strategies);
      const strategyRows = result.strategies.map(({ id, ...data }) => ({
        id,
        name: data.name,
        street: data.street,
        situation: data.situation,
        data,
        updated_at: now,
      }));
      for (let i = 0; i < strategyRows.length; i += CHUNK) {
        const { error } = await db.from("strategies").upsert(strategyRows.slice(i, i + CHUNK));
        if (error) throw new Error(`${carga.id}: ${error.message}`);
      }
      if (result.drills.length) {
        const { error } = await db
          .from("drills")
          .upsert(result.drills.map(({ id, ...data }) => ({ id, name: data.name, data, active: true, updated_at: now })));
        if (error) throw new Error(`${carga.id}: ${error.message}`);
      }
      if (result.replacedDrillIds.length)
        await db.from("drills").update({ active: false }).in("id", result.replacedDrillIds);
    }
    if (legendChanged) await db.from("settings").upsert({ key: "legend", value: legend, updated_at: now });
    await db.from("settings").upsert({ key: VERSION_KEY, value: VERSION, updated_at: now });
    synced = VERSION;
  } catch (error) {
    console.error("Falha ao importar as cargas:", error);
  }
}
