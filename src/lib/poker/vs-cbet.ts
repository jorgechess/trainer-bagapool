/**
 * BB vs Cbet flop (Posflop Defense): guide do time "Guide BB vs cbet flop", aba vs EP (usada vs UTG1 30bb; vs LP terá estratégia própria).
 * Para cada board de exemplo da planilha, a mão do BB cai em X/C, X/R (size 3x) ou X/F contra o cbet de size baixo.
 * Os naipes do board são sorteados mantendo a estrutura (rainbow, two-tone, monotone), então as regras falam de
 * "naipe do board" e não de um naipe fixo.
 */
import { type Card, type Rank, cardRank, cardSuit, rankValue } from "./cards";

export type VsCbetAction = "vc-call" | "vc-raise" | "vc-fold";

const v = (r: Rank) => rankValue(r);
const RANK_CHARS = "23456789TJQKA";
const rankChar = (val: number) => RANK_CHARS[val - 2];

/** Leitura da mão do herói no flop, com o vocabulário da planilha. */
export interface VsCbetFeatures {
  hi: number;
  lo: number;
  /** "KQ", "J7"… (maior primeiro) */
  combo: string;
  suited: boolean;
  pocket: boolean;
  /** Valores distintos do board, do maior pro menor. */
  board: number[];
  pairedBoard: number | null;
  /** Dois pares ou melhor (inclui set, trinca, sequência, flush, full). */
  strong: boolean;
  set: boolean;
  trips: boolean;
  fullHouse: boolean;
  straight: boolean;
  flush: boolean;
  /** Carta do board que o herói pareou (uma carta só). */
  pairedWith: number | null;
  kicker: number | null;
  /** Pocket pair que não fez set: acima, entre ou abaixo das cartas do board. */
  pocketSpot: "over" | "between" | "under" | null;
  flushDraw: boolean;
  /** Cartas do herói no naipe do flush draw (ou do flush). */
  suitCards: number[];
  oesd: boolean;
  gutshot: boolean;
  /** Backdoor de flush com o herói. */
  bdFlush: boolean;
  /** Backdoor de flush nuts: a carta do herói no naipe do backdoor é a maior que falta nele (o A, ou o K com o A no board). */
  bdNuts: boolean;
  bdStraight: boolean;
  /** Tem carta no naipe que aparece 2+ vezes no board (o "naipe" da planilha). */
  hasBoardSuit: boolean;
}

const isStraightSet = (set: Set<number>) => {
  for (let low = 1; low <= 10; low++) if ([0, 1, 2, 3, 4].every((d) => set.has(low + d))) return true;
  return false;
};
const withAce = (vals: number[]) => new Set(vals.flatMap((x) => (x === 14 ? [14, 1] : [x])));

function straightOutsCount(vals: number[]): number {
  const has = withAce(vals);
  if (isStraightSet(has)) return -1;
  let outs = 0;
  for (let r = 2; r <= 14; r++) {
    if (has.has(r)) continue;
    const next = new Set(has);
    next.add(r);
    if (r === 14) next.add(1);
    if (isStraightSet(next)) outs++;
  }
  return outs;
}

