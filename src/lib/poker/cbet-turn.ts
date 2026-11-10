/**
 * Cbet Turn IP (Posflop Attack, aula 29): o herói abriu, o BB pagou e o pote segue para o turn.
 *   - after-b40 / after-b25: cbet no flop com o size da nossa estratégia (range bet B40 ou B25) e call do BB.
 *     Barrelar todos os airs pelo menos no turn, com o size
 *     teórico do runout (A ou H b67 · dobra H b67 · brick b125 · dobra M/L b40 · 3F b40 (b50 do solver arredondado) · 3S b67 (b75 do solver arredondado) · 4F/4S b25).
 *   Double check e probes só nascem de flops em que a nossa estratégia dá check com a mão (split).
 *   - xx: check back no flop e o BB deu check no turn (double check): delayed cbet b67 com todos os airs.
 *   - probe-25: check back no flop e probe b25 do BB: raise com 2nd pair+ (polar fino) e draws sem showdown.
 *     Turn que dobra o board muda as categorias: top pair vira mão média e paga; raise só com trinca ou melhor.
 *   - probe-67: check back no flop e probe b67 do BB: 0% de raise; call com 2nd pair+, 3rd/4th pair com
 *     redraw e os melhores draws (broca + overs, OESD, FD).
 */
import { type Card, cardRank, cardSuit, rankValue } from "./cards";
import { type TurnType, isStraight, outs, turnType, withAce } from "./bb-vs-barrel";

export type CbetTurnNode = "after-b40" | "after-b25" | "xx" | "probe-25" | "probe-67";

export type TurnSize = "bet-25" | "bet-40" | "bet-67" | "bet-125";

/** Categoria do runout na guideline da aula 29. */
export type RunoutGroup = "A ou H" | "Dobra H" | "Brick" | "Dobra M/L" | "3F" | "3S" | "4F" | "4S";

export function runoutGroup(board: readonly Card[]): RunoutGroup {
  const map: Record<TurnType, RunoutGroup> = {
    A: "A ou H",
    H: "A ou H",
    M: "Brick",
    L: "Brick",
    DH: "Dobra H",
    DM: "Dobra M/L",
    DL: "Dobra M/L",
    "3F": "3F",
    "3S": "3S",
    "4F": "4F",
    "4S": "4S",
  };
  return map[turnType(board.slice(0, 4))];
}

export const RUNOUT_SIZE: Record<RunoutGroup, TurnSize> = {
  "A ou H": "bet-67",
  "Dobra H": "bet-67",
  Brick: "bet-125",
  "Dobra M/L": "bet-40",
  "3F": "bet-40",
  "3S": "bet-67",
  "4F": "bet-25",
  "4S": "bet-25",
};

export interface TurnHand {
  /** 1 = top pair/overpair, 2 = segundo par, 3 = terceiro par ou pior (inclui underpair), 0 = sem par. */
  pairRank: number;
  strong: boolean;
  flushDraw: boolean;
  oesd: boolean;
  gutshot: boolean;
  overcards: boolean;
}

/** Leitura da mão no turn: força (dois pares+), posição do par e draws. */
export function readTurnHand(hero: readonly Card[], fullBoard: readonly Card[]): TurnHand {
  const board = fullBoard.slice(0, 4);
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
    straight || flush || (pocket && count(hv[0]) >= 1) || paired.some((x) => count(x) >= 2) || (!pocket && paired.length === 2);
  let pairRank = 0;
  if (pocket) pairRank = hv[0] > distinct[0] ? 1 : hv[0] > (distinct[1] ?? 0) ? 2 : 3;
  else if (paired.length >= 1) pairRank = Math.min(distinct.indexOf(paired[0]) + 1, 3);
  if (strong) pairRank = 1;
  const flushDraw = hero.some((c) => suitN(cardSuit(c)) === 4);
  const o = outs([...hv, ...bv]);
  const heroHelps = o > Math.max(outs(bv), 0);
  return {
    pairRank,
    strong,
    flushDraw,
    oesd: heroHelps && o >= 2,
    gutshot: heroHelps && o === 1,
    overcards: hv[1] > distinct[0],
  };
}

