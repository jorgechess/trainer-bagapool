/**
 * Plano mensal: compara os stats do popup do jogador com os standards do time e monta os drills do mês.
 * Regra de prioridade: primeiro todos os stats "muito fora" (na ordem de prioridade),
 * depois os "fora" (também na ordem de prioridade).
 */
import type { Attempt } from "./drill";

export interface StatStandard {
  id: string;
  /** Chave do stat no popup, ex.: "rfi_btn". */
  statKey: string;
  label: string;
  /** Faixa ideal. */
  min: number;
  max: number;
  /** Quanto pode passar da faixa ideal antes de virar "muito fora". */
  margin: number;
  /** 1 = mais prioritário. */
  priority: number;
  /** Drills que treinam este stat. */
  drillIds: string[];
}

export type StatStatus = "dentro" | "fora" | "muito-fora";
export type StatDirection = "abaixo" | "acima" | null;

export const STATUS_LABELS: Record<StatStatus, string> = {
  dentro: "Dentro",
  fora: "Fora",
  "muito-fora": "Muito fora",
};

export interface StatEvaluation {
  standard: StatStandard;
  value: number;
  status: StatStatus;
  direction: StatDirection;
  /** Distância até a faixa ideal (0 quando dentro). */
  deviation: number;
}

export function evaluateStat(standard: StatStandard, value: number): StatEvaluation {
  let direction: StatDirection = null;
  let deviation = 0;
  if (value < standard.min) {
    direction = "abaixo";
    deviation = standard.min - value;
  } else if (value > standard.max) {
    direction = "acima";
    deviation = value - standard.max;
  }
  const status: StatStatus = deviation === 0 ? "dentro" : deviation <= standard.margin ? "fora" : "muito-fora";
  return { standard, value, status, direction, deviation: Math.round(deviation * 100) / 100 };
}

export function validateStandard(standard: StatStandard): string[] {
  const errors: string[] = [];
  if (!standard.statKey.trim()) errors.push("Informe a chave do stat.");
  if (!standard.label.trim()) errors.push("Informe o nome do stat.");
  if (!(Number.isFinite(standard.min) && Number.isFinite(standard.max) && standard.max >= standard.min))
    errors.push(`"${standard.label}": a faixa ideal é inválida.`);
  if (!(standard.margin >= 0)) errors.push(`"${standard.label}": a margem não pode ser negativa.`);
  if (!(Number.isInteger(standard.priority) && standard.priority >= 1))
    errors.push(`"${standard.label}": a prioridade deve ser um número inteiro a partir de 1.`);
  return errors;
}

/** Ordena os stats com problema segundo a regra do time. */
export function prioritize(evaluations: readonly StatEvaluation[]): StatEvaluation[] {
  const rank = (e: StatEvaluation) => (e.status === "muito-fora" ? 0 : e.status === "fora" ? 1 : 2);
  return evaluations
    .filter((e) => e.status !== "dentro")
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.standard.priority - b.standard.priority ||
        b.deviation - a.deviation ||
        a.standard.label.localeCompare(b.standard.label),
    );
}

export interface PlanConfig {
  /** Máximo de focos no mês. */
  maxFocus: number;
  /** Meta de decisões por drill quando o stat está "fora". */
  decisionsFora: number;
  /** Meta de decisões por drill quando o stat está "muito fora". */
  decisionsMuitoFora: number;
}

export const DEFAULT_PLAN_CONFIG: PlanConfig = { maxFocus: 3, decisionsFora: 200, decisionsMuitoFora: 400 };

export interface PlanFocus {
  order: number;
  statKey: string;
  label: string;
  value: number;
  status: Exclude<StatStatus, "dentro">;
  direction: StatDirection;
  goals: { drillId: string; targetDecisions: number }[];
}

export interface MonthlyPlan {
  /** Mês no formato "AAAA-MM". */
  month: string;
  focus: PlanFocus[];
  /** Stats sem standard cadastrado ou standards sem valor no popup. */
  missing: string[];
}

export function buildMonthlyPlan(
  month: string,
  values: Record<string, number>,
  standards: readonly StatStandard[],
  config: PlanConfig = DEFAULT_PLAN_CONFIG,
): MonthlyPlan {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mês inválido, use AAAA-MM");
  const evaluations: StatEvaluation[] = [];
  const missing: string[] = [];
  for (const standard of standards) {
    const value = values[standard.statKey];
    if (value === undefined || !Number.isFinite(value)) missing.push(standard.label);
    else evaluations.push(evaluateStat(standard, value));
  }
  const focus = prioritize(evaluations)
    .slice(0, config.maxFocus)
    .map((e, index) => ({
      order: index + 1,
      statKey: e.standard.statKey,
      label: e.standard.label,
      value: e.value,
      status: e.status as Exclude<StatStatus, "dentro">,
      direction: e.direction,
      goals: e.standard.drillIds.map((drillId) => ({
        drillId,
        targetDecisions: e.status === "muito-fora" ? config.decisionsMuitoFora : config.decisionsFora,
      })),
    }));
  return { month, focus, missing };
}

export interface GoalProgress {
  drillId: string;
  targetDecisions: number;
  done: number;
  correct: number;
  accuracy: number;
  completed: boolean;
}

/** Progresso das metas do mês, contando só as decisões daquele mês. */
export function planProgress(plan: MonthlyPlan, attempts: readonly Attempt[]): GoalProgress[] {
  const monthAttempts = attempts.filter((a) => a.createdAt.slice(0, 7) === plan.month);
  const targets = new Map<string, number>();
  for (const focus of plan.focus)
    for (const goal of focus.goals) targets.set(goal.drillId, (targets.get(goal.drillId) ?? 0) + goal.targetDecisions);
  return [...targets.entries()].map(([drillId, targetDecisions]) => {
    const relevant = monthAttempts.filter((a) => a.drillId === drillId);
    const correct = relevant.filter((a) => a.correct).length;
    return {
      drillId,
      targetDecisions,
      done: relevant.length,
      correct,
      accuracy: relevant.length ? correct / relevant.length : 0,
      completed: relevant.length >= targetDecisions,
    };
  });
}
