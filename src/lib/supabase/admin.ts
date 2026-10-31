import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Cliente com a chave de serviço: ignora as permissões. Use só no servidor,
 * depois de conferir que quem está pedindo é admin.
 */
export function createAdminClient() {
  return createClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
