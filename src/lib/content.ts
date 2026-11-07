import "server-only";
import { createContentCache } from "@/lib/content-cache";
import type { Drill } from "@/lib/poker/drill";
import { DEFAULT_LEGEND, type Legend } from "@/lib/poker/legend";
import type { Strategy } from "@/lib/poker/strategy";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Conteúdo compartilhado por todo o time. Lido com a chave de serviço porque fica em cache para todos:
 * quem chama já passou por requireProfile / requireContentManager.
 */
export interface Content {
  strategies: Strategy[];
  strategyById: Map<string, Strategy>;
  /** Só os drills ativos, por nome. */
  drills: Drill[];
  drillById: Map<string, Drill>;
  legend: Legend;
}

const CONTENT_VERSION_KEY = "content_version";
/** cargas_version muda a cada carga nova do repositório; content_version a cada edição pelo app. */
const VERSION_KEYS = [CONTENT_VERSION_KEY, "cargas_version"];

interface JsonRow<T> {
  id: string;
  data: T;
}

async function loadContent(): Promise<Content> {
  const db = createAdminClient();
  const strategies: Strategy[] = [];
  // O banco devolve no máximo 1000 linhas por consulta: lê em páginas
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("strategies")
      .select("id, data")
      .order("name")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    strategies.push(...(data as JsonRow<Strategy>[]).map((row) => ({ ...row.data, id: row.id })));
    if (data.length < pageSize) break;
  }
  const [drillsResult, legendResult] = await Promise.all([
    db.from("drills").select("id, data").eq("active", true).order("name"),
    db.from("settings").select("value").eq("key", "legend").maybeSingle(),
  ]);
  if (drillsResult.error) throw new Error(drillsResult.error.message);
  const drills = (drillsResult.data as JsonRow<Drill>[]).map((row) => ({ ...row.data, id: row.id }));
  const legendValue = legendResult.data?.value as Legend | undefined;
  return {
    strategies,
    strategyById: new Map(strategies.map((s) => [s.id, s])),
    drills,
    drillById: new Map(drills.map((d) => [d.id, d])),
    legend: Array.isArray(legendValue) && legendValue.length ? legendValue : DEFAULT_LEGEND,
  };
}

async function readVersion(): Promise<string> {
  const { data, error } = await createAdminClient().from("settings").select("key, value").in("key", VERSION_KEYS);
  if (error) throw new Error(error.message);
  const byKey = new Map((data ?? []).map((row) => [row.key as string, JSON.stringify(row.value)]));
  return VERSION_KEYS.map((key) => byKey.get(key) ?? "").join("|");
}

const checkSeconds = Number(process.env.CONTENT_CHECK_SECONDS ?? 30);
const cache = createContentCache({
  load: loadContent,
  readVersion,
  checkMs: Number.isFinite(checkSeconds) ? checkSeconds * 1000 : 30_000,
});

export function getContent(): Promise<Content> {
  return cache.get();
}

/**
 * Depois de mudar estratégias, drills ou a legenda: limpa a memória desta instância e avisa as outras
 * (elas conferem a versão a cada 30s).
 */
export async function contentChanged(): Promise<void> {
  cache.invalidate();
  const value = `${new Date().toISOString()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await createAdminClient()
    .from("settings")
    .upsert({ key: CONTENT_VERSION_KEY, value, updated_at: new Date().toISOString() });
  if (error) console.error("Falha ao marcar nova versão do conteúdo:", error.message);
}

/** Só limpa a memória desta instância (a carga do repositório já grava a própria versão). */
export function invalidateContent(): void {
  cache.invalidate();
}
