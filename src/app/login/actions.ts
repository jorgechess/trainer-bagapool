"use server";

import { NICK_PATTERN } from "@/lib/poker/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Converte o nick no e-mail interno da conta (o Supabase Auth autentica por e-mail).
 * Quem digitar um e-mail (admins antigos) segue com ele. Nick inexistente devolve um endereço
 * que não existe, para não revelar quais nicks estão cadastrados.
 */
export async function loginAddress(identifier: string): Promise<string> {
  const value = identifier.trim();
  if (value.includes("@")) return value.toLowerCase();
  const fallback = `nao-existe-${Math.random().toString(36).slice(2)}@jogadores.bagapool.com.br`;
  if (!NICK_PATTERN.test(value)) return fallback;
  try {
    const { data } = await createAdminClient()
      .from("profiles")
      .select("email, active")
      .ilike("nick", value.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle();
    return data?.active && data.email ? data.email : fallback;
  } catch {
    return fallback;
  }
}
