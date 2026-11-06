/**
 * Cbet flop IP vs BB — estratégia MES do Baga (aula 05 "Cbet IP vs BB").
 * A classe do flop decide se é range bet (todas as mãos apostam o mesmo tamanho) ou split (X_B):
 * no split, a mão decide entre apostar e dar check.
 */
import { type Card, type Rank, cardRank, cardSuit, rankValue } from "./cards";
import { flopTexture } from "./texture";
import { findVsCbetBoard, vsCbetAnswer } from "./vs-cbet";
import { type BarrelPos, type BarrelSize, barrelAnswer, barrelSize, turnType } from "./bb-vs-barrel";
import { BW_BB_CARDS, BW_BB_GUIDE, type BwBbNode, bwBbAnswer } from "./bw-bb-pos";

export type CbetBand = "25-50" | "15";
/** Nó da Blind War: RC = SB deu raise e o BB pagou; LX = SB completou e o BB deu check. */
export type BwNode = "rc" | "lx";
export type CbetSpec =
  | {
      /** Cbet IP vs BB (aula 05). */
      table: "mes-ip-vs-bb";
      band: CbetBand;
    }
  | {
      /** BW SB pós (aula 17): o SB age primeiro no flop. */
      table: "bw-sb";
      node: BwNode;
    }
  | {
      /** BB Leads (Posflop Defense): donk bet do BB no flop, no turn depois do lead/call, no turn e no river. */
      table: "bb-lead";
      node: BbLeadNode;
    }
  | {
      /** BB vs 2nd Barrel (Posflop Defense, aula 24): BB pagou o cbet do flop e enfrenta o barrel no turn. */
      table: "bb-vs-barrel";
      pos: BarrelPos;
      size: BarrelSize;
    }
  | {
      /** BW BB pós (Blind War): o BB contra o SB em single raised, limped e ISO. */
      table: "bw-bb";
      node: BwBbNode;
    }
  | {
      /** BB vs Cbet flop (Posflop Defense): X/C, X/R 3x ou X/F pela planilha do time, nos boards de exemplo. */
      table: "bb-vs-cbet";
    }
  | {
      /** BB Probes (Posflop Defense): flop check/check, o BB proba o turn (e às vezes faz barrel no river). */
      table: "bb-probe";
      node: BbProbeNode;
    };

/**
 * turn-alto: flop T-high ou mais; turn-baixo / river-baixo: flop 9-high ou menos (probe + barrel);
 * turn-3s / river-3s: flop 3S HMM/MMM (hotspot de probe + barrel).
 */
export type BbProbeNode = "turn-alto" | "turn-baixo" | "river-baixo" | "turn-3s" | "river-3s";

/**
 * flop-sim: flop de lead (sequência MLL/LLL); flop-nao: os outros flops (check);
 * turn-lead: turn depois de lead no flop e call; turn: BB check/call no flop e lidera o turn;
 * river: BB check/call no flop e no turn e lidera o river.
 */
export type BbLeadNode = "flop-sim" | "flop-nao" | "turn-lead" | "turn" | "river";

type Size = "bet-25" | "bet-40" | "bet-67" | "bet-1bb" | "bet-10" | "bet-100" | "bet-115" | "check";
export interface FlopRule {
  group: string;
  label: string;
  mode: "range" | "split";
  size: Size;
}

const SIZE_LABEL: Record<Size, string> = {
  "bet-25": "B25",
  "bet-40": "B40",
  "bet-67": "B67",
  "bet-1bb": "Stab 1bb",
  "bet-10": "B10",
  "bet-100": "B100",
  "bet-115": "B115",
  check: "Check",
};

