"use server";

import { getCurrentProfile } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { passwordProblem } from "@/lib/poker/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Troca a senha do próprio usuário (o Supabase guarda só o hash bcrypt) e libera o app. */
export async function changePassword(password: string, confirmation: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Entre de novo para trocar a senha." };
  if (password !== confirmation) return { ok: false, error: "As duas senhas não são iguais." };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error)
    return {
      ok: false,
      error: /different|same/i.test(error.message) ? "Escolha uma senha diferente da provisória." : error.message,
    };
  if (profile.mustChangePassword) {
    const { error: flagError } = await createAdminClient()
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", profile.id);
    if (flagError) return { ok: false, error: flagError.message };
  }
  return { ok: true, message: "Senha trocada." };
}
