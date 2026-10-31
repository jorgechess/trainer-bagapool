/** As 169 mãos iniciais do pré-flop (grade 13x13). */
import { RANKS, SUITS, type Card, type Rank, cardRank, cardSuit, rankValue } from "./cards";

/** Ex.: "AA", "AKs", "AKo". */
export type HandLabel = string;

/**
 * Grade padrão: linha i, coluna j.
 * Diagonal = pares; acima da diagonal (j > i) = suited; abaixo = offsuit.
 */
export function handAt(row: number, col: number): HandLabel {
  const r1 = RANKS[row];
  const r2 = RANKS[col];
  if (row === col) return `${r1}${r2}`;
  if (col > row) return `${r1}${r2}s`;
  return `${r2}${r1}o`;
}

export const HAND_GRID: HandLabel[][] = RANKS.map((_, row) => RANKS.map((__, col) => handAt(row, col)));

export const ALL_HANDS: HandLabel[] = HAND_GRID.flat();

const HAND_SET = new Set(ALL_HANDS);

export function isHandLabel(value: string): boolean {
  return HAND_SET.has(value);
}

/** Posição da mão na grade. */
export function handPosition(hand: HandLabel): { row: number; col: number } {
  const r1 = RANKS.indexOf(hand[0] as Rank);
  const r2 = RANKS.indexOf(hand[1] as Rank);
  if (r1 < 0 || r2 < 0 || !isHandLabel(hand)) throw new Error(`Mão inválida: ${hand}`);
  if (hand.length === 2) return { row: r1, col: r1 };
  return hand[2] === "s" ? { row: r1, col: r2 } : { row: r2, col: r1 };
}

export function handType(hand: HandLabel): "par" | "suited" | "offsuit" {
  if (hand.length === 2) return "par";
  return hand[2] === "s" ? "suited" : "offsuit";
}

/** Quantidade de combinações: par = 6, suited = 4, offsuit = 12. */
export function comboCount(hand: HandLabel): number {
  const type = handType(hand);
  return type === "par" ? 6 : type === "suited" ? 4 : 12;
}

export const TOTAL_COMBOS = 1326;

/** Todas as combinações específicas de uma mão. */
export function combosOf(hand: HandLabel): [Card, Card][] {
  const r1 = hand[0] as Rank;
  const r2 = hand[1] as Rank;
  const type = handType(hand);
  const combos: [Card, Card][] = [];
  if (type === "par") {
    for (let i = 0; i < SUITS.length; i++)
      for (let j = i + 1; j < SUITS.length; j++) combos.push([`${r1}${SUITS[i]}`, `${r1}${SUITS[j]}`]);
  } else if (type === "suited") {
    for (const s of SUITS) combos.push([`${r1}${s}`, `${r2}${s}`]);
  } else {
    for (const s1 of SUITS) for (const s2 of SUITS) if (s1 !== s2) combos.push([`${r1}${s1}`, `${r2}${s2}`]);
  }
  return combos;
}

/** Converte duas cartas no rótulo da mão. */
export function handFromCards(a: Card, b: Card): HandLabel {
  if (a === b) throw new Error("Cartas repetidas");
  const [high, low] = rankValue(cardRank(a)) >= rankValue(cardRank(b)) ? [a, b] : [b, a];
  if (cardRank(high) === cardRank(low)) return `${cardRank(high)}${cardRank(low)}`;
  const suited = cardSuit(high) === cardSuit(low);
  return `${cardRank(high)}${cardRank(low)}${suited ? "s" : "o"}`;
}

/** Vizinhos na grade (cima, baixo, esquerda, direita). */
export function gridNeighbors(hand: HandLabel): HandLabel[] {
  const { row, col } = handPosition(hand);
  const result: HandLabel[] = [];
  for (const [dr, dc] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < 13 && c >= 0 && c < 13) result.push(HAND_GRID[r][c]);
  }
  return result;
}