/** Regra do flop para a tabela da estratégia; null = flop fora do drill. */
export function flopRuleFor(spec: CbetSpec, board: readonly Card[]): FlopRule | null {
  if (spec.table === "bb-vs-barrel") {
    if (board.length < 4 || new Set(board.slice(0, 3).map((c) => cardRank(c))).size === 1) return null;
    if (barrelSize(board) !== spec.size) return null;
    return { group: "barrel", label: `Turn ${turnType(board)} · barrel b${spec.size} do ${spec.pos}`, mode: "split", size: "check" };
  }
  if (spec.table === "bw-bb") {
    if (board.length < BW_BB_CARDS[spec.node]) return null;
    const fv = board.slice(0, 3).map((c) => cardRank(c));
    if (new Set(fv).size === 1) return null; // trinca no board fica fora
    return { group: "bwbb", label: BW_BB_GUIDE[spec.node].label, mode: "split", size: "check" };
  }
  if (spec.table === "bb-vs-cbet") {
    const guide = findVsCbetBoard(board);
    return guide ? { group: "vc", label: `Board ${guide.label} (guide vs EP)`, mode: "split", size: "check" } : null;
  }
  if (spec.table === "bb-probe") return bbProbeRule(board, spec.node);
  if (spec.table === "bb-lead") return bbLeadRule(board, spec.node);
  return spec.table === "bw-sb" ? bwFlopRule(board, spec.node) : mesFlopRule(board, spec.band);
}

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
  action: string;
  rule: FlopRule;
  hand: HandRead | null;
}

export function cbetAnswer(spec: CbetSpec, hero: readonly Card[], board: readonly Card[]): CbetAnswer | null {
  const rule = flopRuleFor(spec, board);
  if (!rule) return null;
  if (rule.mode === "range") return { action: rule.size, rule, hand: null };
  if (spec.table === "bb-vs-barrel") {
    const read = barrelAnswer(hero, board, spec.pos);
    return { action: read.action, rule, hand: { category: read.category, bet: false, reason: read.reason } };
  }
  if (spec.table === "bw-bb") {
    const read = bwBbAnswer(hero, board, spec.node);
    return { action: read.action, rule, hand: { category: read.category, bet: false, reason: read.reason } };
  }
  if (spec.table === "bb-vs-cbet") {
    const read = vsCbetAnswer(hero, board);
    if (!read) return null;
    const label = { "vc-call": "Call", "vc-raise": "Raise 3x", "vc-fold": "Fold" }[read.action];
    return { action: read.action, rule, hand: { category: read.category, bet: false, reason: `Guide: ${label}.` } };
  }
  const hand =
    spec.table === "bb-probe"
      ? readProbeHand(hero, board.slice(0, 4))
      : spec.table === "bb-lead"
      ? readPolarHand(hero, board.slice(0, BB_LEAD_CARDS[spec.node]), spec.node === "river" ? "river" : "turn")
      : spec.table === "bw-sb"
        ? readBwHand(hero, board)
        : readHand(hero, board);
  return { action: hand.bet ? rule.size : "check", rule, hand };
}

export function ruleSummary(rule: FlopRule): string {
  const size = SIZE_LABEL[rule.size];
  if (rule.group === "vc") return "Call · Raise 3x · Fold";
  if (rule.group === "barrel") return "Bottom de call e de draws (aula 24)";
  if (rule.group === "bwbb") return "Linhas Baga (heat map BW)";
  if (rule.size === "check") return "Check range";
  if (rule.size === "bet-1bb") return rule.mode === "range" ? "Stab range 1bb" : "Split X_Stab 1bb";
  return rule.mode === "range" ? `Range bet ${size}` : `Split X_${size}`;
}

// ---------------------------------------------------------------------------
// BW SB pós (aula 17 "bw-sb-pós"): SB vs BB, 30bb, o SB age primeiro no flop.

/** Algum par de cartas do board a no máximo 2 de distância (ex.: 97, 65, 43). */
function connected(bv: number[]): boolean {
  const values = [...new Set(bv)].sort((a, b) => a - b);
  for (let i = 1; i < values.length; i++) if (values[i] - values[i - 1] <= 2) return true;
  return false;
}

/**
 * Guide simplificado da aula.
 * RC (raise/call): Axx, pareado e monotone são range B25; HMLr, HLL e MLLr desconectados são split misto B25;
 * o resto (HHx, HMM, MMx, LLL, HML/MLL com flush draw, MLL conectado e qualquer board com sequência) é split polar B67.
 * LX (limp/check, stab de 1bb pelo MDA contra o field): board pareado, Ás ou figura desconectada é stab range;
 * monotone, conectado, sequência possível, HLL e board sem figura são split.
 */
