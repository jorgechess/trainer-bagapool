/** Situação de cada lugar da mesa (9 jogadores) para desenhar o spot como num jogo de verdade. */
import { POSITIONS, type Position, type Strategy } from "./strategy";

export type SeatStatus = "hero" | "folded" | "waiting" | "raised" | "active";

export interface Seat {
  position: Position;
  status: SeatStatus;
  /** Fichas na frente do jogador nesta street (blinds, open, 3-bet), em bb. */
  posted: number;
  isButton: boolean;
  /** Distância em lugares a partir do herói, no sentido da ação (0 = herói). */
  offset: number;
}

const BLINDS: Partial<Record<Position, number>> = { SB: 0.5, BB: 1 };

/** Tamanhos padrão mostrados na mesa (definidos pelo time). */
export const DEFAULT_OPEN_SIZE = 2;
export const DEFAULT_THREE_BET_MULTIPLIER = 3.5;

/** Pré-flop com vilão agindo depois do herói: o herói abriu e o vilão deu 3-bet. */
export function facesThreeBet(strategy: Strategy): boolean {
  if (strategy.street !== "preflop" || !strategy.villainPosition) return false;
  return POSITIONS.indexOf(strategy.villainPosition) > POSITIONS.indexOf(strategy.heroPosition);
}

/** Tamanho do open e do 3-bet desenhados na mesa. */
export function tableSizes(strategy: Strategy): { open: number; threeBet: number } {
  const open = strategy.tableSizes?.open ?? DEFAULT_OPEN_SIZE;
  const threeBet = strategy.tableSizes?.threeBet ?? Math.round(open * DEFAULT_THREE_BET_MULTIPLIER * 10) / 10;
  return { open, threeBet };
}

/**
 * Pré-flop: quem age antes do herói já foldou (menos o vilão, que aumentou); quem age depois espera.
 * Vs 3-bet: o herói abriu, o vilão deu 3-bet e o resto foldou (os blinds ficam no pote).
 * Pós-flop: só herói e vilão seguem na mão.
 */
export function tableSeats(strategy: Strategy): Seat[] {
  const heroIndex = POSITIONS.indexOf(strategy.heroPosition);
  const preflop = strategy.street === "preflop";
  const threeBet = facesThreeBet(strategy);
  const sizes = tableSizes(strategy);
  return POSITIONS.map((position, index) => {
    let status: SeatStatus;
    if (position === strategy.heroPosition) status = "hero";
    else if (position === strategy.villainPosition) status = preflop ? "raised" : "active";
    else if (!preflop || threeBet) status = "folded";
    else status = index < heroIndex ? "folded" : "waiting";

    let posted = preflop ? (BLINDS[position] ?? 0) : 0;
    if (threeBet && position === strategy.heroPosition) posted = sizes.open;
    if (threeBet && position === strategy.villainPosition) posted = sizes.threeBet;
    return {
      position,
      status,
      posted,
      isButton: position === "BTN",
      offset: (index - heroIndex + POSITIONS.length) % POSITIONS.length,
    };
  });
}

/** Pote conhecido antes da decisão: blinds no RFI; blinds + open + 3-bet no vs 3-bet. */
export function knownPot(strategy: Strategy): number | null {
  if (strategy.street !== "preflop") return null;
  if (facesThreeBet(strategy)) {
    const total = tableSeats(strategy).reduce((sum, seat) => sum + seat.posted, 0);
    return Math.round(total * 10) / 10;
  }
  if (strategy.villainPosition) return null;
  return 1.5;
}

/**
 * Stack inicial (antes das apostas) desenhado para o herói e para os outros jogadores.
 * Em PKO, quem cobre aparece com 10bb a mais que o stack efetivo da estratégia, salvo valores definidos.
 */
export function tableStacks(strategy: Strategy): { hero: number; others: number } | null {
  if (strategy.stack.min !== strategy.stack.max) return null;
  const base = strategy.stack.min;
  const pko = strategy.pko;
  if (!pko) return { hero: base, others: base };
  const bigger = base + 10;
  return {
    hero: pko.heroStack ?? (pko.coverage === "cobrindo" ? bigger : base),
    others: pko.villainStack ?? (pko.coverage === "coberto" ? bigger : base),
  };
}

/**
 * Stacks dos vilões em spots de fim de torneio (proporção ou bolha): a média da mesa é sorteada
 * (12 a 45bb) e cada vilão varia em volta dela; só o herói fica com o stack do spot.
 * Mesmo `seed` (as cartas da mão) = mesma mesa. Retorna null nos outros spots.
 */
