/**
 * BB vs 2nd Barrel (Posflop Defense, aula 24): o BB pagou o cbet do flop e enfrenta o barrel no turn.
 * O size do vilão sai do tipo de turn (tabela da aula); a resposta sai do bottom de call por posição do
 * vilão, do bottom de reação dos draws por size e dos gatilhos de X/R bluff.
 */
import { type Card, cardRank, cardSuit, rankValue } from "./cards";

export type BarrelPos = "EP" | "MP" | "LP";
export type BarrelSize = 25 | 40 | 50 | 67 | 75 | 125;
export type BarrelAction = "vc-fold" | "vc-call" | "vc-raise";

const isStraight = (set: Set<number>) => {
  for (let low = 1; low <= 10; low++) if ([0, 1, 2, 3, 4].every((d) => set.has(low + d))) return true;
  return false;
};
const withAce = (vals: number[]) => new Set(vals.flatMap((x) => (x === 14 ? [14, 1] : [x])));
function outs(vals: number[]): number {
  const has = withAce(vals);
  if (isStraight(has)) return -1;
  let n = 0;
  for (let r = 2; r <= 14; r++) {
    if (has.has(r)) continue;
    const next = new Set(has);
    next.add(r);
    if (r === 14) next.add(1);
    if (isStraight(next)) n++;
  }
  return n;
}
/** Janela de 5 valores com pelo menos n cartas distintas. */
function windowWith(vals: number[], n: number): boolean {
  const has = withAce(vals);
  for (let low = 1; low <= 10; low++) if ([0, 1, 2, 3, 4].filter((d) => has.has(low + d)).length >= n) return true;
  return false;
}

export type TurnType = "A" | "H" | "M" | "L" | "DH" | "DM" | "DL" | "3S" | "4S" | "3F" | "4F";

/** Tipo do turn (siglas da aula). Ordem: flush, sequência, dobra, altura da carta. */
export function turnType(board: readonly Card[]): TurnType {
  const flop = board.slice(0, 3);
  const turn = board[3];
  const fv = flop.map((c) => rankValue(cardRank(c)));
  const tv = rankValue(cardRank(turn));
  const suitN = board.slice(0, 4).filter((c) => cardSuit(c) === cardSuit(turn)).length;
  if (suitN === 4) return "4F";
  if (suitN === 3) return "3F";
  const all = [...fv, tv];
  if (windowWith(all, 4) && !windowWith(fv, 4)) return "4S";
  if (windowWith(all, 3) && !windowWith(fv, 3)) return "3S";
  if (fv.includes(tv)) return tv >= 10 ? "DH" : tv >= 6 ? "DM" : "DL";
  if (tv === 14) return "A";
  return tv >= 10 ? "H" : tv >= 6 ? "M" : "L";
}

/** Size do 2nd barrel por tipo de turn (A e 4F alternam entre os dois sizes da aula). */
export function barrelSize(board: readonly Card[]): BarrelSize {
  const type = turnType(board);
  const flip = board.slice(0, 4).reduce((n, c) => n + rankValue(cardRank(c)), 0) % 2 === 0;
  const map: Record<TurnType, BarrelSize> = {
    A: flip ? 50 : 125,
    H: 67,
    M: 67,
    L: 125,
    DH: 67,
    DM: 40,
    DL: 125,
    "3S": 75,
    "4S": 25,
    "3F": 50,
    "4F": flip ? 25 : 125,
  };
  return map[type];
}

/** Turn que é overcard do flop (runout natural de barrel). */
function overcardTurn(board: readonly Card[]): boolean {
  return rankValue(cardRank(board[3])) > Math.max(...board.slice(0, 3).map((c) => rankValue(cardRank(c))));
}

export interface BarrelRead {
  action: BarrelAction;
  category: string;
  reason: string;
}

const read = (action: BarrelAction, category: string, reason: string): BarrelRead => ({ action, category, reason });