export function bwFlopRule(flop: readonly Card[], node: BwNode): FlopRule | null {
  const board = flop.slice(0, 3);
  const texture = flopTexture(board);
  if (texture.paired === "trinca") return null;
  const bv = board.map((c) => value(cardRank(c)));
  const sigla = texture.pattern.replaceAll("-", "");
  const classes = texture.pattern.split("-");
  const count = (c: string) => classes.filter((x) => x === c).length;
  const straight = nutStraightTop(bv) > 0;
  const conn = connected(bv);
  const fd = texture.suits === "twotone";
  const suitTag = texture.suits === "monotone" ? "mono" : fd ? "fd" : "r";

  if (node === "lx") {
    const stab = (group: string, label: string, mode: "range" | "split"): FlopRule => ({ group, label, mode, size: "bet-1bb" });
    if (texture.paired === "pareado") return stab("lx-pareado", `Pareado (dobra ${texture.pairedClass})`, "range");
    if (texture.suits === "monotone") return stab("lx-mono", `Monotone (${sigla})`, "split");
    if (straight) return stab("lx-str8", `Sequência possível (${sigla}${suitTag})`, "split");
    if (count("A") > 0) return stab("lx-a", `Ás no board (${sigla}${suitTag})`, "range");
    if (count("H") + count("A") === 0) return stab("lx-baixo", `Sem figura (${sigla}${suitTag})`, "split");
    if (conn) return stab("lx-conectado", `Conectado (${sigla}${suitTag})`, "split");
    if (sigla === "HLL") return stab("lx-hll", `HLL${suitTag}`, "split");
    return stab("lx-figura", `Figura desconectada (${sigla}${suitTag})`, "range");
  }

  const r25 = (group: string, label: string): FlopRule => ({ group, label, mode: "range", size: "bet-25" });
  const misto = (label: string): FlopRule => ({ group: "rc-misto", label: `${label} · split misto`, mode: "split", size: "bet-25" });
  const polar = (label: string): FlopRule => ({ group: "rc-polar", label: `${label} · split polar`, mode: "split", size: "bet-67" });
  if (texture.paired === "pareado") return r25("rc-pareado", `Pareado (dobra ${texture.pairedClass})`);
  if (texture.suits === "monotone") return r25("rc-mono", `Monotone (${sigla})`);
  if (straight) return polar(`Sequência possível (${sigla}${suitTag})`);
  if (count("A") > 0) return r25("rc-a", `Ás no board (${sigla}${suitTag})`);
  if (sigla === "HLL") return misto(`HLL${suitTag}`);
  if ((sigla === "HML" || sigla === "MLL") && !fd && !conn) return misto(`${sigla}r desconectado`);
  return polar(`${sigla}${suitTag}${conn && !fd ? " conectado" : ""}`);
}

/** Tem backdoor de flush (3 do naipe com pelo menos uma carta do herói), sem já ter flush draw. */
function backdoorSuit(hero: readonly Card[], board: readonly Card[]): boolean {
  const all = [...hero, ...board].map(cardSuit);
  return hero.some((c) => all.filter((s) => s === cardSuit(c)).length === 3);
}

/**
 * Split da aula 17 (vale para RC e LX):
 *  aposta — overpair (escada invertida: AA protege o check), top pair kicker T+, metade dos draws
 *  (flush draw sem par; straight draw com naipe e sem par), 2º/3º par só com kicker A/K fora de HH/sequência,
 *  par baixo com naipe e trash com naipe na carta alta;
 *  check — dois pares ou melhor (100%), o resto.
 */
