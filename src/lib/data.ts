import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getContent } from "@/lib/content";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { RANKING_EXCLUDED_TAG, type RankingRow, monthRange } from "@/lib/poker/ranking";
import type { Attempt, Drill } from "@/lib/poker/drill";
import type { Legend } from "@/lib/poker/legend";
import { canManageContent, canManageMembers, canManagePlayers, type Role } from "@/lib/poker/permissions";
import { DEFAULT_PLAN_CONFIG, type MonthlyPlan, type PlanConfig, type StatStandard } from "@/lib/poker/plan";
import type { Strategy } from "@/lib/poker/strategy";

export interface Profile {
  id: string;
  name: string;
  email: string;
  /** Nick usado no login (null = entra pelo e-mail, como os admins antigos). */
  nick: string | null;
  role: Role;
  poolId: string | null;
  active: boolean;
  /** Senha inicial ou redefinida: precisa trocar antes de usar o app. */
  mustChangePassword: boolean;
}

const DEFAULT_POOL_COLOR = "#a1a1aa";

export interface Pool {
  id: string;
  name: string;
  color: string;
  logo: string | null;
}

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  nick?: string | null;
  role: Role;
  pool_id: string | null;
  active: boolean;
  must_change_password?: boolean;
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    nick: row.nick ?? null,
    role: row.role,
    poolId: row.pool_id,
    active: row.active,
    mustChangePassword: row.must_change_password ?? false,
  };
}

const PROFILE_COLUMNS = "id, name, email, nick, role, pool_id, active, must_change_password";
const PROFILE_COLUMNS_OLD = "id, name, email, role, pool_id, active";
/** Coluna inexistente: a migração 0003 ainda não foi rodada; o app segue com o login por e-mail. */
const missingColumn = (error: { code?: string } | null) => error?.code === "42703";

/** Perfil do usuário logado, ou null. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  type One = { data: ProfileRow | null; error: { code?: string; message: string } | null };
  let { data, error } = (await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle()) as One;
  if (missingColumn(error))
    ({ data, error } = (await supabase.from("profiles").select(PROFILE_COLUMNS_OLD).eq("id", user.id).maybeSingle()) as One);
  if (!data || !data.active) return null;
  return toProfile(data as ProfileRow);
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?erro=sem-acesso");
  return profile;
}

export async function requireContentManager(): Promise<Profile> {
  const profile = await requireProfile();
  if (!canManageContent(profile.role)) redirect("/");
  return profile;
}

/** Admin (todo o time) ou mentor com pool (só os jogadores da própria pool). */
export async function requireMemberManager(): Promise<Profile> {
  const profile = await requireProfile();
  if (!canManagePlayers(profile)) redirect("/");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!canManageMembers(profile.role)) redirect("/");
  return profile;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T | undefined) ?? fallback;
}

export async function getLegend(): Promise<Legend> {
  return (await getContent()).legend;
}

export async function getPlanConfig(): Promise<PlanConfig> {
  return { ...DEFAULT_PLAN_CONFIG, ...(await getSetting<Partial<PlanConfig>>("plan_config", {})) };
}

interface JsonRow<T> {
  id: string;
  data: T;
}

// Estratégias, drills e legenda vêm do cache em memória (src/lib/content.ts): cópias rasas das listas,
// para quem ordenar ou filtrar não mexer no que os outros usuários recebem.
export async function listStrategies(): Promise<Strategy[]> {
  return [...(await getContent()).strategies];
}

export async function getStrategy(id: string): Promise<Strategy | null> {
  return (await getContent()).strategyById.get(id) ?? null;
}

export async function listDrills(): Promise<Drill[]> {
  return [...(await getContent()).drills];
}

export async function getDrill(id: string): Promise<Drill | null> {
  return (await getContent()).drillById.get(id) ?? null;
}

export async function listPools(): Promise<Pool[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pools").select("id, name, color, logo").order("name");
  if (!error) return data as Pool[];
  // Banco sem a migração 0002 (cor e logo): segue com o básico em vez de derrubar a tela.
  const fallback = await supabase.from("pools").select("id, name").order("name");
  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data as { id: string; name: string }[]).map((p) => ({ ...p, color: DEFAULT_POOL_COLOR, logo: null }));
}

export async function getPool(id: string | null): Promise<Pool | null> {
  if (!id) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("pools").select("id, name, color, logo").eq("id", id).maybeSingle();
  if (!error) return (data as Pool | null) ?? null;
  const fallback = await supabase.from("pools").select("id, name").eq("id", id).maybeSingle();
  return fallback.data ? { ...(fallback.data as { id: string; name: string }), color: DEFAULT_POOL_COLOR, logo: null } : null;
}

