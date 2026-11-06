/**
 * BW BB pós-flop (aula "postflop do big blind" + Heat Map BW as BB): o BB contra o SB, 30bb, nas três linhas
 * da aula — single raised (SB raise, BB call), limped (SB completa, BB check) e ISO (SB limpa, BB isola, SB paga).
 * Cada nó devolve a ação pela categoria da mão no board da street.
 */
import { type Card, cardRank, cardSuit, rankValue } from "./cards";

export type BwBbNode =
  | "srp-vs-cbet"
  | "srp-x"
  | "srp-2x"
  | "srp-delay"
  | "lp-vs-stab"
  | "lp-x"
  | "iso-flop"
  | "iso-turn"
  | "iso-river";

/** Cartas do board que cada nó enxerga. */
export const BW_BB_CARDS: Record<BwBbNode, number> = {
  "srp-vs-cbet": 3,
  "srp-x": 3,
  "srp-2x": 4,
  "srp-delay": 4,
  "lp-vs-stab": 3,
  "lp-x": 3,
  "iso-flop": 3,
  "iso-turn": 4,
  "iso-river": 5,
};

export type BwBbCategory = "top" | "value" | "mid" | "draw" | "backdoor" | "air";

export const BW_BB_CATEGORY_LABELS: Record<BwBbCategory, string> = {
  top: "Top bucket (dois pares ou melhor)",
  value: "Top pair ou overpair",
  mid: "Par médio/baixo (2º, 3º par, pocket abaixo)",
  draw: "Draw (flush draw, 2 pontas ou broca)",
  backdoor: "Backdoor (flush ou sequência)",
  air: "Air sem backdoor",
};

