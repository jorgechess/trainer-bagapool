/** Range: cada uma das 169 mãos tem exatamente uma ação (não existem mãos mistas). */
import { RANKS, type Rank } from "./cards";
import { ALL_HANDS, type HandLabel, comboCount, gridNeighbors, isHandLabel, TOTAL_COMBOS } from "./hands";
import type { Legend } from "./legend";

/** Mão → id da ação na legenda. Mãos ausentes usam a ação padrão da estratégia. */
export type Range = Partial<Record<HandLabel, string>>;

export function actionOf(range: Range, hand: HandLabel, defaultActionId: string): string {
  return range[hand] ?? defaultActionId;
}

/** Range completo, preenchendo mãos ausentes com a ação padrão. */
export function completeRange(range: Range, defaultActionId: string): Record<HandLabel, string> {
  const result: Record<HandLabel, string> = {};
  for (const hand of ALL_HANDS) result[hand] = actionOf(range, hand, defaultActionId);
  return result;
}

/** Remove mãos que já usam a ação padrão (armazenamento compacto). */
export function compactRange(range: Range, defaultActionId: string): Range {
  const result: Range = {};
  for (const hand of ALL_HANDS) {
    const action = range[hand];
    if (action !== undefined && action !== defaultActionId) result[hand] = action;
  }
  return result;
}

export function paintHands(range: Range, hands: readonly HandLabel[], actionId: string): Range {
  const result: Range = { ...range };
  for (const hand of hands) {
    if (!isHandLabel(hand)) throw new Error(`Mão inválida: ${hand}`);
    result[hand] = actionId;
  }
  return result;
}

export interface ActionShare {
  actionId: string;
  hands: number;
  combos: number;
  /** Porcentagem das 1326 combinações. */
  percent: number;
}

/** Quantas mãos/combos/porcentagem cada ação ocupa no range. */
export function rangeBreakdown(range: Range, defaultActionId: string): ActionShare[] {
  const totals = new Map<string, { hands: number; combos: number }>();
  for (const hand of ALL_HANDS) {
    const action = actionOf(range, hand, defaultActionId);
    const entry = totals.get(action) ?? { hands: 0, combos: 0 };
    entry.hands += 1;
    entry.combos += comboCount(hand);
    totals.set(action, entry);
  }
  return [...totals.entries()]
    .map(([actionId, { hands, combos }]) => ({
      actionId,
      hands,
      combos,
      percent: Math.round((combos / TOTAL_COMBOS) * 1000) / 10,
    }))
    .sort((a, b) => b.combos - a.combos);
}

/** Problemas do range em relação à legenda (vazio = válido). */
export function validateRange(range: Range, legend: Legend, defaultActionId: string): string[] {
  const errors: string[] = [];
  const ids = new Set(legend.map((action) => action.id));
  if (!ids.has(defaultActionId)) errors.push(`A ação padrão "${defaultActionId}" não existe na legenda.`);
  for (const [hand, action] of Object.entries(range)) {
    if (!isHandLabel(hand)) errors.push(`Mão inválida: ${hand}.`);
    else if (action !== undefined && !ids.has(action))
      errors.push(`A mão ${hand} usa a ação "${action}", que não existe na legenda.`);
  }
  return errors;
}

/** Mãos na fronteira: algum vizinho na grade tem ação diferente. São as mais difíceis de acertar. */
export function borderHands(range: Range, defaultActionId: string): HandLabel[] {
  return ALL_HANDS.filter((hand) => {
    const action = actionOf(range, hand, defaultActionId);
    return gridNeighbors(hand).some((n) => actionOf(range, n, defaultActionId) !== action);
  });
}

// ---------------------------------------------------------------------------
// Notação de range em texto: "22+, A2s+, KTo+, QJs, T9s-T7s, 99-66"
// ---------------------------------------------------------------------------

function rankIndex(rank: string | undefined): number {
  if (!rank) throw new Error("Mão incompleta");
  const index = RANKS.indexOf(rank.toUpperCase() as Rank);
  if (index < 0) throw new Error(`Carta inválida: ${rank}`);
  return index;
}