export function vsCbetFeatures(hero: readonly Card[], flop: readonly Card[]): VsCbetFeatures {
  const board = flop.slice(0, 3);
  const hv = hero.map((c) => v(cardRank(c))).sort((a, b) => b - a);
  const bvAll = board.map((c) => v(cardRank(c)));
  const bv = [...new Set(bvAll)].sort((a, b) => b - a);
  const count = (x: number) => bvAll.filter((y) => y === x).length;
  const pairedBoard = bv.find((x) => count(x) >= 2) ?? null;
  const pocket = hv[0] === hv[1];
  const suits = [...hero, ...board].map(cardSuit);
  const suitCount = (s: string) => suits.filter((x) => x === s).length;
  const flush = hero.some((c) => suitCount(cardSuit(c)) >= 5);
  const flushDraw = !flush && hero.some((c) => suitCount(cardSuit(c)) === 4);
  const boardSuitCounts = new Map<string, number>();
  for (const c of board) boardSuitCounts.set(cardSuit(c), (boardSuitCounts.get(cardSuit(c)) ?? 0) + 1);
  const mainSuit = [...boardSuitCounts.entries()].find(([, n]) => n >= 2)?.[0] ?? null;
  const suitCards = hero.filter((c) => suitCount(cardSuit(c)) >= 4).map((c) => v(cardRank(c)));
  const all = [...hv, ...bvAll];
  const straight = isStraightSet(withAce(all));
  const set = pocket && count(hv[0]) === 1;
  const trips = !pocket && pairedBoard !== null && hv.includes(pairedBoard);
  const paired = hv.filter((x) => count(x) >= 1);
  const twoPair = !pocket && paired.length === 2 && paired[0] !== paired[1];
  const quads = pocket && count(hv[0]) === 2;
  const fullHouse =
    quads ||
    (pocket && pairedBoard !== null && count(hv[0]) === 1) ||
    (trips && paired.length === 2) ||
    (pocket && pairedBoard !== null && hv[0] === pairedBoard);
  const strong = straight || flush || set || trips || twoPair || fullHouse;
  const pairedWith = !pocket && paired.length === 1 && !trips ? paired[0] : null;
  const kicker = pairedWith === null ? null : hv[0] === pairedWith ? hv[1] : hv[0];
  const pocketSpot = pocket && !set && !quads ? (hv[0] > bv[0] ? "over" : hv[0] < bv[bv.length - 1] ? "under" : "between") : null;
  const outs = straightOutsCount(all);
  const boardOuts = straightOutsCount(bvAll);
  const heroHelps = outs > Math.max(boardOuts, 0);
  const oesd = !straight && heroHelps && outs >= 2;
  const gutshot = !straight && heroHelps && outs === 1;
  const bdFlush = !flush && !flushDraw && hero.some((c) => suitCount(cardSuit(c)) === 3);
  const bdNuts = hero.some((c) => {
    const suit = cardSuit(c);
    if (suitCount(suit) !== 3 || flush || flushDraw) return false;
    const seen = new Set([...hero, ...board].filter((x) => cardSuit(x) === suit).map((x) => v(cardRank(x))));
    let top = 14;
    while (top > 2 && seen.has(top) && top !== v(cardRank(c))) top--;
    return v(cardRank(c)) === top;
  });
  let bdStraight = false;
  const rs = withAce(all);
  const heroRs = withAce(hv);
  for (let low = 1; low <= 10 && !bdStraight; low++) {
    const inWin = [0, 1, 2, 3, 4].filter((d) => rs.has(low + d)).length;
    const heroIn = [0, 1, 2, 3, 4].some((d) => heroRs.has(low + d));
    if (inWin >= 3 && heroIn) bdStraight = true;
  }
  return {
    hi: hv[0],
    lo: hv[1],
    combo: `${rankChar(hv[0])}${rankChar(hv[1])}`,
    suited: cardSuit(hero[0]) === cardSuit(hero[1]),
    pocket,
    board: bv,
    pairedBoard,
    strong,
    set,
    trips,
    fullHouse,
    straight,
    flush,
    pairedWith,
    kicker,
    pocketSpot,
    flushDraw,
    suitCards,
    oesd,
    gutshot,
    bdFlush,
    bdNuts,
    bdStraight,
    hasBoardSuit: mainSuit !== null && hero.some((c) => cardSuit(c) === mainSuit),
  };
}

type Rule = [string, (f: VsCbetFeatures) => boolean, VsCbetAction];

export interface VsCbetBoard {
  /** Board da planilha (naipes de exemplo). */
  cards: [Card, Card, Card];
  /** Sigla da planilha (AHM, ST HMM, DB HLL, MN MLL…). */
  label: string;
  rules: Rule[];
}