export function readBwHand(hero: readonly Card[], flop: readonly Card[]): HandRead {
  const board = flop.slice(0, 3);
  const hv = hero.map((c) => value(cardRank(c))).sort((a, b) => b - a);
  const bv = board.map((c) => value(cardRank(c)));
  const top = Math.max(...bv);
  const low = Math.min(...bv);
  const count = (v: number) => bv.filter((x) => x === v).length;
  const pocket = hv[0] === hv[1];
  const pairRank = bv.find((v) => count(v) === 2);
  const highBoard = bv.filter((v) => v >= 10).length >= 2;
  const straightBoard = nutStraightTop(bv) > 0;
  const suits = [...hero, ...board].map(cardSuit);
  const flushDraw = hero.some((c) => suits.filter((s) => s === cardSuit(c)).length === 4);
  const flush = hero.some((c) => suits.filter((s) => s === cardSuit(c)).length >= 5);
  const straight = straightTop([...hv, ...bv]) > 0;
  const draws = straightOuts([...hv, ...bv]);
  const boardOnly = straightOuts(bv);
  const straightDraw = draws.outs.length >= 1 && boardOnly.outs.length < draws.outs.length;
  const backdoor = backdoorSuit(hero, board);
  const pairedCards = hv.filter((v) => count(v) >= 1);

  // 2P+ : check 100% (protege a linha de check)
  if (straight) return hand("Sequência", false, "Dois pares ou melhor: check 100% (protege o check).");
  if (flush) return hand("Flush", false, "Dois pares ou melhor: check 100% (protege o check).");
  if (pocket && count(hv[0]) >= 1) return hand("Set", false, "Dois pares ou melhor: check 100% (protege o check).");
  if (!pocket && pairRank !== undefined && hv.includes(pairRank))
    return hand("Trinca", false, "Dois pares ou melhor: check 100% (protege o check).");
  if (!pocket && pairedCards.length === 2)
    return hand("Dois pares", false, "Dois pares ou melhor: check 100% (protege o check).");

  const hasPair = pocket || pairedCards.length > 0;
  // Overpair: 75% bet, escada invertida (o AA é o mais protegido e dá check)
  if (pocket && hv[0] > top)
    return hv[0] === 14
      ? hand("Overpair AA", false, "Escada invertida: o overpair mais protegido (AA) dá check.")
      : hand("Overpair", true, "Escada invertida: os overpairs abaixo de AA apostam.");
  // Top pair: 75% bet, escada de kicker
  const single = pairedCards.find((v) => v !== pairRank);
  if (!pocket && single !== undefined && single === top) {
    const kicker = hv[0] === single ? hv[1] : hv[0];
    return kicker >= 10
      ? hand("Top pair, kicker bom", true, "Escada de kicker: top pair com kicker T+ aposta.")
      : hand("Top pair, kicker baixo", false, "Escada de kicker: kicker baixo dá check.");
  }
  // Draws: metade aposta
  if (flushDraw)
    return hasPair
      ? hand("Flush draw com par", false, "Draw com valor de showdown dá check.")
      : hand("Flush draw", true, "Flush draw sem valor de showdown aposta.");
  if (straightDraw && !hasPair)
    return backdoor
      ? hand(draws.outs.length >= 2 ? "OESD com naipe" : "Gutshot com naipe", true, "Straight draw com naipe e sem showdown aposta.")
      : hand(draws.outs.length >= 2 ? "OESD sem naipe" : "Gutshot sem naipe", false, "Straight draw sem naipe dá check.");
  // Pares médios e baixos: 25% bet
  if (hasPair) {
    if (pocket && hv[0] < low)
      return backdoor
        ? hand("Par baixo com naipe", true, "Par baixo aposta só com naipe.")
        : hand("Par baixo sem naipe", false, "Par baixo sem naipe dá check.");
    const kicker = pocket ? 0 : hv[0] === single || hv[0] === pairRank ? hv[1] : hv[0];
    const label = pocket || (single !== undefined && [...new Set(bv)].filter((v) => v > single).length === 1) ? "Segundo par" : "Terceiro par";
    if (highBoard || straightBoard) return hand(label, false, "Segundo/terceiro par: 0% de bet em board HH ou com sequência.");
    return kicker >= 13
      ? hand(`${label}, top kicker`, true, "Segundo/terceiro par aposta só com top kicker (A/K).")
      : hand(label, false, "Segundo/terceiro par sem top kicker dá check.");
  }
  // Trash: 25% bet, com naipe na carta alta
  const highCard = hero.find((c) => value(cardRank(c)) === hv[0])!;
  const boardSuits = board.map(cardSuit);
  const twoTone = new Set(boardSuits).size === 2;
  const goodSuit = twoTone
    ? boardSuits.filter((s) => s === cardSuit(highCard)).length === 2
    : hero.every((c) => boardSuits.includes(cardSuit(c)));
  return goodSuit
    ? hand("Trash com naipe", true, twoTone ? "Trash aposta com o naipe do board na carta alta." : "Trash aposta com os dois naipes do board (não bloqueia os folds).")
    : hand("Trash sem naipe", false, "Trash sem naipe bom dá check.");
}

// ---------------------------------------------------------------------------
// BB Leads (Posflop Defense): guidelines do time para o donk bet do BB.

const BB_LEAD_CARDS: Record<BbLeadNode, number> = { "flop-sim": 3, "flop-nao": 3, "turn-lead": 4, turn: 4, river: 5 };