export function barrelAnswer(hero: readonly Card[], fullBoard: readonly Card[], pos: BarrelPos): BarrelRead {
  const board = fullBoard.slice(0, 4);
  const size = barrelSize(board);
  const hv = hero.map((c) => rankValue(cardRank(c))).sort((a, b) => b - a);
  const bv = board.map((c) => rankValue(cardRank(c)));
  const distinct = [...new Set(bv)].sort((a, b) => b - a);
  const count = (x: number) => bv.filter((y) => y === x).length;
  const pocket = hv[0] === hv[1];
  const suits = [...hero, ...board].map(cardSuit);
  const suitN = (s: string) => suits.filter((x) => x === s).length;
  const flush = hero.some((c) => suitN(cardSuit(c)) >= 5);
  const straight = isStraight(withAce([...hv, ...bv])) && !isStraight(withAce(bv));
  const paired = hv.filter((x) => count(x) >= 1);
  const strong =
    straight ||
    flush ||
    (pocket && count(hv[0]) >= 1) ||
    paired.some((x) => count(x) >= 2) ||
    (!pocket && paired.length === 2);
  if (strong) return read("vc-raise", "Dois pares ou melhor", "Valor: X/R no 2nd barrel.");

  // Draws
  const fdSuit = hero.find((c) => suitN(cardSuit(c)) === 4);
  const flushDraw = Boolean(fdSuit);
  const fdHigh = flushDraw ? Math.max(...hero.filter((c) => cardSuit(c) === cardSuit(fdSuit!)).map((c) => rankValue(cardRank(c)))) : 0;
  const o = outs([...hv, ...bv]);
  const boardOuts = outs(bv);
  const heroHelps = o > Math.max(boardOuts, 0);
  const oesd = heroHelps && o >= 2;
  const gutshot = heroHelps && o === 1;
  const over = hv[0] > distinct[0];
  const combo = flushDraw && (oesd || gutshot);
  /** Draw "médio" (não é dos mais baixos): flush draw com carta T+ ou OESD com carta do herói 9+. */
  const drawMedium = (flushDraw && fdHigh >= 10) || (oesd && hv[0] >= 9);

  // Pares: posição relativa ao board
  let pairRank = 0; // 1 = top pair/overpair, 2 = segundo par, 3 = terceiro par ou pior
  let kicker = 0;
  if (pocket) pairRank = hv[0] > distinct[0] ? 1 : hv[0] > (distinct[1] ?? 0) ? 2 : 3;
  else if (paired.length === 1) {
    const idx = distinct.indexOf(paired[0]);
    pairRank = Math.min(idx + 1, 3);
    kicker = hv[0] === paired[0] ? hv[1] : hv[0];
  }
  const goodKicker = pocket || kicker >= 11;

  const callsMade =
    pairRank === 1 ||
    (pairRank === 2 && (pos !== "EP" || goodKicker)) ||
    (pairRank === 3 && pos === "LP" && goodKicker);
  const bottom = { EP: "2nd pair good kicker", MP: "qualquer 2nd pair", LP: "3rd pair good kicker" }[pos];
  const pairLabel = pairRank === 1 ? "Top pair / overpair" : pairRank === 2 ? "Segundo par" : pairRank === 3 ? "Terceiro par ou pior" : "";

  if (callsMade) return read("vc-call", `${pairLabel}${pairRank > 1 ? (goodKicker ? ", kicker bom" : ", kicker fraco") : ""}`, `Bottom de call vs ${pos}: ${bottom}.`);

  // Gatilhos de X/R bluff: vs RFI amplo (LP), size < b80, turn overcard, draw sem showdown
  if (pos === "LP" && size < 80 && overcardTurn(board) && pairRank === 0 && (oesd || flushDraw || gutshot))
    return read("vc-raise", "Draw sem showdown", "Gatilhos de X/R bluff: RFI amplo, size < b80 e turn overcard.");

  if (size === 125 && combo) return read("vc-raise", "Combo draw", "Vs b125: X/jam com combo draws.");
  const drawLabel = combo ? "Combo draw" : flushDraw ? "Flush draw" : oesd ? "2 pontas" : gutshot ? (over ? "Broca + over" : "Broca") : "";
  if (drawLabel) {
    const continues =
      size === 125
        ? drawMedium || combo
        : size >= 75
          ? flushDraw || oesd
          : size >= 50
            ? flushDraw || oesd || (gutshot && over)
            : true;
    const bottomDraw =
      size === 125 ? "OESD/FD médios" : size >= 75 ? "OESD/FD baixos" : size >= 50 ? "broca + over" : "broca";
    return continues
      ? read("vc-call", drawLabel, `Vs b${size}: o bottom de reação dos draws é ${bottomDraw}.`)
      : read("vc-fold", drawLabel, `Vs b${size}: o draw está abaixo do bottom (${bottomDraw}).`);
  }
  if (pairRank > 0) return read("vc-fold", `${pairLabel}${goodKicker ? "" : ", kicker fraco"}`, `Abaixo do bottom de call vs ${pos} (${bottom}).`);
  return read("vc-fold", hv[0] === 14 ? "Ás-alto" : "Air", "Sem par e sem draw: fold.");
}