export interface CbetTurnRead {
  action: string;
  category: string;
  reason: string;
  label: string;
}

const NODE_LABEL: Record<CbetTurnNode, string> = {
  "after-b40": "Turn depois do cbet B40 pago",
  "after-b25": "Turn depois do cbet B25 pago",
  xx: "Double check (flop e turn)",
  "probe-25": "Facing probe b25 no turn",
  "probe-67": "Facing probe b67 no turn",
};

function category(h: TurnHand): string {
  if (h.strong) return "Dois pares ou melhor";
  const draw = h.flushDraw && (h.oesd || h.gutshot) ? "combo draw" : h.flushDraw ? "flush draw" : h.oesd ? "2 pontas" : h.gutshot ? (h.overcards ? "broca + overs" : "broca") : "";
  const pair = ["", "Top pair / overpair", "Segundo par", "Terceiro par ou pior"][h.pairRank];
  if (pair) return draw ? `${pair} + ${draw}` : pair;
  if (draw) return draw[0].toUpperCase() + draw.slice(1);
  return "Air";
}

export function cbetTurnAnswer(hero: readonly Card[], fullBoard: readonly Card[], node: CbetTurnNode): CbetTurnRead {
  const board = fullBoard.slice(0, 4);
  const h = readTurnHand(hero, board);
  const cat = category(h);
  const label = NODE_LABEL[node];
  const draw = h.flushDraw || h.oesd || h.gutshot;
  const read = (action: string, reason: string): CbetTurnRead => ({ action, category: cat, reason, label });

  if (node === "after-b40" || node === "after-b25" || node === "xx") {
    const group = runoutGroup(board);
    const size = node === "xx" ? "bet-67" : RUNOUT_SIZE[group];
    const sizeLabel = size.replace("bet-", "b");
    const why = node === "xx" ? "delayed cbet b67" : `turn ${group}: ${sizeLabel}`;
    if (h.pairRank === 1) return read(size, `Valor: aposta (${why}).`);
    if (h.pairRank >= 2 && !draw) return read("check", "Valor médio com showdown: check behind.");
    if (h.pairRank >= 2) return read(size, `Par + draw: semi-bluff (${why}).`);
    if (draw) return read(size, `Draw: semi-bluff (${why}).`);
    return read(size, `Barrelar todos os airs pelo menos no turn (${why}).`);
  }
  if (node === "probe-25") {
    if (turnPairsBoard(board)) {
      if (h.strong) return read("vc-raise", "Turn dobrou o board: raise só com trinca ou melhor.");
      if (h.pairRank >= 1) return read("vc-call", "Turn dobrou o board: as mãos mudam de categoria e top pair vira mão média; call.");
      if (draw) return read("vc-raise", "Raise com draws sem valor de showdown.");
      return read("vc-call", "Probe b25: o resto do range paga (fold quase nunca).");
    }
    if (h.pairRank >= 1 && h.pairRank <= 2) return read("vc-raise", "Raise polar fino: 2nd pair+.");
    if (h.pairRank === 0 && draw) return read("vc-raise", "Raise com draws sem valor de showdown.");
    return read("vc-call", "Probe b25: o resto do range paga (fold quase nunca).");
  }
  // probe-67: 0% de raise
  if (h.pairRank >= 1 && h.pairRank <= 2) return read("vc-call", "0% de raise vs b67: call com 2nd pair+.");
  if (h.pairRank === 3)
    return draw ? read("vc-call", "3rd/4th pair só paga com redraw.") : read("vc-fold", "3rd/4th pair sem redraw: fold.");
  if (h.flushDraw || h.oesd || (h.gutshot && h.overcards)) return read("vc-call", "Melhores draws pagam: broca + overs, OESD e FD.");
  return read("vc-fold", "Vs b67 o air e os draws fracos largam.");
}

/** O turn tem o mesmo valor de uma carta do flop (dobra). */
export function turnPairsBoard(board: readonly Card[]): boolean {
  if (board.length < 4) return false;
  const turn = cardRank(board[3]);
  return board.slice(0, 3).some((c) => cardRank(c) === turn);
}
