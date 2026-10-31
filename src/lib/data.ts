import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Attempt, Drill } from "@/lib/poker/drill";
import { DEFAULT_LEGEND, type Legend } from "@/lib/poker/legend";
import { canManageContent, canManageMembers, type Role } from "@/lib/poker/permissions";
import { DEFAULT_PLAN_CONFIG, type MonthlyPlan, type PlanConfig, type StatStandard } from "@/lib/poker/plan";
import type { Strategy } from "@/lib/poker/strategy";

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  poolId: string | null;
  active: boolean;
}

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
  role: Role;
  pool_id: string | null;
  active: boolean;
}

function toProfile(row: ProfileRow): Profile {
  return { id: row.id, name: row.name, email: row.email, role: row.role, poolId: row.pool_id, active: row.active };
}

/** Perfil do usuário logado, ou null. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, name, email, role, pool_id, active")
    .eq("id", user.id)
    .maybeSingle();
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
  const legend = await getSetting<Legend>("legend", DEFAULT_LEGEND);
  return legend.length ? legend : DEFAULT_LEGEND;
}

export async function getPlanConfig(): Promise<PlanConfig> {
  return { ...DEFAULT_PLAN_CONFIG, ...(await getSetting<Partial<PlanConfig>>("plan_config", {})) };
}

interface JsonRow<T> {
  id: string;
  data: T;
}

export async function listStrategies(): Promise<Strategy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("strategies").select("id, data").order("name");
  if (error) throw new Error(error.message);
  return (data as JsonRow<Strategy>[]).map((row) => ({ ...row.data, id: row.id }));
}

export async function getStrategy(id: string): Promise<Strategy | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("strategies").select("id, data").eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as JsonRow<Strategy>;
  return { ...row.data, id: row.id };
}

export async function listDrills(): Promise<Drill[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("drills").select("id, data").eq("active", true).order("name");
  if (error) throw new Error(error.message);
  return (data as JsonRow<Drill>[]).map((row) => ({ ...row.data, id: row.id }));
}

export async function getDrill(id: string): Promise<Drill | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("drills").select("id, data").eq("id", id).eq("active", true).maybeSingle();
  if (!data) return null;
  const row = data as JsonRow<Drill>;
  return { ...row.data, id: row.id };
}

export async function listPools(): Promise<Pool[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pools").select("id, name, color, logo").order("name");
  if (error) throw new Error(error.message);
  return data as Pool[];
}

export async function getPool(id: string | null): Promise<Pool | null> {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("pools").select("id, name, color, logo").eq("id", id).maybeSingle();
  return (data as Pool | null) ?? null;
}

export async function listProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, pool_id, active")
    .order("name");
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
