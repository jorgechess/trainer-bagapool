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
