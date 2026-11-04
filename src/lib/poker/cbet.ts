/**
 * Cbet flop IP vs BB — estratégia MES do Baga (aula 05 "Cbet IP vs BB").
 * A classe do flop decide se é range bet (todas as mãos apostam o mesmo tamanho) ou split (X_B):
 * no split, a mão decide entre apostar e dar check.
 */
import { type Card, type Rank, cardRank, cardSuit, rankValue } from "./cards";
import { flopTexture } from "./texture";

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
  const sigla = texture.pattern.replaceAll("-", "");
  const count = (c: string) => classes.filter((x) => x === c).length;
  if (count("A") > 0) return { group: "a", label: `Ás no board (${sigla})`, mode: "range", size: b40 };
  const h = count("H");
  if (h >= 2) return { group: "hh", label: `Dois ou mais high (${sigla})`, mode: "range", size: b40 };
  if (h === 1) {
    if (count("L") === 2) return { group: "h-l-l", label: "HLL", mode: "range", size: "bet-25" };
    return { group: texture.pattern.toLowerCase(), label: sigla, mode: "range", size: b40 };
  }
  return { group: "sem-high", label: `Médio/baixo sem broadway (${sigla})`, mode: "split", size: "bet-40" };
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
  /** Por que a mão aposta ou dá check, no vocabulário da aula. */
  reason: string;
}

const hand = (category: string, bet: boolean, reason: string): HandRead => ({ category, bet, reason });

/** Maior topo de sequência possível para qualquer mão neste board (0 = board sem sequência). */
function nutStraightTop(bv: number[]): number {
  let best = 0;
  for (let a = 2; a <= 14; a++) for (let b = a; b <= 14; b++) best = Math.max(best, straightTop([a, b, ...bv]));
  return best;
}

function straightTop(ranks: number[]): number {
  const has = new Set(ranks.flatMap((r) => (r === 14 ? [14, 1] : [r])));
  for (let high = 14; high >= 5; high--) if ([0, 1, 2, 3, 4].every((d) => has.has(high - d))) return high;
  return 0;
}

/**
 * Sem mão feita (ar, Ás/Rei-alto, draws): o EV de apostar e de checar é o mesmo, então a aula
 * divide pelo critério de naipe — combos off apostam, combos suited dão check.
 */
function noMadeHand(hero: readonly Card[], board: readonly Card[], hv: number[], bv: number[]): HandRead {
  const top = Math.max(...bv);
  const suits = [...hero, ...board].map(cardSuit);
  const flushDraw = hero.some((c) => suits.filter((s) => s === cardSuit(c)).length === 4);
  const straight = straightOuts([...hv, ...bv]);
  const boardOnly = straightOuts(bv);
  const oesd = straight.outs.length >= 2 && boardOnly.outs.length < straight.outs.length;
  const gutshot = straight.outs.length === 1 && boardOnly.outs.length === 0;
  const kind =
    flushDraw && oesd
      ? "Combo draw"
      : flushDraw
        ? "Flush draw"
        : oesd
          ? "OESD"
          : gutshot
            ? "Gutshot"
            : hv[0] > top && hv[1] > top
              ? "Duas overcards"
              : hv.includes(14)
                ? "Ás-alto"
                : hv.includes(13)
                  ? "Rei-alto"
                  : "Ar";
  const suited = cardSuit(hero[0]) === cardSuit(hero[1]);
  return suited
    ? hand(`${kind} · suited`, false, "Sem mão feita: combos suited dão check (critério de naipe).")
    : hand(`${kind} · offsuit`, true, "Sem mão feita: combos off apostam (critério de naipe).");
}

/**
 * Leitura da mão nos boards de split, como a aula 05 constrói o split:
 * protege o check com as mãos mais fortes, aposta valor que precisa de proteção,
 * escadinha invertida nos overpairs, metade de cima dos top pairs e naipe no resto.
 */