const isStraight = (set: Set<number>) => {
  for (let low = 1; low <= 10; low++) if ([0, 1, 2, 3, 4].every((d) => set.has(low + d))) return true;
  return false;
};
const withAce = (vals: number[]) => new Set(vals.flatMap((x) => (x === 14 ? [14, 1] : [x])));
function outsCount(vals: number[]): number {
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

/** Categoria da mão do BB no board (3, 4 ou 5 cartas). Backdoor só conta no flop. */
export function bwBbCategory(hero: readonly Card[], board: readonly Card[]): BwBbCategory {
  const hv = hero.map((c) => rankValue(cardRank(c))).sort((a, b) => b - a);
  const bv = board.map((c) => rankValue(cardRank(c)));
  const count = (x: number) => bv.filter((y) => y === x).length;
  const top = Math.max(...bv);
  const pocket = hv[0] === hv[1];
  const suits = [...hero, ...board].map(cardSuit);
  const suitCount = (s: string) => suits.filter((x) => x === s).length;
  const flush = hero.some((c) => suitCount(cardSuit(c)) >= 5);
  const all = [...hv, ...bv];
  const straight = isStraight(withAce(all)) && !isStraight(withAce(bv));
  const paired = hv.filter((x) => count(x) >= 1);
  const trips = paired.some((x) => count(x) >= 2);
  const set = pocket && count(hv[0]) >= 1;
  const twoPair = !pocket && paired.length === 2;
  if (straight || flush || trips || set || twoPair) return "top";
  if ((pocket && hv[0] > top) || paired.includes(top)) return "value";
  if (pocket || paired.length > 0) return "mid";
  const flushDraw = board.length < 5 && hero.some((c) => suitCount(cardSuit(c)) === 4);
  const outs = board.length < 5 ? outsCount(all) : 0;
  const boardOuts = outsCount(bv);
  if (flushDraw || (outs > Math.max(boardOuts, 0) && outs >= 1)) return "draw";
  if (board.length === 3) {
    const bdFlush = hero.some((c) => suitCount(cardSuit(c)) === 3);
    const rs = withAce(all);
    const heroRs = withAce(hv);
    let bdStraight = false;
    for (let low = 1; low <= 10 && !bdStraight; low++) {
      const inWin = [0, 1, 2, 3, 4].filter((d) => rs.has(low + d)).length;
      if (inWin >= 3 && [0, 1, 2, 3, 4].some((d) => heroRs.has(low + d))) bdStraight = true;
    }
    if (bdFlush || bdStraight) return "backdoor";
  }
  return "air";
}

type Answers = Record<BwBbCategory, string>;

/** Ação por categoria em cada nó (o guide oficial da aula). */
export const BW_BB_GUIDE: Record<BwBbNode, { label: string; answers: Answers; why: Partial<Record<BwBbCategory, string>> }> = {
  "srp-vs-cbet": {
    label: "SRP · SB cbet baixo no flop",
    answers: { top: "call", value: "raise-3x", mid: "call", draw: "call", backdoor: "call", air: "fold" },
    why: {
      top: "30bb: slow play dos top buckets (protege o call).",
      value: "Short stack acelera o top pair: raise e atola.",
      mid: "Float: o fold teórico é 16% e o time folda 30%.",
      draw: "Float pra atacar o turn (BVM ou raise no 2º barrel).",
      backdoor: "Não larga backdoor: float pra roubar o turn.",
      air: "Só o air sem backdoor larga.",
    },
  },
  "srp-x": {
    label: "SRP · SB deu check no flop",
    answers: { top: "bet-33", value: "bet-33", mid: "bet-33", draw: "check", backdoor: "check", air: "check" },
    why: {
      top: "BVM de flop é por valor (o field underfolda).",
      value: "BVM de flop é por valor (o field underfolda).",
      mid: "Valor médio também vai no BVM (depois bet check bet).",
      draw: "Bluff não vai no BVM de flop: check behind e ataca o turn.",
      backdoor: "Bluff não vai no BVM de flop: check behind e ataca o turn.",
      air: "Bluff não vai no BVM de flop: check behind e ataca o turn.",
    },
  },
  "srp-2x": {
    label: "SRP · flop check/check, SB check de novo no turn",
    answers: { top: "bet-67", value: "bet-67", mid: "bet-67", draw: "bet-67", backdoor: "bet-67", air: "bet-67" },
    why: {
      top: "Bet vs dois checks: range bet (overfold enorme).",
      value: "Bet vs dois checks: range bet (overfold enorme).",
      mid: "Bet vs dois checks: range bet (overfold enorme).",
      draw: "Bet vs dois checks: range bet (overfold enorme).",
      backdoor: "Bet vs dois checks: range bet (overfold enorme).",
      air: "Bet vs dois checks: range bet (overfold enorme).",
    },
  },
  "srp-delay": {
    label: "SRP · flop check/check, SB delayed cbet ≤50% no turn",
    answers: { top: "raise-3x", value: "call", mid: "call", draw: "raise-3x", backdoor: "fold", air: "fold" },
    why: {
      top: "Raise vs delayed: valor.",
      value: "Top pair paga o delayed.",
      mid: "Par paga o delayed.",
      draw: "Raise vs delayed com os draws que abriram.",
      backdoor: "Sem draw no turn: fold.",
      air: "Sem draw no turn: fold.",
    },
  },
  "lp-vs-stab": {
    label: "Limped · SB stab de 1bb no flop",
    answers: { top: "call", value: "raise-3x", mid: "call", draw: "call", backdoor: "call", air: "fold" },
    why: {
      top: "Top buckets não aceleram (espelhamento): call.",
      value: "Valores aceleram (principalmente vs fish): raise.",
      mid: "Float: foldar menos de 20% vs stab.",
      draw: "Float pra BVM turn ou raise no 2º stab.",
      backdoor: "Float: duplo backdoor nunca larga.",
      air: "Só o air sem backdoor larga.",
    },
  },
  "lp-x": {
    label: "Limped · SB deu check no flop",
    answers: { top: "check", value: "bet-1bb", mid: "bet-1bb", draw: "bet-1bb", backdoor: "bet-1bb", air: "bet-1bb" },
    why: {
      top: "Exceção dos top buckets: check pra proteger o check.",
      value: "BVM de flop (impressora): bet 1bb.",
      mid: "BVM de flop (impressora): bet 1bb.",
      draw: "BVM de flop e funil no turn/river.",
      backdoor: "BVM de flop e funil no turn/river.",
      air: "BVM de flop e funil no turn/river.",
    },
  },
  "iso-flop": {
    label: "ISO · SB deu check no flop",
    answers: { top: "bet-25", value: "bet-25", mid: "bet-25", draw: "bet-25", backdoor: "bet-25", air: "bet-25" },
    why: {
      top: "ISO: bet flop B25 de range (check-fold alto do field).",
      value: "ISO: bet flop B25 de range (check-fold alto do field).",
      mid: "ISO: bet flop B25 de range (check-fold alto do field).",
      draw: "ISO: bet flop B25 de range (check-fold alto do field).",
      backdoor: "ISO: bet flop B25 de range (check-fold alto do field).",
      air: "ISO: bet flop B25 de range (check-fold alto do field).",
    },
  },
  "iso-turn": {
    label: "ISO · SB check/call no flop e check no turn",
    answers: { top: "bet-67", value: "bet-67", mid: "bet-67", draw: "bet-67", backdoor: "bet-67", air: "bet-67" },
    why: {
      top: "Funil: B67 no turn de range.",
      value: "Funil: B67 no turn de range.",
      mid: "Funil: B67 no turn de range.",
      draw: "Funil: B67 no turn de range.",
      backdoor: "Funil: B67 no turn de range.",
      air: "Funil: B67 no turn de range.",
    },
  },
  "iso-river": {
    label: "ISO · SB check/call no turn e check no river",
    answers: { top: "bet-67", value: "bet-67", mid: "check", draw: "check", backdoor: "check", air: "check" },
    why: {
      top: "River só por valor (o field underfolda o 3º barril).",
      value: "River só por valor (o field underfolda o 3º barril).",
      mid: "Sem valor: givar o river.",
      draw: "Draw que não fechou: givar o river.",
      backdoor: "Givar o river.",
      air: "Givar o river.",
    },
  },
};

export function bwBbAnswer(hero: readonly Card[], board: readonly Card[], node: BwBbNode) {
  const cat = bwBbCategory(hero, board.slice(0, BW_BB_CARDS[node]));
  const guide = BW_BB_GUIDE[node];
  return { action: guide.answers[cat], category: BW_BB_CATEGORY_LABELS[cat], reason: guide.why[cat] ?? "", label: guide.label };
}
