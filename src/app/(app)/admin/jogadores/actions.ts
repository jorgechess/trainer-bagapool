"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { type Profile, listProfiles, requireAdmin, requireMemberManager } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { NICK_PATTERN, ROLES, canManagePlayer, passwordProblem } from "@/lib/poker/permissions";
import { LOGO_OPTIONS } from "@/lib/pools";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** E-mail interno (o Supabase exige um); ninguém usa nem recebe nada nele. O login é pelo nick. */
const internalEmail = () => `${randomUUID()}@jogadores.bagapool.com.br`;

const memberSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  nick: z.string().trim().regex(NICK_PATTERN, "Nick: 3 a 30 letras, números, ponto, hífen ou sublinhado."),
  password: z.string(),
  role: z.enum(ROLES),
  poolId: z.string().uuid().nullable(),
  isTest: z.boolean().optional(),
});

async function nickTaken(nick: string, exceptId?: string): Promise<boolean> {
  const { data } = await createAdminClient().from("profiles").select("id").ilike("nick", nick.replace(/[%_\\]/g, "\\$&"));
  return (data ?? []).some((row) => row.id !== exceptId);
}

/** Sem a migração 0009 a coluna is_test não existe: explica o que fazer. */
function testColumnHint(message: string): string {
  return /is_test/.test(message) ? "Rode a migração 0009_usuarios_de_teste.sql no Supabase para marcar usuários de teste." : message;
}

async function findMember(id: string): Promise<Profile | null> {
  return (await listProfiles()).find((p) => p.id === id) ?? null;
}

export async function createMember(input: z.input<typeof memberSchema>): Promise<ActionResult> {
  const me = await requireMemberManager();
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { name, nick, password } = parsed.data;
  // Mentor só cadastra jogadores na própria pool
  const role = me.role === "admin" ? parsed.data.role : "jogador";
  const poolId = me.role === "admin" ? parsed.data.poolId : me.poolId;
  // Só o admin marca usuário de teste
  const isTest = me.role === "admin" && parsed.data.isTest === true;
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  if (await nickTaken(nick)) return { ok: false, error: `O nick ${nick} já está em uso.` };
  const { data, error } = await admin.auth.admin.createUser({
    email: internalEmail(),
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) return { ok: false, error: error?.message ?? "Erro ao criar." };
  // O perfil é criado pelo gatilho do banco; papel, pool e nick são definidos aqui.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ name, nick, role, pool_id: poolId, must_change_password: true, ...(isTest ? { is_test: true } : {}) })
    .eq("id", data.user.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: `Não foi possível criar o perfil: ${testColumnHint(profileError.message)}` };
  }
  revalidatePath("/admin/jogadores");
  return { ok: true, message: `${name} cadastrado${isTest ? " como usuário de teste" : ""}. Login: ${nick} · senha inicial: ${password} (será trocada no primeiro acesso).` };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Informe o nome."),
  nick: z.string().trim().regex(NICK_PATTERN, "Nick: 3 a 30 letras, números, ponto, hífen ou sublinhado.").nullable(),
  role: z.enum(ROLES),
  poolId: z.string().uuid().nullable(),
  active: z.boolean(),
  isTest: z.boolean().optional(),
});

export async function updateMember(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const me = await requireMemberManager();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { id, name, nick, active } = parsed.data;
  const target = await findMember(id);
  if (!target || !canManagePlayer(me, target)) return { ok: false, error: "Sem permissão para este jogador." };
  // Mentor não muda papel nem pool
  const role = me.role === "admin" ? parsed.data.role : target.role;
  const poolId = me.role === "admin" ? parsed.data.poolId : target.poolId;
  if (id === me.id && (role !== "admin" || !active))
    return { ok: false, error: "Você não pode tirar o seu próprio acesso de admin." };
  if (nick && (await nickTaken(nick, id))) return { ok: false, error: `O nick ${nick} já está em uso.` };
  // Só o admin muda a marca de teste; só vai para o banco quando muda (funciona mesmo sem a migração 0009)
  const isTest = me.role === "admin" && parsed.data.isTest !== undefined ? parsed.data.isTest : target.isTest;
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ name, nick, role, pool_id: poolId, active, ...(isTest !== target.isTest ? { is_test: isTest } : {}) })
    .eq("id", id);
  if (error) return { ok: false, error: testColumnHint(error.message) };
  revalidatePath("/admin/jogadores");
  return { ok: true, message: "Alterações salvas." };
}

/** Senha provisória gerada pelo mentor/admin; o jogador troca no próximo acesso. */
export async function resetPassword(id: string, password: string): Promise<ActionResult> {
  const me = await requireMemberManager();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Usuário inválido." };
  const target = await findMember(id);
  if (!target || !canManagePlayer(me, target)) return { ok: false, error: "Sem permissão para este jogador." };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return { ok: false, error: error.message };
    await admin.from("profiles").update({ must_change_password: id !== me.id }).eq("id", id);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  return { ok: true, message: "Senha provisória gerada." };
}

export async function createPool(name: string): Promise<ActionResult> {
  await requireAdmin();
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Informe o nome da pool." };
  const supabase = await createClient();
  const { error } = await supabase.from("pools").insert({ name: clean });
  if (error) return { ok: false, error: error.code === "23505" ? "Já existe uma pool com esse nome." : error.message };
  revalidatePath("/admin/jogadores");
  return { ok: true };
}

export async function updatePool(
  id: string,
  input: { name: string; color: string; logo: string | null },
): Promise<ActionResult> {
  await requireAdmin();
  const clean = input.name.trim();
  if (!clean) return { ok: false, error: "Informe o nome da pool." };
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) return { ok: false, error: "Cor inválida." };
  const logo = input.logo && LOGO_OPTIONS.some((o) => o.value === input.logo) ? input.logo : null;
  const supabase = await createClient();
  const { error } = await supabase.from("pools").update({ name: clean, color: input.color, logo }).eq("id", id);
  if (error) return { ok: false, error: error.code === "23505" ? "Já existe uma pool com esse nome." : error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Pool salva." };
}

export async function deletePool(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("pool_id", id);
  if (count) return { ok: false, error: "Mova os jogadores para outra pool antes de excluir." };
  const { error } = await supabase.from("pools").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/jogadores");
  return { ok: true };
}
