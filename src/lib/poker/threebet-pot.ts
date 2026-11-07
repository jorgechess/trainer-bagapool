/**
 * 3bet Pot as Aggressor OOP (Posflop Attack, aula 27): o BB 3-betou o HJ com 30bb, SPR < 2.
 * Flop: cbet de range (b25; b50 com 2 middle cards ou flush draw aberto). Turn e river pelo game plan MES:
 * airs vão de BBB, draws e valor vulnerável armam o check/shove, valor protegido faz slowplay,
 * e depois do check/shove com check behind do vilão, blefe no river.
 */
import { type Card, cardRank, cardSuit, rankValue } from "./cards";
import { bwBbCategory } from "./bw-bb-pos";

export type ThreeBetNode = "flop" | "turn" | "river-bet" | "river-xx";
export const THREEBET_CARDS: Record<ThreeBetNode, number> = { flop: 3, turn: 4, "river-bet": 5, "river-xx": 5 };

export interface ThreeBetRead {
  action: string;
  category: string;
  reason: string;
  label: string;
}

export function threeBetAnswer(hero: readonly Card[], fullBoard: readonly Card[], node: ThreeBetNode): ThreeBetRead {
  const board = fullBoard.slice(0, THREEBET_CARDS[node]);
  const flop = board.slice(0, 3);
  if (node === "flop") {
    const middles = flop.filter((c) => rankValue(cardRank(c)) >= 6 && rankValue(cardRank(c)) <= 9).length;
    const twoTone = new Set(flop.map(cardSuit)).size === 2;
    return middles >= 2 || twoTone
      ? { action: "bet-50", category: "Range", reason: "Cbet de range: b50 com 2 middle cards ou flush draw aberto.", label: "Flop: cbet de range" }
      : { action: "bet-25", category: "Range", reason: "Cbet de range com o size mais usado (b25).", label: "Flop: cbet de range" };
  }
  const cat = bwBbCategory(hero, board);
  const labels: Record<string, string> = {
    top: "Dois pares ou melhor",
    value: "Valor protegido (top pair/overpair)",
    mid: "Valor vulnerável (par médio/baixo)",
    draw: "Draw",
    backdoor: "Air",
    air: "Air",
  };
  const category = labels[cat];
  if (node === "turn") {
    if (cat === "top" || cat === "value")
      return { action: "check", category, reason: "Valor protegido que tomou call no flop: slowplay (check turn).", label: "Turn depois do call no cbet" };
    if (cat === "mid" || cat === "draw")
      return { action: "check", category, reason: "Draw ou valor vulnerável: arma o check/shove no turn.", label: "Turn depois do call no cbet" };
    return { action: "bet-33", category, reason: "Air sem equidade: BBB (3 barrels).", label: "Turn depois do call no cbet" };
  }
  if (node === "river-bet")
    return { action: "shove", category, reason: "BBB: o air segue no 3º barrel (all-in no SPR curto).", label: "River depois do barrel pago" };
  // river-xx: check/shove armado no turn e o vilão deu check behind
  if (cat === "mid")
    return { action: "check", category, reason: "Valor vulnerável com showdown: check.", label: "River depois do check behind no turn" };
  return cat === "top" || cat === "value"
    ? { action: "shove", category, reason: "Valor: aposta o river depois do check behind.", label: "River depois do check behind no turn" }
    : { action: "shove", category, reason: "Armou o check/shove e o vilão deu check behind: bluff river.", label: "River depois do check behind no turn" };
}