const R = "vc-raise" as const;
const C = "vc-call" as const;
const is = (...combos: string[]) => (f: VsCbetFeatures) => combos.includes(f.combo);
const anyPair = (f: VsCbetFeatures) => f.pairedWith !== null || f.pocket;
const pairOf = (rank: number) => (f: VsCbetFeatures) => f.pairedWith === rank;
const draw = (f: VsCbetFeatures) => f.flushDraw || f.oesd || f.gutshot;
const dbd = (f: VsCbetFeatures) => f.bdFlush && f.bdStraight;
const both = (min: number, max: number) => (f: VsCbetFeatures) => f.hi <= max && f.lo >= min && !f.pocket;
const broadways = (f: VsCbetFeatures) => f.lo >= 10 && !f.pocket;
const strong: Rule = ["Dois pares ou melhor", (f) => f.strong, R];

/** Os 28 boards da aba "vs EP" (o ST MMM foi para os spots de lead), com as regras de cada um em ordem (a primeira que bate decide; o resto é X/F). */
export const VS_CBET_BOARDS: VsCbetBoard[] = [
  {
    cards: ["As", "Th", "8s"],
    label: "AHM",
    rules: [
      strong,
      ["TPGK (A9+)", (f) => f.pairedWith === 14 && f.kicker! >= 9, R],
      ["Flush draw com 3x ou 2x", (f) => f.flushDraw && f.lo <= 3, R],
      ["Flush draw", (f) => f.flushDraw, C],
      ["Bottom pair pior (kicker 4- ou bloqueando 89/J8)", (f) => f.pairedWith === 8 && (f.kicker! <= 4 || [9, 11].includes(f.kicker!)), R],
      ["Par do board", (f) => f.pairedWith !== null, C],
      ["2 pontas", (f) => f.oesd, C],
      ["Melhores brocas (KQ, KJ, QJ, J7)", (f) => f.gutshot && is("KQ", "KJ", "QJ", "J7")(f), C],
      ["Piores brocas", (f) => f.gutshot, R],
    ],
  },
  {
    cards: ["As", "Qd", "5h"],
    label: "AHL",
    rules: [
      strong,
      ["TPGK (A9+)", (f) => f.pairedWith === 14 && f.kicker! >= 9, R],
      ["Duas cartas do 5 pra baixo (inclui bottom pair)", (f) => f.hi <= 5 && !f.pocket, R],
      ["Bottom pair kicker alto com duplo BD", (f) => f.pairedWith === 5 && f.kicker! >= 10 && dbd(f), R],
      ["Par do board", (f) => f.pairedWith !== null, C],
      ["Melhor broca (KJ)", (f) => f.gutshot && f.combo === "KJ", C],
      ["Piores brocas (KT ou pior)", (f) => f.gutshot, R],
    ],
  },
  {
    cards: ["As", "8d", "7h"],
    label: "AMM",
    rules: [
      strong,
      ["TPGK (A9+)", (f) => f.pairedWith === 14 && f.kicker! >= 9, R],
      ["Middle/bottom pair wrap-around (J8, T8, 98, 97)", (f) => (f.pairedWith === 8 || f.pairedWith === 7) && [9, 10, 11].includes(f.kicker!), R],
      ["Par do board", (f) => f.pairedWith !== null, C],
      ["2 pontas", (f) => f.oesd, C],
      ["Melhores brocas (JT, J9)", (f) => f.gutshot && is("JT", "J9")(f), C],
      ["Piores brocas (T6, 95, 54)", (f) => f.gutshot, R],
    ],
  },
  {
    cards: ["As", "9h", "3d"],
    label: "AML",
    rules: [
      strong,
      ["Todos os pares (inclusive pockets)", anyPair, R],
      ["Brocas e draws", draw, R],
      ["Duplo BD", dbd, R],
    ],
  },
  {
    cards: ["Ad", "4h", "3d"],
    label: "ALL",
    rules: [
      strong,
      ["TPGK (AJ+)", (f) => f.pairedWith === 14 && f.kicker! >= 11, R],
      ["Pocket vulnerável (66-)", (f) => f.pocket && f.hi <= 6, R],
      ["Pares (inclusive pockets)", anyPair, C],
      ["Flush draw", (f) => f.flushDraw, C],
      ["Brocas sem par (5x e 2x)", (f) => f.gutshot || f.oesd, R],
      ["KJ+ com duplo BD", (f) => dbd(f) && f.hi === 13 && f.lo >= 11, C],
      ["Duplo BD wrap-around 5x ao 7x", (f) => dbd(f) && [5, 6, 7].some((x) => x === f.hi || x === f.lo), R],
      ["Duplo BD broadway sem K (JTo, QJo)", (f) => dbd(f) && broadways(f) && f.hi !== 13, R],
    ],
  },
  {
    cards: ["Ks", "Qd", "8s"],
    label: "HHM",
    rules: [
      strong,
      ["Combo draw (pra X/R turn)", (f) => f.flushDraw && (f.oesd || f.gutshot), C],
      ["Top pair", pairOf(13), R],
      ["Bottom pair", pairOf(8), R],
      ["Segundo par", pairOf(12), C],
      ["Flush draw", (f) => f.flushDraw, R],
      ["2 pontas", (f) => f.oesd, C],
      ["Broca suited", (f) => f.gutshot && f.suited, C],
      ["Broca off (inclusive AJ e AT)", (f) => f.gutshot, R],
      ["A-low off com BD nuts", (f) => f.hi === 14 && f.lo <= 7 && !f.suited && f.bdNuts, R],
    ],
  },
  {
    cards: ["Ks", "Td", "3h"],
    label: "HHL",
    rules: [
      strong,
      ["Pares do board", (f) => f.pairedWith !== null, R],
      ["Overpair", (f) => f.pocketSpot === "over", R],
      ["Pockets 55-", (f) => f.pocket && f.hi <= 5, R],
      ["Wrap-around das broadways (2 cartas acima do 9, exceto A9)", (f) => f.lo >= 10, R],
      ["A-low suited com duplo BD", (f) => f.hi === 14 && f.lo <= 5 && f.suited && dbd(f), R],
    ],
  },
  {
    cards: ["Qs", "7s", "6d"],
    label: "HMM",
    rules: [
      strong,
      ["TPGK (A9+)", (f) => f.pairedWith === 12 && f.kicker! >= 9, R],
      ["FD nuts/semi-nuts com low kicker", (f) => f.flushDraw && f.suitCards.some((x) => x >= 13) && f.lo <= 5, R],
      ["Flush draw", (f) => f.flushDraw, C],
      ["Middle/bottom pair wrap-around (86, 65, 64)", (f) => (f.pairedWith === 7 || f.pairedWith === 6) && [8, 5, 4].includes(f.kicker!), R],
      ["Pares (inclusive pockets)", anyPair, C],
      ["2 pontas", (f) => f.oesd, C],
      ["Piores brocas (95, 84, 43)", (f) => f.gutshot && is("95", "84", "43")(f), R],
      ["Melhores brocas", (f) => f.gutshot, C],
      ["AXo/KXo com duplo BD nuts", (f) => !f.suited && f.hi >= 13 && dbd(f) && f.bdNuts, R],
      ["Broadway off com duplo BD", (f) => !f.suited && broadways(f) && dbd(f), C],
    ],
  },
  {
    cards: ["Js", "8d", "6h"],
    label: "HMM",
    rules: [
      strong,
      ["TPGK (J9+)", (f) => f.pairedWith === 11 && f.kicker! >= 9, R],
      ["Wrap-around do top pair (2 pontas)", (f) => f.oesd && !anyPair(f), R],
      ["Brocas de cima", (f) => f.gutshot && !anyPair(f) && f.hi > 8, R],
      ["Pares (inclusive pockets)", anyPair, C],
      ["Wrap-around do 2nd e 3rd pair (76, 54, 98)", draw, C],
      ["Duplo BD com over do 2nd pair (K9s, A7s, Q5s, 93s)", (f) => dbd(f) && f.hi > 8, R],
    ],
  },
  {
    cards: ["Ks", "8h", "5d"],
    label: "HML",
    rules: [
      strong,
      ["TPGK (K9+)", (f) => f.pairedWith === 13 && f.kicker! >= 9, R],
      ["2nd/3rd pair com kicker que interage no meio", (f) => (f.pairedWith === 8 || f.pairedWith === 5) && f.kicker! >= 4 && f.kicker! <= 9, R],
      ["Pares (inclusive pockets)", anyPair, C],
      ["2 pontas", (f) => f.oesd, C],
      ["Wrap-around de baixo (brocas)", (f) => f.gutshot, R],
      ["Duplo BD pra flushes altos", dbd, R],
    ],
  },
  {
    cards: ["Ts", "9h", "4h"],
    label: "HML",
    rules: [
      strong,
      ["TPGK (JT+)", (f) => f.pairedWith === 10 && f.kicker! >= 11, R],
      ["3rd pair wrap-around do T9", (f) => f.pairedWith === 4 && [7, 8].includes(f.kicker!), R],
      ["Pares (inclusive pockets)", anyPair, C],
      ["Equidades diretas (FD, 2 pontas)", (f) => f.flushDraw || f.oesd, C],
      ["Melhor broca", (f) => f.gutshot && f.hi >= 12, R],
      ["Brocas", (f) => f.gutshot, C],
      ["Duplo BD de cima (AQ, AJ)", (f) => dbd(f) && is("AQ", "AJ")(f), R],
      ["Duplo BD off HL (A3o, K5o)", (f) => dbd(f) && !f.suited && f.hi >= 13 && f.lo <= 5, R],
    ],
  },
  {
    cards: ["Js", "5h", "4d"],
    label: "HLL",
    rules: [
      strong,
      ["Todos os pares (inclusive pockets)", anyPair, R],
      ["Wrap-around do 54 (duas cartas do 8 pra baixo)", (f) => f.hi <= 8, R],
      ["Repping TPGK (AQ, KQ)", is("AQ", "KQ"), R],
      ["Draws", draw, R],
      ["Duplos BD mais fortes", (f) => dbd(f) && f.hi >= 12, R],
    ],
  },
  {
    cards: ["8s", "7h", "3d"],
    label: "MML",
    rules: [
      strong,
      ["3rd pair GK (J3+)", (f) => f.pairedWith === 3 && f.kicker! >= 11, C],
      ["Todos os pares (inclusive pockets)", anyPair, R],
      ["Broca / 2 pontas", (f) => f.oesd || f.gutshot, C],
      ["Duplo BD", dbd, R],
      ["Repping AA e A8 (ATo, K9s)", is("AT", "K9"), R],
    ],
  },
  {
    cards: ["7s", "3h", "2d"],
    label: "MLL",
    rules: [
      strong,
      ["3rd pair GK (J3+)", (f) => (f.pairedWith === 3 || f.pairedWith === 2) && f.kicker! >= 11, C],
      ["Todos os pares (inclusive pockets)", anyPair, R],
      ["KQ+, AT+", (f) => is("KQ", "AK", "AQ", "AJ", "AT")(f), C],
      ["Duplo BD que blocka folds (J4s, Q4s)", (f) => dbd(f) && f.suited && f.lo === 4, C],
      ["Duplos BD", dbd, R],
      ["Draws", draw, R],
    ],
  },
  {
    cards: ["As", "Kh", "Jd"],
    label: "ST AHH",
    rules: [
      strong,
      ["Top pair", pairOf(14), R],
      ["Par com broca (JT, KT, QJ)", (f) => f.pairedWith !== null && (f.gutshot || f.oesd), C],
      ["2nd e 3rd pair (Kx, Jx)", (f) => f.pairedWith === 13 || f.pairedWith === 11, C],
    ],
  },
  {
    cards: ["Ks", "Qh", "Td"],
    label: "ST HHH",
    rules: [
      strong,
      ["Par com broca (JT, KT, QJ)", (f) => f.pairedWith !== null && (f.gutshot || f.oesd), C],
      ["Broadways (exceto sequência)", broadways, C],
      ["TP kicker fraco sem BD", (f) => f.pairedWith === 13 && !f.bdFlush, R],
      ["2nd/3rd pair com backdoor", (f) => (f.pairedWith === 12 || f.pairedWith === 10 || f.pairedWith === 13) && f.bdFlush, C],
      ["OESD unblocking airs (8-6)", (f) => f.oesd && f.hi <= 11, R],
      ["Broca A-low suited com BD", (f) => f.hi === 14 && f.lo <= 5 && f.suited && f.bdFlush, R],
    ],
  },
  {
    cards: ["Qs", "Js", "9d"],
    label: "ST HHM",
    rules: [
      strong,
      ["TP com redraw (KQ, QT)", is("KQ", "QT"), R],
      ["2nd pair unblocking airs (J-low suited)", (f) => f.pairedWith === 11 && f.kicker! <= 5 && f.suited, R],
      ["Pares", anyPair, C],
      ["Flush draw", (f) => f.flushDraw, C],
      ["OESD unblocking airs", (f) => f.oesd && f.hi <= 9, R],
      ["2 pontas / wrap-around das broadways", (f) => f.oesd || broadways(f), C],
      ["GS + BD K-low off", (f) => f.hi === 13 && f.lo <= 5 && !f.suited && f.gutshot && f.bdFlush, R],
    ],
  },
  {
    cards: ["Js", "9d", "8h"],
    label: "ST HMM",
    rules: [
      strong,
      ["Duas cartas entre Q e 7", both(7, 12), R],
      ["Pares do board sem redraw", anyPair, C],
      ["OESD/GS com BD e low card suited (Q3s, T2s)", (f) => (f.oesd || f.gutshot) && f.bdFlush && f.suited && f.lo <= 5, R],
      ["Equidades diretas", (f) => f.oesd || f.gutshot, C],
    ],
  },
  // ST MMM (987) saiu: é spot de lead do BB (BB Leads), não de enfrentar cbet
  {
    cards: ["7d", "6s", "4d"],
    label: "ST MML",
    rules: [
      strong,
      ["Duas cartas entre 8 e 3", both(3, 8), R],
      ["KQ/AJ+", is("KQ", "AK", "AQ", "AJ"), C],
      ["3rd pair kicker 9+", (f) => f.pairedWith !== null && f.kicker! >= 9, C],
      ["Broca pra cima", (f) => f.gutshot && f.hi >= 8, C],
      ["Semi broadways / HL com BD", (f) => f.hi >= 10 && f.bdFlush, R],
      ["HL protegido nas overs", (f) => f.hi >= 13, C],
    ],
  },
  {
    cards: ["Kd", "Ks", "Qh"],
    label: "DB HHH",
    rules: [
      strong,
      ["Pockets e pares", anyPair, R],
      ["Equidades diretas", draw, R],
      ["Duplo BD colado (AXs, JXs)", (f) => dbd(f) && f.suited && (f.hi === 14 || f.hi === 11 || f.lo === 11), R],
    ],
  },
  {
    cards: ["Kd", "Ks", "3d"],
    label: "DB HHL",
    rules: [strong, ["Pockets e pares", anyPair, R], ["Equidades diretas", draw, R], ["Duplos BD", dbd, R]],
  },
  {
    cards: ["Qs", "7h", "7d"],
    label: "DB HMM",
    rules: [
      strong,
      ["Pares e pockets", anyPair, R],
      ["Todos os A-high", (f) => f.hi === 14, R],
      ["K-high com 2 overs da dobra", (f) => f.hi === 13 && f.lo > 7, R],
      ["Duplos BD / wrap-around da trinca", (f) => dbd(f) || draw(f), R],
      ["Desbloqueando Jx, Tx, 9x, 8x", (f) => [8, 9, 10, 11].includes(f.hi) || [8, 9, 10, 11].includes(f.lo), R],
    ],
  },
  {
    cards: ["7s", "7h", "4h"],
    label: "DB MML",
    rules: [
      strong,
      ["AT+, KQ", (f) => is("AK", "AQ", "AJ", "AT", "KQ")(f), C],
      ["Bottom pair blockando folds (A4-T4)", (f) => f.pairedWith === 4 && f.kicker! >= 10, C],
      ["Flush draw com 2 H", (f) => f.flushDraw && f.lo >= 10, C],
      ["Flush draw sem 2 H", (f) => f.flushDraw, R],
      ["Pockets", (f) => f.pocket, R],
      ["A9- com 2 overs do par", (f) => f.hi === 14 && f.lo > 7, R],
      ["A3- só com BD", (f) => f.hi === 14 && f.lo <= 3 && f.bdFlush, R],
      ["Wrap-around da sequência (entre 8 e 3)", both(3, 8), R],
      ["Duplos BD", dbd, R],
    ],
  },
  {
    cards: ["Td", "4h", "4d"],
    label: "DB HLL",
    rules: [
      ["Full house", (f) => f.fullHouse, C],
      ["Trinca", (f) => f.trips, R],
      ["Par do board", (f) => f.pairedWith !== null, R],
      ["Pocket acima da trinca", (f) => f.pocket && f.hi > 4, C],
      ["Pocket abaixo da trinca", (f) => f.pocket, R],
      ["Flush draw", (f) => f.flushDraw, R],
      ["AJ+/KQ com backdoor", (f) => is("AK", "AQ", "AJ", "KQ")(f) && f.bdFlush, R],
      ["AJ+/KQ sem backdoor", is("AK", "AQ", "AJ", "KQ"), C],
      ["A9- com BD", (f) => f.hi === 14 && f.bdFlush, R],
      ["Broadways com backdoor", (f) => broadways(f) && f.bdFlush, R],
    ],
  },
  {
    cards: ["5h", "4h", "4d"],
    label: "DB LLL",
    rules: [
      strong,
      ["AT+, KQ", (f) => is("AK", "AQ", "AJ", "AT", "KQ")(f), C],
      ["Bottom pair blockando folds (K5-T5)", (f) => f.pairedWith === 5 && f.kicker! >= 10 && f.kicker! <= 13, C],
      ["Flush draw com 2 H", (f) => f.flushDraw && f.lo >= 10, C],
      ["Flush draw sem 2 H", (f) => f.flushDraw, R],
      ["Pockets", (f) => f.pocket, R],
      ["A9-", (f) => f.hi === 14, R],
      ["Wrap-around da sequência (entre 8 e 2)", both(2, 8), R],
      ["Duplos BD", dbd, R],
      ["Par do board", (f) => f.pairedWith !== null, R],
    ],
  },
  {
    cards: ["As", "Qs", "8s"],
    label: "MN AHM",
    rules: [
      ["Flush com pelo menos 1 L card", (f) => f.flush && Math.min(...f.suitCards) <= 5, R],
      ["Flush alto", (f) => f.flush, C],
      strong,
      ["Top pair que blocka os folds (AT-A7)", (f) => f.pairedWith === 14 && f.kicker! >= 7 && f.kicker! <= 10, C],
      ["Top pair que unblocka os folds (AJ+, A6-)", pairOf(14), R],
      ["2nd/3rd pair com naipe", (f) => f.pairedWith !== null && f.hasBoardSuit, C],
      ["2nd/3rd pair sem naipe", (f) => f.pairedWith !== null, R],
      ["Flush draw off", (f) => f.flushDraw, R],
      ["Pocket com naipe", (f) => f.pocket && f.hasBoardSuit, C],
      ["Broadways", broadways, C],
    ],
  },
  {
    cards: ["Qs", "8s", "3s"],
    label: "MN HML",
    rules: [
      ["Flush com 2 cartas acima do 9", (f) => f.flush && Math.min(...f.suitCards) >= 10, C],
      ["Flush com pelo menos 1 L card", (f) => f.flush, R],
      strong,
      ["Top pair off blockando values (KQ-QT com naipe)", (f) => f.pairedWith === 12 && [13, 11, 10].includes(f.kicker!) && f.hasBoardSuit, R],
      ["Top pairs, 2nd e 3rd pairs", (f) => f.pairedWith !== null, C],
      ["Flush draw off", (f) => f.flushDraw, R],
      ["Pocket com naipe", (f) => f.pocket && f.hasBoardSuit, R],
    ],
  },
  {
    cards: ["7s", "3s", "2s"],
    label: "MN MLL",
    rules: [
      ["Flush com 2 H", (f) => f.flush && Math.min(...f.suitCards) >= 10, C],
      ["Flush sem 2 H", (f) => f.flush, R],
      ["Bottom set", (f) => f.set && f.hi === 2, R],
      ["Todos os pares (inclusive pockets)", (f) => anyPair(f) || f.strong, C],
      ["KXo/AXo com FD", (f) => f.flushDraw && f.suitCards.some((x) => x >= 13), C],
      ["Flush draw de broadway", (f) => f.flushDraw && broadways(f), C],
      ["Flush draw off", (f) => f.flushDraw, R],
      ["Broadway off com naipe", (f) => broadways(f) && f.hasBoardSuit, C],
    ],
  },
];

