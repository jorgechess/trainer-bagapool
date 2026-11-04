/**
 * Cbet flop IP vs BB — estratégia MES do Baga (aula 05 "Cbet IP vs BB").
 * A classe do flop decide se é range bet (todas as mãos apostam o mesmo tamanho) ou split (X_B):
 * no split, a mão decide entre apostar e dar check.
 */
import { type Card, type Rank, cardRank, cardSuit, rankValue } from "./cards";
import { cardClass, flopTexture } from "./texture";

export type CbetBand = "25-50" | "15";
export interface CbetSpec {
  /** Tabela MES usada (por enquanto só a do cbet IP vs BB). */
  table: "mes-ip-vs-bb";
  band: CbetBand;
}

type Size = "bet-25" | "bet-40";
export interface FlopRule {
  group: string;
  label: string;
  mode: "range" | "split";
  size: Size;
}

const SIZE_LABEL: Record<Size, string> = { "bet-25": "B25", "bet-40": "B40" };

/** Classe do flop pela tabela MES; null = flop fora do drill (trinca no board ou par de Ás). */
export function mesFlopRule(flop: readonly Card[], band: CbetBand): FlopRule | null {
  const texture = flopTexture(flop.slice(0, 3));
  const b40 = band === "25-50" ? "bet-40" : "bet-25";
  if (texture.paired === "trinca") return null;
  if (texture.suits === "monotone") return { group: "mono", label: "Monotone", mode: "range", size: "bet-25" };
  if (texture.paired === "pareado") {
    if (texture.pairedClass === "A") return null;
    if (texture.pairedClass === "H") return { group: "pareado-h", label: "Pareado alto (dobra H)", mode: "range", size: "bet-25" };
    return { group: "pareado-ml", label: "Pareado médio/baixo (dobra M ou L)", mode: "split", size: "bet-25" };
  }
  const classes = texture.pattern.split("-");
  const count = (c: string) => classes.filter((x) => x === c).length;
  if (count("A") > 0) return { group: "a", label: `Ás no board (${texture.pattern})`, mode: "range", size: b40 };
  const h = count("H");
  if (h >= 2) return { group: "hh", label: `Dois ou mais high (${texture.pattern})`, mode: "range", size: b40 };
  if (h === 1) {
    if (count("L") === 2) return { group: "h-l-l", label: "H-L-L", mode: "range", size: "bet-25" };
    return { group: texture.pattern.toLowerCase(), label: texture.pattern, mode: "range", size: b40 };
  }
  return { group: "sem-high", label: `Médio/baixo sem broadway (${texture.pattern})`, mode: "split", size: "bet-40" };
}

const value = (r: Rank) => rankValue(r);

function straightOuts(ranks: number[]): { made: boolean; outs: number[] } {
  const has = new Set(ranks.flatMap((r) => (r === 14 ? [14, 1] : [r])));
  const isStraight = (set: Set<number>) => {
    for (let low = 1; low <= 10; low++) if ([0, 1, 2, 3, 4].every((d) => set.has(low + d))) return true;
    return false;
  };
  if (isStraight(has)) return { made: true, outs: [] };
  const outs: number[] = [];
  for (let r = 2; r <= 14; r++) {
    if (has.has(r)) continue;
    const next = new Set(has);
    next.add(r);
    if (r === 14) next.add(1);
    if (isStraight(next)) outs.push(r);
  }
  return { made: false, outs };
}

export interface HandRead {
  category: string;
  bet: boolean;
}

/** Leitura da mão no flop para os boards de split (regra confirmada pelo time). */
export function readHand(hero: readonly Card[], flop: readonly Card[]): HandRead {
  const board = flop.slice(0, 3);
  const hv = hero.map((c) => value(cardRank(c)));
  const bv = board.map((c) => value(cardRank(c)));
  const top = Math.max(...bv);
  const boardCount = (v: number) => bv.filter((x) => x === v).length;
  const pocket = hv[0] === hv[1];

  // Feita e valor forte
  const all = [...hv, ...bv];
  const straight = straightOuts(all);
  const heroBoardOnly = straightOuts(bv);
  if (straight.made && !heroBoardOnly.made) return { category: "Sequência", bet: true };
  if (pocket && boardCount(hv[0]) >= 1) return { category: boardCount(hv[0]) >= 2 ? "Full house" : "Set", bet: true };
  const paired = hv.filter((v) => boardCount(v) >= 1);
  if (!pocket && hv.some((v) => boardCount(v) >= 2)) return { category: "Trinca", bet: true };
  const boardPair = bv.find((v) => boardCount(v) === 2);
  if (!pocket && paired.length === 2 && hv[0] !== hv[1]) return { category: "Dois pares", bet: true };
  if (pocket && hv[0] > top) return { category: "Overpair", bet: true };

  const topPair = !pocket && hv.includes(top) && boardCount(top) === 1;
  const kicker = topPair ? (hv[0] === top ? hv[1] : hv[0]) : 0;
  if (topPair && kicker >= 10) return { category: "Top pair, kicker bom", bet: true };

  // Draws (pelo menos uma carta do herói participa)
  const suits = [...hero, ...board].map(cardSuit);
  const flushDraw = hero.some((c) => suits.filter((s) => s === cardSuit(c)).length === 4);
  const oesd = straight.outs.length >= 2 && heroBoardOnly.outs.length < straight.outs.length;
  if (flushDraw && oesd) return { category: "Combo draw", bet: true };
  if (flushDraw) return { category: "Flush draw", bet: true };
  if (oesd) return { category: "OESD", bet: true };

  // Equity média protegida
  if (topPair) return { category: "Top pair, kicker fraco", bet: false };
  if (pocket) return { category: "Underpair", bet: false };
  if (paired.length > 0) {
    const pairValue = paired[0];
    const below = [...new Set(bv)].filter((v) => v > pairValue && v !== boardPair).length;
    return { category: below >= 2 ? "Terceiro par" : "Segundo par", bet: false };
  }
  if (hv[0] > top && hv[1] > top) return { category: "Overcards sem showdown", bet: true };
  if (hv.includes(14)) return { category: "Ás-alto com showdown", bet: false };
  return { category: "Ar sem draw", bet: false };
}

export interface CbetAnswer {
  action: "check" | Size;
  rule: FlopRule;
  hand: HandRead | null;
}

export function cbetAnswer(spec: CbetSpec, hero: readonly Card[], board: readonly Card[]): CbetAnswer | null {
  const rule = mesFlopRule(board, spec.band);
  if (!rule) return null;
  if (rule.mode === "range") return { action: rule.size, rule, hand: null };
  const hand = readHand(hero, board);
  return { action: hand.bet ? rule.size : "check", rule, hand };
}

export function ruleSummary(rule: FlopRule): string {
  return rule.mode === "range" ? `Range bet ${SIZE_LABEL[rule.size]}` : `Split X_${SIZE_LABEL[rule.size]}`;
}
