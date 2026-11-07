import { NextResponse } from "next/server";
import { recordSubmissions } from "@/lib/record-attempts";

/**
 * POST /api/decisoes — grava um lote de decisões do treino.
 * Corpo: { submissions: [{ drillId, decisions: [{ strategyId, heroCards, board, chosenActionId }] }] }.
 * Rota em vez de server action para o navegador poder usar fetch com keepalive ao sair da página.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  const result = await recordSubmissions((body as { submissions?: unknown })?.submissions);
  const status = result.ok ? 200 : result.error.startsWith("Sessão") ? 401 : 400;
  return NextResponse.json(result, { status });
}
