/**
 * Histórico da mão nos spots pós-flop: o que aconteceu em cada street antes da decisão.
 * Ex.: Pré-flop "HJ raise 2bb · BB call" → Flop [A♠ 7♦ 2♣] "BB X · HJ B67 · BB C" → Turn [K♥] "BB X".
 *
 * As linhas vêm do campo `history` da estratégia (uma por street, a partir do pré-flop). Nas mãos com
 * várias decisões, `{flop}`, `{turn}` e `{river}` viram a ação que o herói escolheu naquela street.
 */
import type { Card } from "./cards";
import { type Legend, findAction } from "./legend";
import { STREETS, type Street } from "./strategy";

export interface HistoryLine {
  street: Street;
  /** Cartas que saíram nesta street (o flop inteiro, ou a carta do turn/river). */
  cards: Card[];
  actions: string;
}

/** Ação em notação curta de mão: X, C, F, B67, R, AI. */
export function shortAction(actionId: string, legend: Legend): string {
  const action = findAction(legend, actionId);
  if (!action) return actionId;
  const size = action.sizing?.match(/^(\d+(?:[.,]\d+)?)%$/)?.[1];
  switch (action.kind) {
    case "check":
      return "X";
    case "call":
      return "C";
    case "fold":
      return "F";
    case "allin":
      return "AI";
    case "bet":
      return size ? `B${size}` : action.label;
    case "raise":
      return size ? `R${size}` : "R";
    default:
      return action.label;
  }
}

function streetCards(street: Street, board: readonly Card[]): Card[] {
  if (street === "flop") return board.slice(0, 3);
  if (street === "turn") return board.slice(3, 4);
  if (street === "river") return board.slice(4, 5);
  return [];
}

/**
 * Linhas do histórico até a street da decisão. `chosen` traz a ação do herói nas decisões anteriores
 * desta mão, por street. Streets sem texto mostram só as cartas (ex.: o herói age primeiro no flop).
 */
export function handHistory(
  history: readonly string[] | null | undefined,
  street: Street,
  board: readonly Card[],
  chosen: Partial<Record<Street, string>>,
  legend: Legend,
): HistoryLine[] {
  if (!history?.length || street === "preflop") return [];
  const upTo = STREETS.indexOf(street);
  const lines: HistoryLine[] = [];
  for (let i = 0; i <= upTo; i++) {
    const s = STREETS[i];
    const actions = (history[i] ?? "").replace(/\{(flop|turn|river)\}/g, (_, at: Street) =>
      chosen[at] ? shortAction(chosen[at]!, legend) : "bet",
    );
    const cards = streetCards(s, board);
    if (!actions && !cards.length) continue;
    lines.push({ street: s, cards, actions });
  }
  return lines;
}