/** Classe usada nas guidelines de lead: L = 2–6, M = 7–9 (765 é MLL, 654 é LLL). */
const leadClass = (v: number) => (v === 14 ? "A" : v >= 10 ? "H" : v >= 7 ? "M" : "L");

/** Flop de lead: sequência possível em board MLL ou LLL (L = 2–6, M = 7–9), sem dobra. */
export function isLeadFlop(flop: readonly Card[]): boolean {
  const bv = flop.slice(0, 3).map((c) => value(cardRank(c)));
  if (new Set(bv).size < 3) return false;
  const classes = bv.map(leadClass);
  const m = classes.filter((c) => c === "M").length;
  const l = classes.filter((c) => c === "L").length;
  return l + m === 3 && m <= 1 && nutStraightTop(bv) > 0;
}

/** Janela de 5 valores (A conta como 1 e 14) com pelo menos `n` cartas distintas do board. */
function windowWith(bv: readonly number[], n: number, test: (low: number, high: number) => boolean = () => true): boolean {
  const ranks = new Set(bv.flatMap((v) => (v === 14 ? [14, 1] : [v])));
  for (let low = 1; low <= 10; low++) {
    let count = 0;
    for (let v = low; v < low + 5; v++) if (ranks.has(v)) count++;
    if (count >= n && test(low, low + 4)) return true;
  }
  return false;
}

const rangeRule = (group: string, label: string, size: Size): FlopRule => ({ group, label, mode: "range", size });
const polarRule = (group: string, label: string, size: Size): FlopRule => ({ group, label, mode: "split", size });

export function bbLeadRule(board: readonly Card[], node: BbLeadNode): FlopRule | null {
  const flop = board.slice(0, 3);
  const fv = flop.map((c) => value(cardRank(c)));
  const sigla = (vs: number[]) =>
    [...vs]
      .sort((a, b) => b - a)
      .map(leadClass)
      .join("");

  if (node === "flop-sim")
    return isLeadFlop(flop) ? rangeRule("lead-flop", `Board straight ${sigla(fv)}`, "bet-25") : null;
  if (node === "flop-nao") {
    if (isLeadFlop(flop) || new Set(fv).size === 1) return null;
    return rangeRule("check-flop", `Fora dos boards de lead (${sigla(fv)})`, "check");
  }

  if (board.length < 4) return null;
  const turn = board[3];
  const tv = value(cardRank(turn));

  if (node === "turn-lead") {
    if (!isLeadFlop(flop)) return null;
    const low = Math.min(...fv);
    if (fv.includes(tv)) return rangeRule("tl-dobra", "Turn dobra o board", "bet-67");
    if (tv === 13 || tv === 14) return polarRule("tl-ka", "Turn K ou A", "bet-115");
    const four = windowWith([...fv, tv], 4);
    if (four && tv < low) return rangeRule("tl-4-baixo", "Turn: 4ª pra sequência por baixo", "bet-67");
    if (four) return rangeRule("tl-4-cima", "Turn: 4ª pra sequência por cima", "bet-25");
    return rangeRule("tl-outros", tv >= 9 ? "Turn do 9 ao Q" : "Turn baixo sem 4ª pra sequência", "bet-25");
  }

  const tSuits = board.slice(0, 4).map(cardSuit);
  if (node === "turn") {
    if (new Set(fv).size < 3) return null; // flop pareado fica fora
    if (tSuits.filter((x) => x === cardSuit(turn)).length === 3) return rangeRule("t-3f", "Turn: 3º naipe (3F)", "check");
    if (fv.includes(tv) && tv <= 9) return rangeRule("t-dobra", "Turn dobra carta média/baixa", "bet-67");
    const tvs = [...fv, tv];
    if (!windowWith(fv, 3) && windowWith(tvs, 3, (_, high) => high <= 8))
      return rangeRule("t-3s", "Turn: 3 pra sequência, 8-high ou menor (3S)", "bet-25");
    return rangeRule("t-check", "Turn sem lead", "check");
  }

  // river
  if (board.length < 5 || new Set(fv).size < 3) return null;
  const river = board[4];
  const rv = value(cardRank(river));
  const turnBoard = [...fv, tv];
  const distinct = [...new Set(turnBoard)].sort((a, b) => b - a);
  if (distinct.includes(rv))
    return rv === distinct[1]
      ? polarRule("r-dobra-2p", "River dobra o 2º par", "bet-100")
      : polarRule("r-dobra", "River dobra o board", "bet-10");
  const rSuits = board.map(cardSuit);
  if (rSuits.filter((x) => x === cardSuit(river)).length === 3)
    return polarRule("r-flush", "River completa o flush", "bet-10");
  // Sequência de duas pontas: alguém com 2 cartas tinha OESD (4 seguidas, 2 delas no board) e o river é uma ponta
  const tRanks = new Set(turnBoard.flatMap((v) => (v === 14 ? [14, 1] : [v])));
  const rvs = rv === 14 ? [14, 1] : [rv];
  for (let a = 2; a <= 10; a++) {
    const inBoard = [0, 1, 2, 3].filter((d) => tRanks.has(a + d)).length;
    if (inBoard === 2 && rvs.some((r) => r === a - 1 || r === a + 4))
      return polarRule("r-str8", "River completa sequência (duas pontas)", "bet-10");
  }
  return rangeRule("r-check", "River sem lead", "check");
}