function normalizeToken(token: string): string {
  const t = token.trim();
  if (t.length < 2) return t;
  return t[0].toUpperCase() + t[1].toUpperCase() + t.slice(2).toLowerCase();
}

function expandSingle(token: string): HandLabel[] {
  const t = normalizeToken(token);
  const plus = t.endsWith("+");
  const base = plus ? t.slice(0, -1) : t;
  const r1 = base[0];
  const r2 = base[1];
  const suffix = base.slice(2);
  const i1 = rankIndex(r1);
  const i2 = rankIndex(r2);

  if (i1 === i2) {
    if (suffix) throw new Error(`Par não leva "s" ou "o": ${token}`);
    if (!plus) return [`${r1}${r2}`];
    // 77+ = 77 até AA
    const result: HandLabel[] = [];
    for (let i = i1; i >= 0; i--) result.push(`${RANKS[i]}${RANKS[i]}`);
    return result;
  }

  const [hi, lo] = i1 < i2 ? [i1, i2] : [i2, i1];
  const kinds = suffix === "s" ? ["s"] : suffix === "o" ? ["o"] : suffix === "" ? ["s", "o"] : null;
  if (!kinds) throw new Error(`Sufixo inválido em ${token}`);
  const kickers: number[] = [];
  if (plus) {
    // A2s+ = A2s até AKs (o kicker sobe até ficar logo abaixo da carta alta)
    for (let k = lo; k > hi; k--) kickers.push(k);
  } else {
    kickers.push(lo);
  }
  const result: HandLabel[] = [];
  for (const k of kickers) for (const kind of kinds) result.push(`${RANKS[hi]}${RANKS[k]}${kind}`);
  return result;
}

function expandDash(left: string, right: string): HandLabel[] {
  const a = normalizeToken(left);
  const b = normalizeToken(right);
  const ia1 = rankIndex(a[0]);
  const ia2 = rankIndex(a[1]);
  const ib1 = rankIndex(b[0]);
  const ib2 = rankIndex(b[1]);
  const suffixA = a.slice(2);
  const suffixB = b.slice(2);
  if (suffixA !== suffixB) throw new Error(`Intervalo com tipos diferentes: ${left}-${right}`);

  if (ia1 === ia2 && ib1 === ib2) {
    // 99-66
    const [from, to] = ia1 < ib1 ? [ia1, ib1] : [ib1, ia1];
    const result: HandLabel[] = [];
    for (let i = from; i <= to; i++) result.push(`${RANKS[i]}${RANKS[i]}`);
    return result;
  }
  if (ia1 !== ib1) throw new Error(`Intervalo precisa ter a mesma carta alta: ${left}-${right}`);
  // A5s-A2s
  const [from, to] = ia2 < ib2 ? [ia2, ib2] : [ib2, ia2];
  const result: HandLabel[] = [];
  for (let k = from; k <= to; k++) result.push(...expandSingle(`${a[0]}${RANKS[k]}${suffixA}`));
  return result;
}

/** Converte texto em lista de mãos. Lança erro com mensagem clara se algo estiver inválido. */
export function parseRangeNotation(text: string): HandLabel[] {
  const hands = new Set<HandLabel>();
  const tokens = text
    .split(/[,\s;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const token of tokens) {
    const parts = token.split("-");
    if (parts.length > 2) throw new Error(`Intervalo inválido: ${token}`);
    const expanded = parts.length === 2 ? expandDash(parts[0], parts[1]) : expandSingle(token);
    for (const hand of expanded) {
      if (!isHandLabel(hand)) throw new Error(`Mão inválida: ${token}`);
      hands.add(hand);
    }
  }
  return ALL_HANDS.filter((hand) => hands.has(hand));
}

/** Monta um range a partir de linhas "ação: notação". Ex.: { rfi: "22+, A2s+", shove: "..." } */
export function rangeFromNotation(byAction: Record<string, string>): Range {
  let range: Range = {};
  for (const [actionId, notation] of Object.entries(byAction)) {
    range = paintHands(range, parseRangeNotation(notation), actionId);
  }
  return range;
}
