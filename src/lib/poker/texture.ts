/**
 * Classificação de boards do time:
 *   Ás = categoria própria ("A"), T a K = high ("H"), 9 a 6 = mid ("M"), 5 a 2 = low ("L").
 */
import { type Card, type Rank, cardRank, cardSuit, rankValue } from "./cards";

export const CARD_CLASSES = ["A", "H", "M", "L"] as const;
export type CardClass = (typeof CARD_CLASSES)[number];

export const CARD_CLASS_LABELS: Record<CardClass, string> = {
  A: "Ás",
  H: "High",
  M: "Mid",
  L: "Low",
};

export type SuitTexture = "monotone" | "twotone" | "rainbow";
export type PairTexture = "nao" | "pareado" | "trinca";

export const SUIT_TEXTURE_LABELS: Record<SuitTexture, string> = {
  monotone: "Monotone",
  twotone: "Two-tone",
  rainbow: "Rainbow",
};

export const PAIR_TEXTURE_LABELS: Record<PairTexture, string> = {
  nao: "Sem par",
  pareado: "Pareado (dobrado)",
  trinca: "Trinca",
};

export function cardClass(rank: Rank): CardClass {
  if (rank === "A") return "A";
  const value = rankValue(rank);
  if (value >= 10) return "H";
  if (value >= 6) return "M";
  return "L";
}

export interface FlopTexture {
  /** Classes em ordem decrescente, ex.: "H-M-L", "A-L-L". */
  pattern: string;
  suits: SuitTexture;
  paired: PairTexture;
  /** Classe da carta que pareou, quando o flop é pareado ou trinca. */
  pairedClass: CardClass | null;
}

export interface BoardTexture {
  flop: FlopTexture;
  turnClass: CardClass | null;
  riverClass: CardClass | null;
}

const CLASS_ORDER: Record<CardClass, number> = { A: 0, H: 1, M: 2, L: 3 };

export function flopTexture(flop: readonly Card[]): FlopTexture {
  if (flop.length !== 3) throw new Error("O flop precisa ter 3 cartas");
  if (new Set(flop).size !== 3) throw new Error("Cartas repetidas no flop");
  const classes = flop
    .map((card) => cardClass(cardRank(card)))
    .sort((a, b) => CLASS_ORDER[a] - CLASS_ORDER[b]);
  const suitCount = new Set(flop.map(cardSuit)).size;
  const suits: SuitTexture = suitCount === 1 ? "monotone" : suitCount === 2 ? "twotone" : "rainbow";

  const rankCounts = new Map<Rank, number>();
  for (const card of flop) rankCounts.set(cardRank(card), (rankCounts.get(cardRank(card)) ?? 0) + 1);
  let paired: PairTexture = "nao";
  let pairedClass: CardClass | null = null;
  for (const [rank, count] of rankCounts) {
    if (count >= 2) {
      paired = count === 3 ? "trinca" : "pareado";
      pairedClass = cardClass(rank);
    }
  }
  return { pattern: classes.join("-"), suits, paired, pairedClass };
}

export function boardTexture(board: readonly Card[]): BoardTexture {
  if (board.length < 3) throw new Error("O board precisa ter pelo menos o flop");
  if (new Set(board).size !== board.length) throw new Error("Cartas repetidas no board");
  return {
    flop: flopTexture(board.slice(0, 3)),
    turnClass: board[3] ? cardClass(cardRank(board[3])) : null,
    riverClass: board[4] ? cardClass(cardRank(board[4])) : null,
  };
}

export function describeFlop(texture: FlopTexture): string {
  const pattern = texture.pattern
    .split("-")
    .map((c) => CARD_CLASS_LABELS[c as CardClass])
    .join("-");
  const parts = [pattern, SUIT_TEXTURE_LABELS[texture.suits]];
  if (texture.paired !== "nao" && texture.pairedClass)
    parts.push(`${PAIR_TEXTURE_LABELS[texture.paired]} em ${CARD_CLASS_LABELS[texture.pairedClass]}`);
  return parts.join(" · ");
}

/**
 * Filtro de textura usado nas estratégias pós-flop. Campos ausentes aceitam qualquer valor.
 * Padrões aceitam "*" como coringa por posição, ex.: "A-*-*".
 */
export interface TextureMatch {
  patterns?: string[];
  suits?: SuitTexture[];
  paired?: PairTexture[];
  pairedClass?: CardClass[];
  turnClass?: CardClass[];
  riverClass?: CardClass[];
}

export function patternMatches(filter: string, pattern: string): boolean {
  const f = filter.toUpperCase().split("-");
  const p = pattern.split("-");
  return f.length === p.length && f.every((part, i) => part === "*" || part === p[i]);
}

export function textureMatches(match: TextureMatch, texture: BoardTexture): boolean {
  const { flop } = texture;
  if (match.patterns?.length && !match.patterns.some((f) => patternMatches(f, flop.pattern))) return false;
  if (match.suits?.length && !match.suits.includes(flop.suits)) return false;
  if (match.paired?.length && !match.paired.includes(flop.paired)) return false;
  if (match.pairedClass?.length && (!flop.pairedClass || !match.pairedClass.includes(flop.pairedClass)))
    return false;
  if (match.turnClass?.length && (!texture.turnClass || !match.turnClass.includes(texture.turnClass)))
    return false;
  if (match.riverClass?.length && (!texture.riverClass || !match.riverClass.includes(texture.riverClass)))
    return false;
  return true;
}

const VALID_PATTERN = /^(A|H|M|L|\*)-(A|H|M|L|\*)-(A|H|M|L|\*)$/;

export function validateTextureMatch(match: TextureMatch): string[] {
  const errors: string[] = [];
  for (const pattern of match.patterns ?? []) {
    if (!VALID_PATTERN.test(pattern.toUpperCase()))
      errors.push(`Padrão de textura inválido "${pattern}". Use A, H, M, L ou * separados por hífen.`);
  }
  return errors;
}