/**
 * Lead polar mão a mão: dois pares ou melhor e ar (sem par) apostam; um par dá check.
 * No turn polar (K/A depois do lead/call) apostam 2P+ e draws (flush draw ou OESD).
 */
function readPolarHand(hero: readonly Card[], board: readonly Card[], street: "turn" | "river"): HandRead {
  const hv = hero.map((c) => value(cardRank(c))).sort((a, b) => b - a);
  const bv = board.map((c) => value(cardRank(c)));
  const count = (v: number) => bv.filter((x) => x === v).length;
  const pocket = hv[0] === hv[1];
  const suits = [...hero, ...board].map(cardSuit);
  const flush = hero.some((c) => suits.filter((x) => x === cardSuit(c)).length >= 5);
  const straight = straightTop([...hv, ...bv]) > 0;
  const boardPairs = [...new Set(bv)].filter((v) => count(v) >= 2);
  const heroPaired = hv.filter((v) => count(v) >= 1);
  const strong =
    straight ||
    flush ||
    (pocket && count(hv[0]) >= 1) ||
    heroPaired.some((v) => boardPairs.includes(v)) ||
    (!pocket && heroPaired.length === 2);
  if (strong) return hand("Dois pares ou melhor", true, "Polar: valor forte aposta.");
  const onePair = pocket || heroPaired.length > 0;
  if (street === "turn") {
    const flushDraw = hero.some((c) => suits.filter((x) => x === cardSuit(c)).length === 4);
    const draws = straightOuts([...hv, ...bv]);
    const oesd = draws.outs.length >= 2 && straightOuts(bv).outs.length < draws.outs.length;
    if (flushDraw || oesd) return hand(flushDraw ? "Flush draw" : "OESD", true, "Polar: draws apostam.");
    return onePair
      ? hand("Um par", false, "Polar: mãos médias dão check.")
      : hand("Sem par e sem draw", false, "No turn polar só 2P+ e draws apostam.");
  }
  return onePair
    ? hand("Um par", false, "Polar: mãos médias (um par) dão check.")
    : hand("Ar", true, "Polar: blefe com as mãos sem showdown.");
}

// ---------------------------------------------------------------------------
// BB Probes (Posflop Defense): guideline do time, flop check/check e o BB age primeiro no turn.

/**
 * Flop 3S HMM ou MMM (JT7, T86, 987…): três cartas conectadas na faixa média, do J ao 6.
 * Hotspot de probe + barrel.
 */
export function isProbeBarrelFlop(flop: readonly Card[]): boolean {
  const bv = flop.slice(0, 3).map((c) => value(cardRank(c)));
  return new Set(bv).size === 3 && Math.max(...bv) <= 11 && Math.min(...bv) >= 6 && windowWith(bv, 3);
}

/** Hotspot do turn: 3º naipe (3F) ou 4ª pra sequência no board (4S). */
function probeHotspot(board: readonly Card[]): "3F" | "4S" | null {
  const turn = board[3];
  if (board.slice(0, 4).filter((c) => cardSuit(c) === cardSuit(turn)).length === 3) return "3F";
  const bv = board.slice(0, 4).map((c) => value(cardRank(c)));
  if (!windowWith(bv.slice(0, 3), 4) && windowWith(bv, 4)) return "4S";
  return null;
}