/** Estrutura dos naipes (qual carta divide naipe com qual), para reconhecer o board depois de trocar os naipes. */
function suitShape(cards: readonly Card[]): string {
  // Agrupa as cartas por naipe: o resultado não depende de qual naipe é qual
  const groups = new Map<string, number[]>();
  for (const c of cards) groups.set(cardSuit(c), [...(groups.get(cardSuit(c)) ?? []), v(cardRank(c))]);
  return [...groups.values()]
    .map((g) => g.sort((a, b) => b - a).map(rankChar).join(""))
    .sort()
    .join("|");
}

const BOARD_INDEX = new Map(VS_CBET_BOARDS.map((b) => [suitShape(b.cards), b]));

/** Board da planilha correspondente ao flop (mesmas cartas, naipes trocados), ou null. */
export function findVsCbetBoard(flop: readonly Card[]): VsCbetBoard | null {
  return BOARD_INDEX.get(suitShape(flop.slice(0, 3))) ?? null;
}

/** Sorteia um board da planilha e troca os naipes (mantendo a estrutura). */
export function randomVsCbetFlop(rng: () => number): Card[] {
  const board = VS_CBET_BOARDS[Math.floor(rng() * VS_CBET_BOARDS.length)];
  const suits = ["s", "h", "d", "c"];
  for (let i = suits.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [suits[i], suits[j]] = [suits[j], suits[i]];
  }
  const map = new Map(["s", "h", "d", "c"].map((s, i) => [s, suits[i]]));
  return board.cards.map((c) => `${cardRank(c)}${map.get(cardSuit(c))}` as Card);
}

export interface VsCbetRead {
  action: VsCbetAction;
  category: string;
  board: VsCbetBoard;
}

export function vsCbetAnswer(hero: readonly Card[], flop: readonly Card[]): VsCbetRead | null {
  const board = findVsCbetBoard(flop);
  if (!board) return null;
  const f = vsCbetFeatures(hero, flop);
  for (const [category, test, action] of board.rules) if (test(f)) return { action, category, board };
  // Regra geral (todos os boards): sem par, só continua com draw direto (flush draw ou sequência de duas pontas).
  // Gutshot sozinho e backdoor sozinho são fold, a não ser que a regra do board fale deles (as regras do guide vêm antes)
  if (f.pairedWith === null && !f.pocket && (f.flushDraw || f.oesd)) {
    return { action: "vc-call", category: f.flushDraw ? "Air com flush draw" : "Air com duas pontas", board };
  }
  const category = f.pocket
    ? "Pocket sem jogo"
    : f.pairedWith !== null
      ? "Par fraco"
      : f.flushDraw || f.oesd || f.gutshot
        ? "Draw fraco"
        : "Air";
  return { action: "vc-fold", category, board };
}
