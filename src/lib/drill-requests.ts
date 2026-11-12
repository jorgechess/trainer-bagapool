import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DrillRequestStatus = "novo" | "em_analise" | "aprovado" | "recusado" | "feito";

export const REQUEST_STATUS_LABEL: Record<DrillRequestStatus, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Recusado",
  feito: "Feito",
};

export interface DrillRequest {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: DrillRequestStatus;
  reply: string | null;
  createdAt: string;
  reviewedAt: string | null;
  imageIds: string[];
}

interface Row {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: DrillRequestStatus;
  reply: string | null;
  created_at: string;
  reviewed_at: string | null;
  drill_request_images: { id: string; position: number }[] | null;
}

const COLUMNS = "id, user_id, title, description, status, reply, created_at, reviewed_at, drill_request_images(id, position)";

function toRequest(row: Row): DrillRequest {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    reply: row.reply,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    imageIds: [...(row.drill_request_images ?? [])].sort((a, b) => a.position - b.position).map((i) => i.id),
  };
}

/** Pedidos que a pessoa enxerga (os próprios; todos para quem gerencia conteúdo), mais novos primeiro. */
export async function listDrillRequests(options: { onlyMine?: string } = {}): Promise<DrillRequest[]> {
  const supabase = await createClient();
  let query = supabase.from("drill_requests").select(COLUMNS).order("created_at", { ascending: false }).limit(300);
  if (options.onlyMine) query = query.eq("user_id", options.onlyMine);
  const { data, error } = await query;
  // Tabela ainda não criada (migração 0008 não rodada): lista vazia
  if (error) return [];
  return ((data ?? []) as unknown as Row[]).map(toRequest);
}

/** Segunda-feira (São Paulo) da semana do pedido, no formato AAAA-MM-DD, para agrupar a análise semanal. */
export function weekStart(iso: string): string {
  const local = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const day = (local.getDay() + 6) % 7; // 0 = segunda
  local.setDate(local.getDate() - day);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