export function randomVillainStacks(strategy: Strategy, seed: number): Partial<Record<Position, number>> | null {
  if (!strategy.ratio && !strategy.bubble && !strategy.randomStacks) return null;
  let state = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  const next = () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
  const average = 12 + Math.floor(next() * 34);
  const stacks: Partial<Record<Position, number>> = {};
  for (const position of POSITIONS) {
    if (position === strategy.heroPosition) continue;
    stacks[position] = Math.max(2, Math.round(average * (0.35 + next() * 1.3)));
  }
  return stacks;
}

/** Padrão do time: o ITM paga 17 lugares; com 20 ou menos restantes já é bolha. */
export const ITM_PLACES = 17;
export const BUBBLE_FROM = 20;

/**
 * Jogadores restantes mostrados na mesa (null se o spot não fala de proporção nem bolha).
 * Proporção p:1 = 17 × p restantes (2:1 → 34, 3:1 → 51, 1,5:1 → 26). Bolha = de 20 a 18 restantes.
 * `seed` (ex.: das cartas da mão) escolhe o número quando há uma faixa, sempre igual para a mesma mão.
 */
export function playersLeft(strategy: Pick<Strategy, "ratio" | "bubble">, seed = 0): number | null {
  const pick = (lo: number, hi: number) => lo + (Math.abs(Math.trunc(seed)) % (hi - lo + 1));
  if (strategy.bubble) return pick(ITM_PLACES + 1, BUBBLE_FROM);
  if (strategy.ratio) {
    const lo = Math.round(ITM_PLACES * strategy.ratio.min);
    const hi = Math.max(lo, Math.round(ITM_PLACES * strategy.ratio.max));
    return pick(lo, hi);
  }
  return null;
}

/** Número estável a partir de um texto (ex.: as cartas da mão). */
export function seedFrom(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/**
 * Stack do herói na mão: o valor da estratégia; se ela tiver uma faixa (ex.: 12–15bb) numa mesa de
 * stacks aleatórios, um valor inteiro sorteado na faixa (sempre o mesmo para a mesma mão).
 */
export function heroStackFor(strategy: Strategy, seed: number): number | null {
  const { min, max } = strategy.stack;
  if (min === max) return tableStacks(strategy)?.hero ?? min;
  if (!strategy.randomStacks && !strategy.ratio && !strategy.bubble) return null;
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return lo + (Math.floor(Math.abs(seed) / 7) % (hi - lo + 1));
}

/** Stack de um vilão: o sorteado, respeitando a cobertura do PKO (coberto = todos cobrem o herói). */
function villainStart(strategy: Strategy, hero: number, drawn: number | undefined, fallback: number | undefined): number {
  if (drawn === undefined) return fallback ?? hero;
  if (strategy.pko?.coverage === "coberto") return hero + 1 + Math.round(drawn / 2);
  if (strategy.pko?.coverage === "cobrindo") return Math.max(2, Math.min(drawn, hero - 1));
  return drawn;
}

export interface TableState {
  seats: Seat[];
  /** Stack que sobra na frente de cada jogador (bb), ou null se não dá para saber. */
  remaining: Partial<Record<Position, number>> | null;
  pot: number | null;
  /** Rótulo da ação do vilão: "Raise", "3-bet" ou "All-in". */
  raiseLabel: string;
}

/** Tudo que a mesa desenha numa mão: lugares, fichas, stacks e pote. */
export function tableState(strategy: Strategy, seed: number): TableState {
  const seats = tableSeats(strategy).map((seat) => ({ ...seat }));
  const base = tableStacks(strategy);
  const hero = heroStackFor(strategy, seed);
  const villains = randomVillainStacks(strategy, seed);
  let start: Partial<Record<Position, number>> | null = null;
  if (hero !== null) {
    start = {};
    for (const seat of seats)
      start[seat.position] = seat.status === "hero" ? hero : villainStart(strategy, hero, villains?.[seat.position], base?.others);
  }
  if (strategy.villainAllIn && strategy.villainPosition) {
    const villain = seats.find((s) => s.position === strategy.villainPosition)!;
    if (start) villain.posted = start[villain.position]!;
    const opener = seats.find((s) => s.position === strategy.heroPosition)!;
    if (POSITIONS.indexOf(strategy.villainPosition) > POSITIONS.indexOf(strategy.heroPosition))
      opener.posted = tableSizes(strategy).open;
  }
  const remaining = start
    ? Object.fromEntries(seats.map((s) => [s.position, Math.round((start![s.position]! - s.posted) * 10) / 10]))
    : null;
  const total = seats.reduce((sum, s) => sum + s.posted, 0);
  const pot = strategy.villainAllIn ? Math.round(total * 10) / 10 : knownPot(strategy);
  return {
    seats,
    remaining,
    pot,
    raiseLabel: strategy.villainAllIn ? "All-in" : facesThreeBet(strategy) ? "3-bet" : "Raise",
  };
}
