import "server-only";
import { z } from "zod";
import { getCurrentProfile, getDrill, getStrategy } from "@/lib/data";
import type { ActionResult } from "@/lib/format";
import { gradeSubmission } from "@/lib/poker/drill";
import { createClient } from "@/lib/supabase/server";

/** Máximo de decisões por requisição (uma sessão longa offline é enviada em várias). */
export const MAX_DECISIONS_PER_REQUEST = 200;

const decisionSchema = z.object({
  strategyId: z.string().min(1),
  heroCards: z.array(z.string()).length(2),
  board: z.array(z.string()).max(5),
  chosenActionId: z.string().min(1),
});

export const submissionsSchema = z
  .array(z.object({ drillId: z.string().min(1), decisions: z.array(decisionSchema).min(1).max(10) }))
  .min(1)
  .max(50);

/**
 * Grava um lote de decisões numa escrita só, corrigindo tudo de novo no servidor (o navegador não decide
 * se acertou). Drills e estratégias vêm do cache em memória; só a sessão do usuário e o insert vão ao banco.
 */
export async function recordSubmissions(input: unknown): Promise<ActionResult> {
  const parsed = submissionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  if (parsed.data.reduce((n, s) => n + s.decisions.length, 0) > MAX_DECISIONS_PER_REQUEST)
    return { ok: false, error: "Lote grande demais." };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sessão expirada. Entre de novo." };

  // Drill arquivado ou estratégia removida enquanto a decisão estava na fila: descarta só aquela
  // decisão, para a fila do jogador não travar
  const rows = [];
  for (const submission of parsed.data) {
    const drill = await getDrill(submission.drillId);
    if (!drill) continue;
    for (const decision of submission.decisions) {
      const strategy = await getStrategy(decision.strategyId);
      if (!strategy) continue;
      try {
        const attempt = gradeSubmission(drill, strategy, decision.heroCards, decision.board, decision.chosenActionId);
        rows.push({ user_id: profile.id, drill_id: drill.id, strategy_id: strategy.id, correct: attempt.correct, data: attempt });
      } catch (error) {
        console.error("Decisão inválida descartada:", (error as Error).message);
      }
    }
  }
  if (!rows.length) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("attempts").insert(rows);
  if (error) return { ok: false, error: "Não foi possível salvar: " + error.message };
  return { ok: true };
}
