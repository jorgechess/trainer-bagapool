/** Situação de cada lugar da mesa (9 jogadores) para desenhar o spot como num jogo de verdade. */
import { POSITIONS, type Position, type Strategy } from "./strategy";

export type SeatStatus = "hero" | "folded" | "waiting" | "raised" | "active";

export interface Seat {
  position: Position;
  status: SeatStatus;
  /** Blind já colocado no pote (em bb). */
  posted: number;
  isButton: boolean;
  /** Distância em lugares a partir do herói, no sentido da ação (0 = herói). */
  offset: number;
}

const BLINDS: Partial<Record<Position, number>> = { SB: 0.5, BB: 1 };

/**
 * Pré-flop: quem age antes do herói já foldou (menos o vilão, que aumentou); quem age depois espera.
 * Pós-flop: só herói e vilão seguem na mão.
 */
/** Pré-flop com vilão agindo depois do herói: o herói abriu e o vilão deu 3-bet. */
export function facesThreeBet(strategy: Strategy): boolean {
  if (strategy.street !== "preflop" || !strategy.villainPosition) return false;
  return POSITIONS.indexOf(strategy.villainPosition) > POSITIONS.indexOf(strategy.heroPosition);
}

export function tableSeats(strategy: Strategy): Seat[] {
  const heroIndex = POSITIONS.indexOf(strategy.heroPosition);
  const preflop = strategy.street === "preflop";
  const threeBet = facesThreeBet(strategy);
  return POSITIONS.map((position, index) => {
    let status: SeatStatus;
    if (position === strategy.heroPosition) status = "hero";
    else if (position === strategy.villainPosition) status = preflop ? "raised" : "active";
    else if (!preflop || threeBet) status = "folded";
    else status = index < heroIndex ? "folded" : "waiting";
    return {
      position,
      status,
      posted: preflop ? (BLINDS[position] ?? 0) : 0,
      isButton: position === "BTN",
      offset: (index - heroIndex + POSITIONS.length) % POSITIONS.length,
    };
  });
}

/** Pote conhecido antes da decisão: só os blinds, quando ninguém aumentou antes do herói. */
export function knownPot(strategy: Strategy): number | null {
  if (strategy.street !== "preflop" || strategy.villainPosition) return null;
  return 1.5;
}