export async function listProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  type Many = { data: ProfileRow[] | null; error: { code?: string; message: string } | null };
  let { data, error } = (await supabase.from("profiles").select(PROFILE_COLUMNS).order("name")) as Many;
  if (missingColumn(error))
    ({ data, error } = (await supabase.from("profiles").select(PROFILE_COLUMNS_OLD).order("name")) as Many);
  if (error) throw new Error(error.message);
  return (data as ProfileRow[]).map(toProfile);
}

/** Tentativas de um jogador (as permissões do banco garantem quem pode ver). */
export async function getAttempts(userId: string, sinceIso?: string): Promise<Attempt[]> {
  const supabase = await createClient();
  const all: Attempt[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 50_000; from += pageSize) {
    let query = supabase
      .from("attempts")
      .select("data")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (sinceIso) query = query.gte("created_at", sinceIso);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    all.push(...(data as { data: Attempt }[]).map((row) => row.data));
    if (data.length < pageSize) break;
  }
  return all;
}

/** Pools que a pessoa acompanha no Desempenho ([] se a migração 0004 ainda não rodou). */
export async function getMentoredPools(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("mentored_pools").eq("id", userId).maybeSingle();
  if (error) return [];
  return ((data as { mentored_pools?: string[] | null } | null)?.mentored_pools ?? []).filter(Boolean);
}

/** Tentativas de vários jogadores de uma vez, agrupadas por jogador. */
export async function getAttemptsByUser(userIds: string[], sinceIso?: string): Promise<Map<string, Attempt[]>> {
  const result = new Map<string, Attempt[]>(userIds.map((id) => [id, []]));
  if (userIds.length === 0) return result;
  const supabase = await createClient();
  const pageSize = 1000;
  for (let i = 0; i < userIds.length; i += 50) {
    const ids = userIds.slice(i, i + 50);
    for (let from = 0; from < 200_000; from += pageSize) {
      let query = supabase
        .from("attempts")
        .select("user_id, data")
        .in("user_id", ids)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (sinceIso) query = query.gte("created_at", sinceIso);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      for (const row of data as { user_id: string; data: Attempt }[]) result.get(row.user_id)?.push(row.data);
      if (data.length < pageSize) break;
    }
  }
  return result;
}

export async function listStandards(): Promise<StatStandard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("stat_standards").select("id, data");
  if (error) throw new Error(error.message);
  return (data as JsonRow<StatStandard>[])
    .map((row) => ({ ...row.data, id: row.id }))
    .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));
}

export interface SavedPlan {
  id: string;
  userId: string;
  month: string;
  stats: Record<string, number>;
  plan: MonthlyPlan;
}

export async function getPlan(userId: string, month: string): Promise<SavedPlan | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_plans")
    .select("id, user_id, month, stats, plan")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, userId: data.user_id, month: data.month, stats: data.stats, plan: data.plan };
}

/**
 * Totais do mês por jogador para o ranking (todo o time; só ficam fora os drills com a tag "fora-do-ranking").
 * Usa a função monthly_ranking (migrações 0005 e 0007); se ela ainda não existir no banco, soma pela chave de serviço.
 */
export async function getRankingRows(month: string): Promise<RankingRow[]> {
  const { from, to } = monthRange(month);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("monthly_ranking", { p_from: from, p_to: to });
  if (!error) {
    return (data as { user_id: string; decisions: number; correct: number }[]).map((r) => ({
      userId: r.user_id,
      decisions: Number(r.decisions),
      correct: Number(r.correct),
    }));
  }
  if (!["PGRST202", "42883"].includes(error.code ?? "")) throw new Error(error.message);
  // Sem a migração 0005: soma aqui (mais lento; só os totais saem desta função)
  const { drills } = await getContent();
  const excluded = new Set(drills.filter((d) => d.tags.includes(RANKING_EXCLUDED_TAG)).map((d) => d.id));
  const admin = createAdminClient();
  const totals = new Map<string, RankingRow>();
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const page = await admin
      .from("attempts")
      .select("user_id, drill_id, correct")
      .gte("created_at", from)
      .lt("created_at", to)
      .order("id")
      .range(start, start + pageSize - 1);
    if (page.error) throw new Error(page.error.message);
    for (const row of page.data as { user_id: string; drill_id: string; correct: boolean }[]) {
      if (excluded.has(row.drill_id)) continue;
      const t = totals.get(row.user_id) ?? { userId: row.user_id, decisions: 0, correct: 0 };
      t.decisions++;
      if (row.correct) t.correct++;
      totals.set(row.user_id, t);
    }
    if (page.data.length < pageSize) break;
  }
  return [...totals.values()];
}