export function bbProbeRule(board: readonly Card[], node: BbProbeNode): FlopRule | null {
  if (board.length < 4) return null;
  const flop = board.slice(0, 3);
  const fv = flop.map((c) => value(cardRank(c)));
  if (new Set(fv).size === 1 || isLeadFlop(flop)) return null; // trinca no board fica fora; flop de lead a gente lidera
  const top = Math.max(...fv);
  const tv = value(cardRank(board[3]));
  const sigla = flopTexture(flop).pattern.replaceAll("-", "");
  const barrelFlop = isProbeBarrelFlop(flop);
  const hotspot = probeHotspot(board);

  if (node === "turn-3s" || node === "river-3s") {
    if (!barrelFlop) return null;
    if (node === "turn-3s") return rangeRule("p-3s", `Flop 3S ${sigla}: hotspot de probe + barrel`, "bet-67");
    return board.length < 5 ? null : rangeRule("p-3s-river", `Flop 3S ${sigla}: barrel em qualquer river`, "bet-67");
  }
  if (barrelFlop) return null;

  if (node === "turn-alto") {
    if (top < 10) return null;
    if (hotspot) return rangeRule(`p-${hotspot}`, `Turn ${hotspot}: hotspot, probe range`, "bet-67");
    if (tv > top) return rangeRule("p-alto-over", `Flop ${sigla}, turn A/H acima do board: check range`, "check");
    return polarRule("p-alto-blank", `Flop ${sigla} (T-high+), turn blank: probe polar`, "bet-115");
  }

  // flop 9-high ou menos
  if (top >= 10) return null;
  if (node === "turn-baixo") {
    if (hotspot) return rangeRule(`p-${hotspot}`, `Turn ${hotspot}: hotspot, probe range`, "bet-67");
    if (tv >= 10) return rangeRule("p-baixo-ah", `Flop ${sigla} (9-high-), turn A/H: check range`, "check");
    return rangeRule("p-baixo-blank", `Flop ${sigla} (9-high-), turn blank: probe range`, "bet-25");
  }
  // river-baixo: só depois do probe B25 no turn blank
  if (board.length < 5 || hotspot || tv >= 10) return null;
  const rv = value(cardRank(board[4]));
  return rv >= 10
    ? rangeRule("p-river-ah", "River A/H: check range", "check")
    : rangeRule("p-river-blank", "River blank: barrel B25 range", "bet-25");
}

/** Probe polar (flop T-high+, turn blank): valor TP+ e draws OESD+ (OESD e flush draw); o resto dá check. */
function readProbeHand(hero: readonly Card[], board: readonly Card[]): HandRead {
  const hv = hero.map((c) => value(cardRank(c))).sort((a, b) => b - a);
  const bv = board.map((c) => value(cardRank(c)));
  const top = Math.max(...bv);
  const count = (v: number) => bv.filter((x) => x === v).length;
  const pocket = hv[0] === hv[1];
  const suits = [...hero, ...board].map(cardSuit);
  const flush = hero.some((c) => suits.filter((x) => x === cardSuit(c)).length >= 5);
  const straight = straightTop([...hv, ...bv]) > 0;
  const paired = hv.filter((v) => count(v) >= 1);
  if (straight || flush || (pocket && count(hv[0]) >= 1) || (!pocket && paired.length === 2) || paired.some((v) => count(v) >= 2))
    return hand("Dois pares ou melhor", true, "Probe polar: valor aposta.");
  if (pocket && hv[0] > top) return hand("Overpair", true, "Probe polar: TP+ aposta por valor.");
  if (paired.includes(top)) return hand("Top pair", true, "Probe polar: TP+ aposta por valor (todos os top pairs).");
  const flushDraw = hero.some((c) => suits.filter((x) => x === cardSuit(c)).length === 4);
  const draws = straightOuts([...hv, ...bv]);
  const oesd = draws.outs.length >= 2 && straightOuts(bv).outs.length < draws.outs.length;
  if (flushDraw || oesd) return hand(flushDraw && oesd ? "Combo draw" : flushDraw ? "Flush draw" : "OESD", true, "Probe polar: draws OESD+ apostam.");
  return pocket || paired.length > 0
    ? hand("Par abaixo do top pair", false, "Probe polar: mãos médias dão check.")
    : hand("Sem par e sem draw forte", false, "Probe polar: sem TP+ ou OESD+, check.");
}
