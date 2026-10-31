"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { ROLES } from "@/lib/poker/permissions";
import { LOGO_OPTIONS } from "@/lib/pools";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const memberSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  role: z.enum(ROLES),
  poolId: z.string().uuid().nullable(),
});

export async function createMember(input: z.input<typeof memberSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { name, email, password, role, poolId } = parsed.data;
  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) {
    const duplicated = /already|registered|exists/i.test(error?.message ?? "");
    return { ok: false, error: duplicated ? "Já existe um usuário com esse e-mail." : (error?.message ?? "Erro ao criar.") };
  }
  // O perfil é criado pelo gatilho do banco; papel e pool são definidos aqui.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ name, role, pool_id: poolId })
    .eq("id", data.user.id);
  if (profileError) return { ok: false, error: `Usuário criado, mas o perfil falhou: ${profileError.message}` };
  revalidatePath("/admin/jogadores");
  return { ok: true, message: `${name} cadastrado. Envie o e-mail e a senha para a pessoa.` };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Informe o nome."),
  role: z.enum(ROLES),
  poolId: z.string().uuid().nullable(),
  active: z.boolean(),
});

export async function updateMember(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { id, name, role, poolId, active } = parsed.data;
  if (id === me.id && (role !== "admin" || !active))
    return { ok: false, error: "Você não pode tirar o seu próprio acesso de admin." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ name, role, pool_id: poolId, active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/jogadores");
  return { ok: true, message: "Alterações salvas." };
}

export async function resetPassword(id: string, password: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Usuário inválido." };
  if (password.length < 8) return { ok: false, error: "A senha precisa ter pelo menos 8 caracteres." };
  try {
    const { error } = await createAdminClient().auth.admin.updateUserById(id, { password });
    if (error) return { ok: false, error: error.message };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  return { ok: true, message: "Senha alterada." };
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