export function readHand(hero: readonly Card[], flop: readonly Card[]): HandRead {
  const board = flop.slice(0, 3);
  const hv = hero.map((c) => value(cardRank(c))).sort((a, b) => b - a);
  const bv = board.map((c) => value(cardRank(c)));
  const top = Math.max(...bv);
  const low = Math.min(...bv);
  const count = (v: number) => bv.filter((x) => x === v).length;
  const pocket = hv[0] === hv[1];
  const pairRank = bv.find((v) => count(v) === 2);

  if (pairRank !== undefined) {
    // Dobra média/baixa (X_B25)
    const single = bv.find((v) => v !== pairRank)!;
    if (pocket && hv[0] === pairRank)
      return hand("Quadra", false, "Nuts que bloqueia o call do BB: check para proteger o range.");
    if ((pocket && hv[0] === single) || (!pocket && hv.includes(pairRank) && hv.includes(single)))
      return hand("Full house", false, "Nuts que bloqueia o call do BB: check para proteger o range.");
    if (!pocket && hv.includes(pairRank))
      return hand("Trinca", true, "Valor que ainda leva draws contra: aposta.");
    if (pocket && hv[0] > top)
      return hv[0] >= 13
        ? hand("Overpair alto", false, "Escadinha invertida: KK/AA dão check.")
        : hand("Overpair", true, "Escadinha invertida: os overpairs mais baixos apostam (pedem proteção).");
    if (!pocket && hv.includes(single)) {
      if (single === top) {
        const kicker = hv[0] === top ? hv[1] : hv[0];
        return kicker >= 10
          ? hand("Top pair, kicker bom", true, "Metade de cima dos top pairs aposta.")
          : hand("Top pair, kicker fraco", false, "Metade de baixo dos top pairs dá check.");
      }
      return hand("Par baixo", true, "Pares baixos apostam por proteção.");
    }
    if (pocket) {
      if (hv[0] < low) return hand("Par abaixo do board", true, "Pares baixos apostam por proteção.");
      return hv[0] <= 8
        ? hand("Underpair baixo", true, "Underpairs baixos apostam por proteção.")
        : hand("Underpair alto", false, "Underpairs altos bloqueiam os combos off que foldam: check.");
    }
    return noMadeHand(hero, board, hv, bv);
  }

  // Board sem broadway, sem dobra (X_B40)
  const nutTop = nutStraightTop(bv);
  const heroTop = straightTop([...hv, ...bv]);
  if (heroTop > 0)
    return heroTop === nutTop
      ? hand("Sequência nuts", false, "A melhor mão do range dá check para proteger o check.")
      : hand("Sequência", true, "Valor forte abaixo do nuts: aposta.");
  if (pocket && count(hv[0]) === 1)
    return nutTop > 0
      ? hand("Set", true, "Com sequência possível, o set é valor que aposta.")
      : hand("Set", false, "Melhor mão do range sem sequência no board: check para proteger.");
  const paired = hv.filter((v) => count(v) === 1);
  if (!pocket && paired.length === 2) return hand("Dois pares", true, "Valor forte: aposta.");
  if (pocket && hv[0] > top)
    return hv[0] >= 13
      ? hand("Overpair alto", false, "Escadinha invertida: KK/AA dão check.")
      : hand("Overpair", true, "Escadinha invertida: os overpairs mais baixos apostam.");
  if (!pocket && paired[0] === top) {
    const kicker = hv[0] === top ? hv[1] : hv[0];
    return kicker >= 10
      ? hand("Top pair, kicker bom", true, "Metade de cima dos top pairs aposta.")
      : hand("Top pair, kicker fraco", false, "Metade de baixo dos top pairs dá check.");
  }
  if (pocket) return hand("Par médio", false, "Pares médios dão check.");
  if (paired.length > 0) {
    const below = [...new Set(bv)].filter((v) => v > paired[0]).length;
    return hand(below >= 2 ? "Terceiro par" : "Segundo par", false, "Pares médios dão check.");
  }
  return noMadeHand(hero, board, hv, bv);
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
